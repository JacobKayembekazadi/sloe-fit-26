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

  // State
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  generateNewPlan: () => Promise<void>;
  refreshPlan: () => Promise<void>;
  markDayCompleted: (dayIndex: number) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

// Get the Monday of the current week
function getWeekStart(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
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

  // Load existing plan from Supabase on mount
  useEffect(() => {
    if (!user) return;

    const loadPlan = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const weekStart = getWeekStart();
        const { data, error: fetchError } = await supabaseGet<any[]>(
          `weekly_plans?user_id=eq.${user.id}&week_start=eq.${weekStart}&limit=1`
        );

        if (fetchError) {
          console.error('[useWeeklyPlan] Error loading plan:', fetchError);
          setError('Failed to load weekly plan');
        } else if (data && data.length > 0) {
          setPlan(data[0].plan as WeeklyPlan);
        }
      } catch (err) {
        console.error('[useWeeklyPlan] Error:', err);
        setError('Failed to load weekly plan');
      } finally {
        setIsLoading(false);
      }
    };

    loadPlan();
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

  // Mock recovery patterns (in future, this could come from recovery check-in data)
  const recoveryPatterns = useMemo((): RecoveryPattern[] => {
    // Generate mock patterns based on recent activity
    const patterns: RecoveryPattern[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      patterns.push({
        date: date.toISOString().split('T')[0],
        energyLevel: 3 + Math.floor(Math.random() * 2),
        sleepHours: 6 + Math.floor(Math.random() * 3),
        sorenessAreas: []
      });
    }
    return patterns;
  }, []);

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

        // Save to Supabase
        const weekStart = getWeekStart();
        await supabaseUpsert('weekly_plans', {
          user_id: user.id,
          week_start: weekStart,
          plan: result,
          reasoning: result.reasoning,
          progressive_overload_notes: result.progressive_overload_notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 'user_id,week_start');
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

  // Mark a day as completed
  const markDayCompleted = useCallback((dayIndex: number) => {
    setCompletedDays(prev => new Set([...prev, dayIndex]));
  }, []);

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
    isLoading,
    isGenerating,
    error,
    generateNewPlan,
    refreshPlan,
    markDayCompleted
  };
}
