import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserData, UserProfile } from './useUserData';
import { generateWeeklyPlan, WeeklyPlan, DayPlan, GeneratedWorkout } from '../services/aiService';
import { supabaseGet, supabaseUpsert } from '../services/supabaseRawFetch';
import { calculateRepVolume } from '../utils/workoutUtils';

// ============================================================================
// Types
// ============================================================================

interface WorkoutHistoryItem {
  date: string;
  title: string;
  muscles: string[];
  volume: number;
  exercises: {
    name: string;
    sets: number;
    reps: string;
    weight?: number;
  }[];
}

interface RecoveryPattern {
  date: string;
  energyLevel: number;
  sleepHours: number;
  sorenessAreas: string[];
}

interface UseWeeklyPlanResult {
  // Data
  plan: WeeklyPlan | null;
  todaysPlan: DayPlan | null;
  todaysWorkout: GeneratedWorkout | null;
  completedDays: Set<number>;

  // State
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  generateNewPlan: () => Promise<void>;
  refreshPlan: () => Promise<void>;
  markDayCompleted: (dayIndex: number) => Promise<boolean>;
}

// ============================================================================
// Utility Functions
// ============================================================================

// Get the Monday of the current week (timezone-safe)
function getWeekStart(): string {
  const today = new Date();
  // Clone to avoid mutating original
  const monday = new Date(today);
  const dayOfWeek = monday.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = -6, Mon = 0, Tue = -1, etc.
  monday.setDate(monday.getDate() + diff);
  // Use local date parts to avoid timezone shifts
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today's day index (0 = Sunday, 6 = Saturday)
function getTodayIndex(): number {
  return new Date().getDay();
}

// Extract muscle groups from workout title
function extractMusclesFromTitle(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  const muscles: string[] = [];

  if (lowerTitle.includes('chest') || lowerTitle.includes('push')) muscles.push('chest');
  if (lowerTitle.includes('back') || lowerTitle.includes('pull')) muscles.push('back');
  if (lowerTitle.includes('shoulder')) muscles.push('shoulders');
  if (lowerTitle.includes('leg') || lowerTitle.includes('lower')) muscles.push('legs');
  if (lowerTitle.includes('arm') || lowerTitle.includes('bicep') || lowerTitle.includes('tricep')) muscles.push('arms');
  if (lowerTitle.includes('core') || lowerTitle.includes('ab')) muscles.push('core');
  if (lowerTitle.includes('full')) muscles.push('full body');
  if (lowerTitle.includes('upper')) muscles.push('upper body');

  return muscles.length > 0 ? muscles : ['general'];
}

// Use shared utility for volume calculation
const calculateVolume = calculateRepVolume;

// ============================================================================
// Hook
// ============================================================================

export function useWeeklyPlan(): UseWeeklyPlanResult {
  const { user } = useAuth();
  const { workouts, userProfile } = useUserData();

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
  const [realRecoveryData, setRealRecoveryData] = useState<RecoveryPattern[]>([]);

  // Load existing plan and recovery data from Supabase on mount
  useEffect(() => {
    if (!user) return;

    // AbortController for cleanup on unmount or user change
    let isCancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const weekStart = getWeekStart();

        // Fetch plan and recovery logs in parallel
        const [planResult, recoveryResult] = await Promise.all([
          supabaseGet<any[]>(
            `weekly_plans?user_id=eq.${user.id}&week_start=eq.${weekStart}&limit=1`
          ),
          supabaseGet<any[]>(
            `user_recovery_logs?user_id=eq.${user.id}&order=date.desc&limit=7`
          )
        ]);

        // Bail if unmounted or user changed
        if (isCancelled) return;

        // Handle recovery data - check for errors
        if (recoveryResult.error) {
          console.warn('[useWeeklyPlan] Recovery logs fetch failed:', recoveryResult.error);
          // Non-fatal: recovery logs are optional, continue with defaults
        } else if (recoveryResult.data && recoveryResult.data.length > 0) {
          setRealRecoveryData(recoveryResult.data.map((r: any) => ({
            date: r.date,
            energyLevel: r.energy_level || 3,
            sleepHours: r.sleep_hours || 7,
            sorenessAreas: r.soreness_areas || []
          })));
        }

        const { data, error: fetchError } = planResult;

        if (fetchError) {
          console.error('[useWeeklyPlan] Error loading plan:', fetchError);
          setError('Failed to load weekly plan');
        } else if (data && data.length > 0) {
          setPlan(data[0].plan as WeeklyPlan);
          // Load persisted completed days
          if (data[0].completed_days && Array.isArray(data[0].completed_days)) {
            setCompletedDays(new Set(data[0].completed_days));
          }
        }
      } catch (err) {
        if (isCancelled) return;
        console.error('[useWeeklyPlan] Error:', err);
        setError('Failed to load weekly plan');
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    // Cleanup function
    return () => {
      isCancelled = true;
    };
  }, [user]);

  // Transform workout history for AI input
  const workoutHistory = useMemo((): WorkoutHistoryItem[] => {
    return workouts.slice(0, 20).map(w => ({
      date: w.rawDate || w.date,
      title: w.title,
      muscles: extractMusclesFromTitle(w.title),
      volume: calculateVolume(w.log || []),
      exercises: (w.log || []).map((e: any) => ({
        name: e.name || 'Unknown',
        sets: e.sets || 3,
        reps: e.reps || '10',
        weight: e.weight
      }))
    }));
  }, [workouts]);

  // Recovery patterns - use real data when available, otherwise infer from workout history
  const recoveryPatterns = useMemo((): RecoveryPattern[] => {
    // If we have real recovery logs, use them
    if (realRecoveryData.length > 0) {
      return realRecoveryData;
    }

    // Try to infer from workout history (workouts may have energy_level, sleep_hours)
    const inferredPatterns: RecoveryPattern[] = workouts.slice(0, 7).map((w: any) => ({
      date: w.rawDate?.split('T')[0] || w.date,
      energyLevel: w.energy_level || 3, // Default to "okay" if not recorded
      sleepHours: w.sleep_hours || 7,   // Default to 7 hours
      sorenessAreas: w.soreness_areas || []
    }));

    if (inferredPatterns.length > 0) {
      return inferredPatterns;
    }

    // Absolute fallback - use sensible defaults (not random!)
    const defaults: RecoveryPattern[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      defaults.push({
        date: date.toISOString().split('T')[0],
        energyLevel: 3, // "Okay" - middle ground
        sleepHours: 7,  // Average sleep
        sorenessAreas: []
      });
    }
    return defaults;
  }, [realRecoveryData, workouts]);

  // Generate a new weekly plan
  const generateNewPlan = useCallback(async () => {
    if (!user || !userProfile) {
      setError('Please complete your profile first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const profile: UserProfile = {
        ...userProfile,
        goal: userProfile.goal || 'RECOMP',
        training_experience: userProfile.training_experience || 'intermediate',
        equipment_access: userProfile.equipment_access || 'gym',
        days_per_week: userProfile.days_per_week || 4
      };

      const result = await generateWeeklyPlan({
        profile,
        recentWorkouts: workoutHistory,
        recoveryPatterns
      });

      if (result) {
        setPlan(result);
        setCompletedDays(new Set());

        // Save to Supabase (include empty completed_days array)
        try {
          const weekStart = getWeekStart();
          const upsertResult = await supabaseUpsert('weekly_plans', {
            user_id: user.id,
            week_start: weekStart,
            plan: result,
            reasoning: result.reasoning,
            progressive_overload_notes: result.progressive_overload_notes,
            completed_days: [], // Fresh plan has no completed days
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, 'user_id,week_start');

          if (upsertResult.error) {
            console.error('[useWeeklyPlan] Failed to save plan:', upsertResult.error);
            // Plan is in memory but not persisted - continue but warn
            setError('Plan created but save failed. Changes may be lost on refresh.');
          }
        } catch (saveErr) {
          console.error('[useWeeklyPlan] Save exception:', saveErr);
          setError('Plan created but save failed. Changes may be lost on refresh.');
        }
      } else {
        setError('Failed to generate plan. Please try again.');
      }
    } catch (err) {
      console.error('[useWeeklyPlan] Generation error:', err);
      setError('Failed to generate weekly plan');
    } finally {
      setIsGenerating(false);
    }
  }, [user, userProfile, workoutHistory, recoveryPatterns]);

  // Refresh plan from database
  const refreshPlan = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const weekStart = getWeekStart();
      const { data, error: fetchError } = await supabaseGet<any[]>(
        `weekly_plans?user_id=eq.${user.id}&week_start=eq.${weekStart}&limit=1`
      );

      if (fetchError) {
        setError('Failed to refresh plan');
      } else if (data && data.length > 0) {
        setPlan(data[0].plan as WeeklyPlan);
      }
    } catch (err) {
      setError('Failed to refresh plan');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Mark a day as completed and persist to Supabase
  // Returns true if persistence succeeded, false if it failed
  const markDayCompleted = useCallback(async (dayIndex: number): Promise<boolean> => {
    // Update local state immediately (optimistic)
    const updatedSet = new Set([...completedDays, dayIndex]);
    setCompletedDays(updatedSet);

    // Persist to Supabase
    if (!user) return true; // No user = nothing to persist, consider it "success"

    try {
      const weekStart = getWeekStart();
      const result = await supabaseUpsert('weekly_plans', {
        user_id: user.id,
        week_start: weekStart,
        completed_days: Array.from(updatedSet),
        updated_at: new Date().toISOString()
      }, 'user_id,week_start');

      if (result.error) {
        console.error('[useWeeklyPlan] Failed to persist completed days:', result.error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[useWeeklyPlan] Exception persisting completed days:', err);
      return false;
    }
  }, [user, completedDays]);

  // Get today's plan
  const todaysPlan = useMemo((): DayPlan | null => {
    if (!plan?.days) return null;
    const todayIndex = getTodayIndex();
    return plan.days.find(d => d.day === todayIndex) || null;
  }, [plan]);

  // Get today's workout
  const todaysWorkout = useMemo((): GeneratedWorkout | null => {
    return todaysPlan?.workout || null;
  }, [todaysPlan]);

  return {
    plan,
    todaysPlan,
    todaysWorkout,
    completedDays,
    isLoading,
    isGenerating,
    error,
    generateNewPlan,
    refreshPlan,
    markDayCompleted
  };
}
