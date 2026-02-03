import { useEffect, useState, useCallback, useRef } from 'react';
import { supabaseGetSingle, supabaseInsert, supabaseUpdate, supabaseUpsert } from '../services/supabaseRawFetch';
import { useAuth } from '../contexts/AuthContext';
import { CompletedWorkout, NutritionLog } from '../App';

// ============================================================================
// Types
// ============================================================================

export interface NutritionTargets {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
}

export interface UserProfile {
    goal: string | null;
    height_inches: number | null;
    weight_lbs: number | null;
    age: number | null;
    training_experience: 'beginner' | 'intermediate' | 'advanced' | null;
    equipment_access: 'gym' | 'home' | 'minimal' | null;
    days_per_week: number | null;
    role: 'consumer' | 'client' | 'trainer';
    trainer_id: string | null;
    full_name: string | null;
}

interface DataState {
    profile: UserProfile;
    goal: string | null;
    onboardingComplete: boolean | null;
    workouts: CompletedWorkout[];
    nutritionLogs: NutritionLog[];
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface UseUserDataError {
    message: string;
    code?: string;
    retryable: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PROFILE: UserProfile = {
    goal: null,
    height_inches: null,
    weight_lbs: null,
    age: null,
    training_experience: null,
    equipment_access: null,
    days_per_week: null,
    role: 'consumer',
    trainer_id: null,
    full_name: null
};

const INITIAL_STATE: DataState = {
    profile: DEFAULT_PROFILE,
    goal: null,
    onboardingComplete: null,
    workouts: [],
    nutritionLogs: []
};

// Timeout for data fetching (prevents infinite loading)
// Increased to 20s to handle Supabase cold starts on free tier
const FETCH_TIMEOUT_MS = 20000;

// Activity multiplier for TDEE calculation
const ACTIVITY_MULTIPLIER = 1.55;

// ============================================================================
// Utility Functions
// ============================================================================

const calculateBMR = (weightLbs: number, heightInches: number, age: number): number => {
    const weightKg = weightLbs * 0.453592;
    const heightCm = heightInches * 2.54;
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
};

const getDefaultTargets = (goal: string | null): NutritionTargets => {
    switch (goal) {
        case 'CUT':
            return { calories: 1800, protein: 200, carbs: 150, fats: 60 };
        case 'BULK':
            return { calories: 3000, protein: 180, carbs: 350, fats: 80 };
        case 'RECOMP':
        default:
            return { calories: 2200, protein: 190, carbs: 220, fats: 70 };
    }
};

export const calculateNutritionTargets = (profile: UserProfile): NutritionTargets => {
    if (profile.weight_lbs && profile.height_inches && profile.age) {
        const bmr = calculateBMR(profile.weight_lbs, profile.height_inches, profile.age);
        const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER);
        const goalAdjustment = { CUT: -500, BULK: 300, RECOMP: 0 }[profile.goal || 'RECOMP'] || 0;
        const calories = tdee + goalAdjustment;
        const protein = profile.weight_lbs;
        const fats = Math.round((calories * 0.25) / 9);
        const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);

        return { calories, protein, carbs, fats };
    }
    return getDefaultTargets(profile.goal);
};

// Format date consistently for storage
const formatDateForDB = (date: Date = new Date()): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

// Format date for display
const formatDateForDisplay = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ============================================================================
// Hook
// ============================================================================

export const useUserData = () => {
    const { user } = useAuth();
    const [data, setData] = useState<DataState>(INITIAL_STATE);
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [error, setError] = useState<UseUserDataError | null>(null);

    // Refs for cleanup and preventing stale closures
    const abortControllerRef = useRef<AbortController | null>(null);
    const currentUserIdRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);

    // Track if we've fetched for this user to prevent duplicate fetches
    const hasFetchedRef = useRef(false);

    // Safe state update that checks if component is still mounted
    const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T | ((prev: T) => T)) => {
        if (isMountedRef.current) {
            setter(value);
        }
    }, []);

    // Reset all data (called on logout or no user)
    const resetData = useCallback(() => {
        setData(INITIAL_STATE);
        setLoadingState('success'); // Not 'idle' - we're done loading (nothing to load)
        setError(null);
        hasFetchedRef.current = false;
    }, []);

    // Fetch all user data
    const fetchAllData = useCallback(async (userId: string, signal: AbortSignal) => {
        // Prevent fetching if already fetched for this user in this session
        if (hasFetchedRef.current && currentUserIdRef.current === userId) {
            return;
        }
        setLoadingState('loading');
        setError(null);

        // Use raw fetch since Supabase client has issues
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Get the user's JWT token from localStorage (bypassing Supabase client)
        let authToken = supabaseKey;
        try {
            // Extract project ID from URL (e.g., https://abc123.supabase.co -> abc123)
            const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
            const storageKey = `sb-${projectId}-auth-token`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                authToken = parsed?.access_token || supabaseKey;
            }
        } catch {
            // Could not get auth token from localStorage, using anon key
        }

        const fetchHeaders = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        try {
            // Create a timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT_MS);
                // Clear timeout if aborted
                signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Aborted'));
                });
            });


            // Fetch all data in parallel using raw fetch

            const rawFetch = async (endpoint: string) => {
                const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
                    headers: fetchHeaders,
                    signal
                });
                const data = await response.json();
                if (!response.ok) {
                    return { data: null, error: data };
                }
                return { data, error: null };
            };

            const profileFetch = rawFetch(`profiles?select=goal,onboarding_complete,height_inches,weight_lbs,age,training_experience,equipment_access,days_per_week,full_name,role,trainer_id&id=eq.${userId}`)
                .then(r => {
                    // Convert array to single object for profile
                    if (r.data && Array.isArray(r.data) && r.data.length > 0) {
                        return { data: r.data[0], error: null };
                    } else if (r.data && Array.isArray(r.data) && r.data.length === 0) {
                        return { data: null, error: { code: 'PGRST116', message: 'No rows returned' } };
                    }
                    return r;
                });

            const workoutsFetch = rawFetch(`workouts?select=*&user_id=eq.${userId}&order=date.desc&limit=50`);

            const nutritionFetch = rawFetch(`nutrition_logs?select=*&user_id=eq.${userId}&order=date.desc&limit=30`);

            const fetchPromise = Promise.all([profileFetch, workoutsFetch, nutritionFetch]);

            const [profileResult, workoutsResult, nutritionResult] = await Promise.race([
                fetchPromise,
                timeoutPromise
            ]) as [any, any, any];

            // Check if request was aborted or user changed
            if (signal.aborted || currentUserIdRef.current !== userId) {
                return;
            }

            // Process profile
            let profile: UserProfile = DEFAULT_PROFILE;
            let goal: string | null = null;
            let onboardingComplete: boolean | null = null;

            if (profileResult.data && !profileResult.error) {
                const p = profileResult.data;
                profile = {
                    goal: p.goal,
                    height_inches: p.height_inches,
                    weight_lbs: p.weight_lbs,
                    age: p.age,
                    training_experience: p.training_experience,
                    equipment_access: p.equipment_access,
                    days_per_week: p.days_per_week,
                    role: p.role || 'consumer',
                    trainer_id: p.trainer_id,
                    full_name: p.full_name
                };
                goal = p.goal;
                onboardingComplete = p.onboarding_complete ?? false;
            } else if (profileResult.error?.code === 'PGRST116') {
                // No profile found - create one and show onboarding
                try {
                    await supabaseInsert('profiles', {
                        id: userId,
                        onboarding_complete: false,
                        created_at: new Date().toISOString()
                    });
                } catch {
                    // Profile creation failed - will be retried on next load
                }
                onboardingComplete = false;
            } else if (profileResult.error) {
                onboardingComplete = false;
            }

            // Process workouts
            let workouts: CompletedWorkout[] = [];
            if (workoutsResult.data && !workoutsResult.error) {
                workouts = workoutsResult.data.map((w: any) => ({
                    date: formatDateForDisplay(w.date),
                    title: w.title || 'Workout',
                    log: Array.isArray(w.exercises) ? w.exercises : []
                }));
            }

            // Process nutrition logs
            let nutritionLogs: NutritionLog[] = [];
            if (nutritionResult.data && !nutritionResult.error) {
                nutritionLogs = nutritionResult.data.map((n: any) => ({
                    date: n.date,
                    calories: n.calories || 0,
                    protein: n.protein || 0,
                    carbs: n.carbs || 0,
                    fats: n.fats || 0
                }));
            }

            // Update state atomically
            if (isMountedRef.current && currentUserIdRef.current === userId) {
                setData({
                    profile,
                    goal,
                    onboardingComplete,
                    workouts,
                    nutritionLogs
                });
                setLoadingState('success');
                hasFetchedRef.current = true;
            }

        } catch (err) {
            // Don't update state if aborted or user changed
            if (signal.aborted || currentUserIdRef.current !== userId) {
                return;
            }

            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            const isTimeout = errorMessage === 'Request timeout';

            if (isMountedRef.current) {
                setError({
                    message: isTimeout ? 'Data loading timed out. Please try again.' : 'Failed to load your data.',
                    retryable: true
                });
                setLoadingState('error');

                // Still set onboarding to false so user isn't stuck
                setData(prev => ({
                    ...prev,
                    onboardingComplete: prev.onboardingComplete ?? false
                }));
            }
        }
    }, []);

    // Main effect - fetch data when user changes
    useEffect(() => {
        isMountedRef.current = true;

        // User logged out - clear all data
        if (!user) {
            currentUserIdRef.current = null;
            resetData();
            return;
        }

        // User changed - cancel previous requests
        if (currentUserIdRef.current !== user.id) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            hasFetchedRef.current = false;
        }

        currentUserIdRef.current = user.id;

        // Create new abort controller for this fetch
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Fetch data
        fetchAllData(user.id, controller.signal);

        // Cleanup on unmount or user change
        return () => {
            isMountedRef.current = false;
            controller.abort();
        };
    }, [user, fetchAllData, resetData]);

    // Retry function for error recovery
    const retry = useCallback(() => {
        if (!user) return;

        hasFetchedRef.current = false;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        fetchAllData(user.id, controller.signal);
    }, [user, fetchAllData]);

    // Update goal
    const updateGoal = useCallback(async (newGoal: string) => {
        if (!user) return;

        // Optimistic update
        setData(prev => ({
            ...prev,
            goal: newGoal,
            profile: { ...prev.profile, goal: newGoal }
        }));

        try {
            const { error } = await supabaseUpdate(
                `profiles?id=eq.${user.id}`,
                { goal: newGoal }
            );

            if (error) {
                // Could revert here, but keeping optimistic for better UX
            }
        } catch {
            // Goal update failed silently - optimistic UI kept
        }
    }, [user]);

    // Add workout - returns true if saved successfully, false otherwise
    const addWorkout = useCallback(async (title: string, exercises: any[], recoveryRating?: number): Promise<boolean> => {
        if (!user) return false;

        const newWorkout: CompletedWorkout = {
            date: formatDateForDisplay(new Date()),
            title,
            log: exercises
        };

        // Optimistic update
        setData(prev => ({
            ...prev,
            workouts: [newWorkout, ...prev.workouts]
        }));

        try {
            const { error } = await supabaseInsert('workouts', {
                user_id: user.id,
                title,
                date: new Date().toISOString(),
                exercises,
                recovery_rating: recoveryRating
            });

            if (error) {
                // Revert on error
                setData(prev => ({
                    ...prev,
                    workouts: prev.workouts.filter(w => w !== newWorkout)
                }));
                return false;
            }
            return true;
        } catch {
            // Revert on error
            setData(prev => ({
                ...prev,
                workouts: prev.workouts.filter(w => w !== newWorkout)
            }));
            return false;
        }
    }, [user]);

    // Save nutrition (upsert)
    const saveNutrition = useCallback(async (log: NutritionLog) => {
        if (!user) return;

        // Normalize date format
        const normalizedDate = log.date.includes('T')
            ? log.date.split('T')[0]
            : log.date;

        const normalizedLog = { ...log, date: normalizedDate };

        // Optimistic update
        setData(prev => {
            const existingIndex = prev.nutritionLogs.findIndex(l =>
                l.date === normalizedDate ||
                l.date.split('T')[0] === normalizedDate
            );

            const newLogs = [...prev.nutritionLogs];
            if (existingIndex >= 0) {
                newLogs[existingIndex] = normalizedLog;
            } else {
                newLogs.unshift(normalizedLog);
            }

            return { ...prev, nutritionLogs: newLogs };
        });

        try {
            // Use upsert to avoid race conditions
            await supabaseUpsert('nutrition_logs', {
                user_id: user.id,
                date: normalizedDate,
                calories: log.calories,
                protein: log.protein,
                carbs: log.carbs,
                fats: log.fats
            }, 'user_id,date');
        } catch {
            // Nutrition save failed silently - optimistic UI kept
        }
    }, [user]);

    // Add meal to daily totals
    const addMealToDaily = useCallback(async (macros: { calories: number; protein: number; carbs: number; fats: number }) => {
        if (!user) return;

        const today = formatDateForDB();

        // Find existing log for today
        const existingLog = data.nutritionLogs.find(l =>
            l.date === today ||
            l.date.split('T')[0] === today
        );

        const updatedLog: NutritionLog = {
            date: today,
            calories: Math.round((existingLog?.calories || 0) + macros.calories),
            protein: Math.round((existingLog?.protein || 0) + macros.protein),
            carbs: Math.round((existingLog?.carbs || 0) + macros.carbs),
            fats: Math.round((existingLog?.fats || 0) + macros.fats)
        };

        await saveNutrition(updatedLog);
    }, [user, data.nutritionLogs, saveNutrition]);

    // Refetch profile (called after onboarding)
    const refetchProfile = useCallback(async () => {
        if (!user) return;

        // Optimistically set onboarding complete
        setData(prev => ({
            ...prev,
            onboardingComplete: true
        }));

        try {
            const { data: profile, error } = await supabaseGetSingle<any>(
                `profiles?id=eq.${user.id}&select=goal,onboarding_complete,height_inches,weight_lbs,age,training_experience,equipment_access,days_per_week,full_name,role,trainer_id`
            );

            if (error) {
                return;
            }

            if (profile && isMountedRef.current) {
                setData(prev => ({
                    ...prev,
                    goal: profile.goal,
                    onboardingComplete: profile.onboarding_complete ?? true,
                    profile: {
                        goal: profile.goal,
                        height_inches: profile.height_inches,
                        weight_lbs: profile.weight_lbs,
                        age: profile.age,
                        training_experience: profile.training_experience,
                        equipment_access: profile.equipment_access,
                        days_per_week: profile.days_per_week,
                        role: profile.role || 'consumer',
                        trainer_id: profile.trainer_id,
                        full_name: profile.full_name
                    }
                }));
            }
        } catch {
            // Profile refetch failed silently
        }
    }, [user]);

    // Computed values
    const nutritionTargets = calculateNutritionTargets(data.profile);
    const loading = loadingState === 'loading' || loadingState === 'idle';

    // Debug: log loading state on each render (dev only)
    if (import.meta.env.DEV) {
        console.log('[useUserData] Render - loadingState:', loadingState, 'computed loading:', loading, 'onboardingComplete:', data.onboardingComplete);
    }

    return {
        // Data
        goal: data.goal,
        onboardingComplete: data.onboardingComplete,
        userProfile: data.profile,
        nutritionTargets,
        workouts: data.workouts,
        nutritionLogs: data.nutritionLogs,

        // State
        loading,
        loadingState,
        error,

        // Actions
        updateGoal,
        addWorkout,
        saveNutrition,
        addMealToDaily,
        refetchProfile,
        retry
    };
};
