import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabaseGet, supabaseGetSingle, supabaseInsert, supabaseUpdate, supabaseUpsert, supabaseDelete } from '../services/supabaseRawFetch';
import { useAuth } from '../contexts/AuthContext';
import { CompletedWorkout, NutritionLog } from '../App';
import {
    queueMeal,
    getQueuedMeals,
    removeFromQueue,
    incrementRetryCount,
    onOnline,
    hasQueuedMeals,
    getQueuedCount,
    migrateQueueUserId,
    type QueuedMeal
} from '../services/offlineQueue';
import { migrateWorkoutQueueUserId } from '../services/workoutOfflineQueue';

// ============================================================================
// Types
// ============================================================================

export interface NutritionTargets {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
}

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';

export interface UserProfile {
    goal: string | null;
    height_inches: number | null;
    weight_lbs: number | null;
    age: number | null;
    gender: Gender | null;
    activity_level: ActivityLevel | null;
    training_experience: 'beginner' | 'intermediate' | 'advanced' | null;
    equipment_access: 'gym' | 'home' | 'minimal' | null;
    days_per_week: number | null;
    role: 'consumer' | 'client' | 'trainer';
    trainer_id: string | null;
    full_name: string | null;
}

// Meal entry type matching database schema
export interface MealEntry {
    id: string;
    user_id: string;
    date: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
    input_method: 'photo' | 'text' | 'quick_add' | null;
    description: string | null;
    photo_url: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    created_at: string;
}

// Favorite food type matching database schema
export interface FavoriteFood {
    id: string;
    user_id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    times_logged: number;
    created_at: string;
    updated_at: string;
}

interface DataState {
    profile: UserProfile;
    goal: string | null;
    onboardingComplete: boolean | null;
    workouts: CompletedWorkout[];
    nutritionLogs: NutritionLog[];
    mealEntries: MealEntry[];
    favorites: FavoriteFood[];
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
    gender: null,
    activity_level: null,
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
    nutritionLogs: [],
    mealEntries: [],
    favorites: []
};

// Activity multiplier lookup for TDEE calculation (Harris-Benedict scale)
// FIX 3.2: Replace hardcoded 1.55 with user-selectable activity level
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
};

// Minimum safe calorie floor to prevent dangerously low targets
const MIN_CALORIE_FLOOR = 1200;

// ============================================================================
// Utility Functions
// ============================================================================

// FIX 3.1: Mifflin-St Jeor with gender — male +5, female -161
const calculateBMR = (weightLbs: number, heightInches: number, age: number, gender: Gender | null): number => {
    const weightKg = weightLbs * 0.453592;
    const heightCm = heightInches * 2.54;
    const genderOffset = gender === 'female' ? -161 : 5; // Default to male formula if unset
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + genderOffset);
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
    // FIX 19: Require gender to be set for personalized BMR — prevents biased defaults
    // Without gender, Mifflin-St Jeor would silently use male offset (+5), giving female users
    // targets that are 166 calories too high. Fall back to generic defaults instead.
    if (profile.weight_lbs && profile.height_inches && profile.age && profile.gender) {
        const bmr = calculateBMR(profile.weight_lbs, profile.height_inches, profile.age, profile.gender);
        const multiplier = ACTIVITY_MULTIPLIERS[profile.activity_level || 'moderately_active'];
        const tdee = Math.round(bmr * multiplier);
        const goalAdjustment = { CUT: -500, BULK: 300, RECOMP: 0 }[profile.goal || 'RECOMP'] || 0;
        // FIX 3.3: Enforce minimum calorie floor for safety
        const calories = Math.max(MIN_CALORIE_FLOOR, tdee + goalAdjustment);
        // Cap protein at 1g/lb up to 250g max (prevents excessive targets for heavy users)
        const protein = Math.min(profile.weight_lbs, 250);
        const fats = Math.round((calories * 0.25) / 9);
        const carbsRaw = Math.round((calories - protein * 4 - fats * 9) / 4);
        // FIX 22: Prevent negative carbs when calorie floor + high protein
        const carbs = Math.max(0, carbsRaw);

        return { calories, protein, carbs, fats };
    }
    return getDefaultTargets(profile.goal);
};

// Format date consistently for storage (local timezone, not UTC)
const formatDateForDB = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const [offlineQueueCount, setOfflineQueueCount] = useState<number>(() => getQueuedCount());

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

        try {
            // Fetch all data in parallel using supabaseGet (retry, timeout, dedup built-in)
            const profileFetch = supabaseGet<any[]>(
                `profiles?select=goal,onboarding_complete,height_inches,weight_lbs,age,gender,activity_level,training_experience,equipment_access,days_per_week,full_name,role,trainer_id&id=eq.${userId}`
            ).then(r => {
                if (r.data && Array.isArray(r.data) && r.data.length > 0) {
                    return { data: r.data[0], error: null };
                } else if (r.data && Array.isArray(r.data) && r.data.length === 0) {
                    return { data: null, error: { code: 'PGRST116', message: 'No rows returned' } };
                }
                return r;
            });

            const workoutsFetch = supabaseGet<any[]>(`workouts?select=*&user_id=eq.${userId}&order=date.desc&limit=50`);

            const nutritionFetch = supabaseGet<any[]>(`nutrition_logs?select=*&user_id=eq.${userId}&order=date.desc&limit=30`);

            const mealEntriesFetch = supabaseGet<any[]>(`meal_entries?select=*&user_id=eq.${userId}&order=created_at.desc&limit=100`);

            const favoritesFetch = supabaseGet<any[]>(`favorite_foods?select=*&user_id=eq.${userId}&order=times_logged.desc&limit=20`);

            const [profileResult, workoutsResult, nutritionResult, mealEntriesResult, favoritesResult] = await Promise.all([
                profileFetch, workoutsFetch, nutritionFetch, mealEntriesFetch, favoritesFetch
            ]) as [any, any, any, any, any];

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
                    gender: p.gender || null,
                    activity_level: p.activity_level || null,
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
                    rawDate: w.date,
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

            // Process meal entries - Bug #1 & #3 fix
            let mealEntries: MealEntry[] = [];
            if (mealEntriesResult.data && !mealEntriesResult.error) {
                mealEntries = mealEntriesResult.data.map((m: any) => ({
                    id: m.id,
                    user_id: m.user_id,
                    date: m.date,
                    meal_type: m.meal_type,
                    input_method: m.input_method,
                    description: m.description,
                    photo_url: m.photo_url,
                    calories: m.calories || 0,
                    protein: m.protein || 0,
                    carbs: m.carbs || 0,
                    fats: m.fats || 0,
                    created_at: m.created_at
                }));
            }

            // Process favorites - Bug #2 fix
            let favorites: FavoriteFood[] = [];
            if (favoritesResult.data && !favoritesResult.error) {
                favorites = favoritesResult.data.map((f: any) => ({
                    id: f.id,
                    user_id: f.user_id,
                    name: f.name,
                    calories: f.calories || 0,
                    protein: f.protein || 0,
                    carbs: f.carbs || 0,
                    fats: f.fats || 0,
                    times_logged: f.times_logged || 1,
                    created_at: f.created_at,
                    updated_at: f.updated_at
                }));
            }

            // Update state atomically
            if (isMountedRef.current && currentUserIdRef.current === userId) {
                setData({
                    profile,
                    goal,
                    onboardingComplete,
                    workouts,
                    nutritionLogs,
                    mealEntries,
                    favorites
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

        // FIX 23: Migrate legacy untagged offline queue entries to this user (one-time)
        migrateQueueUserId(user.id);
        migrateWorkoutQueueUserId(user.id);

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

    // Sync queued meals when coming back online
    useEffect(() => {
        if (!user) return;

        const syncQueued = async () => {
            const queue = getQueuedMeals();
            if (queue.length === 0) return;

            console.log(`[useUserData] Back online - syncing ${queue.length} queued meals`);
            const affectedDates = new Set<string>();

            for (const meal of queue) {
                if (meal.retryCount >= 3) {
                    console.warn(`[useUserData] Meal ${meal.id} exceeded max retries, removing`);
                    removeFromQueue(meal.id);
                    continue;
                }

                try {
                    // Use the stored date from when the meal was originally logged, or fall back to today
                    const mealDate = meal.payload.date || formatDateForDB();
                    const { data: savedData, error } = await supabaseInsert('meal_entries', {
                        user_id: user.id,
                        date: mealDate,
                        meal_type: meal.payload.mealType || null,
                        input_method: meal.payload.inputMethod || 'text',
                        description: meal.payload.description,
                        photo_url: meal.payload.photoUrl || null,
                        calories: meal.payload.calories,
                        protein: meal.payload.protein,
                        carbs: meal.payload.carbs,
                        fats: meal.payload.fats
                    });

                    if (!error) {
                        console.log(`[useUserData] Synced queued meal: ${meal.payload.description}`);
                        removeFromQueue(meal.id);
                        affectedDates.add(mealDate);

                        // Update local state with the synced entry's real ID
                        const realId = savedData && Array.isArray(savedData) && savedData[0]?.id
                            ? savedData[0].id
                            : meal.id;
                        setData(prev => ({
                            ...prev,
                            mealEntries: prev.mealEntries.map(m =>
                                m.id === meal.id ? { ...m, id: realId } : m
                            )
                        }));
                    } else {
                        console.error(`[useUserData] Failed to sync meal ${meal.id}:`, error);
                        incrementRetryCount(meal.id);
                    }
                } catch (err) {
                    console.error(`[useUserData] Error syncing meal ${meal.id}:`, err);
                    incrementRetryCount(meal.id);
                }
            }

            setOfflineQueueCount(getQueuedCount());

            // Persist nutrition_logs for dates that had meals synced
            // These were updated optimistically during offline save but the Supabase upsert failed
            // We fetch meal_entries from the DB directly to get authoritative totals
            if (affectedDates.size > 0) {
                console.log(`[useUserData] Persisting nutrition_logs for ${affectedDates.size} date(s)`);

                for (const date of affectedDates) {
                    try {
                        // Fetch all meal_entries for this date from DB (source of truth)
                        // Uses supabaseGet for retry, timeout, and fresh token per request
                        const { data: meals, error: fetchError } = await supabaseGet<{ calories: number; protein: number; carbs: number; fats: number }[]>(
                            `meal_entries?select=calories,protein,carbs,fats&user_id=eq.${user.id}&date=eq.${date}`,
                            { dedupe: false }
                        );

                        if (!fetchError && Array.isArray(meals)) {
                            const totals = meals.reduce(
                                (acc, m) => ({
                                    calories: acc.calories + (m.calories || 0),
                                    protein: acc.protein + (m.protein || 0),
                                    carbs: acc.carbs + (m.carbs || 0),
                                    fats: acc.fats + (m.fats || 0),
                                }),
                                { calories: 0, protein: 0, carbs: 0, fats: 0 }
                            );

                            await supabaseUpsert('nutrition_logs', {
                                user_id: user.id,
                                date,
                                ...totals
                            }, 'user_id,date');

                            // Also update local state to match
                            setData(prev => {
                                const existingIdx = prev.nutritionLogs.findIndex(l =>
                                    l.date === date || l.date.split('T')[0] === date
                                );
                                const updatedLog = { date, ...totals };
                                const newLogs = [...prev.nutritionLogs];
                                if (existingIdx >= 0) {
                                    newLogs[existingIdx] = updatedLog;
                                } else {
                                    newLogs.unshift(updatedLog);
                                }
                                return { ...prev, nutritionLogs: newLogs };
                            });

                            console.log(`[useUserData] Persisted nutrition_logs for ${date}:`, totals);
                        }
                    } catch (err) {
                        console.error(`[useUserData] Failed to persist nutrition_logs for ${date}:`, err);
                    }
                }
            }
        };

        // Register online listener
        const cleanup = onOnline(() => {
            syncQueued();
        });

        // Also try to sync on mount if online and there are queued meals
        if (navigator.onLine && hasQueuedMeals()) {
            syncQueued();
        }

        return cleanup;
    }, [user]);

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
    const updateGoal = useCallback(async (newGoal: string): Promise<boolean> => {
        if (!user) return false;

        const oldGoal = data.goal;

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
                setData(prev => ({
                    ...prev,
                    goal: oldGoal,
                    profile: { ...prev.profile, goal: oldGoal }
                }));
                return false;
            }
            return true;
        } catch {
            setData(prev => ({
                ...prev,
                goal: oldGoal,
                profile: { ...prev.profile, goal: oldGoal }
            }));
            return false;
        }
    }, [user, data.goal]);

    // Add workout - returns true if saved successfully, false otherwise
    const addWorkout = useCallback(async (title: string, exercises: any[], recoveryRating?: number): Promise<boolean> => {
        if (!user) return false;

        const newWorkout: CompletedWorkout = {
            date: formatDateForDisplay(new Date()),
            rawDate: new Date().toISOString(),
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
    const saveNutrition = useCallback(async (log: NutritionLog): Promise<boolean> => {
        if (!user) return false;

        // Normalize date format
        const normalizedDate = log.date.includes('T')
            ? log.date.split('T')[0]
            : log.date;

        const normalizedLog = { ...log, date: normalizedDate };

        // Capture previous state for revert
        const previousLogs = [...data.nutritionLogs];

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
            const { error } = await supabaseUpsert('nutrition_logs', {
                user_id: user.id,
                date: normalizedDate,
                calories: log.calories,
                protein: log.protein,
                carbs: log.carbs,
                fats: log.fats
            }, 'user_id,date');

            if (error) {
                console.error('[saveNutrition] Upsert error:', error);
                setData(prev => ({ ...prev, nutritionLogs: previousLogs }));
                return false;
            }
            return true;
        } catch {
            setData(prev => ({ ...prev, nutritionLogs: previousLogs }));
            return false;
        }
    }, [user, data.nutritionLogs]);

    // Add meal to daily totals
    // Uses functional setData updater to avoid stale closure over data.nutritionLogs.
    // Display is handled by computedNutritionLogs memo; this function only persists to DB.
    const addMealToDaily = useCallback(async (macros: { calories: number; protein: number; carbs: number; fats: number }) => {
        console.log('[addMealToDaily] Called with macros:', macros);
        if (!user) {
            console.error('[addMealToDaily] No user!');
            return;
        }

        const today = formatDateForDB();

        // Compute today's totals from the latest mealEntries (via functional updater to avoid stale closure)
        let updatedLog: NutritionLog | null = null;
        setData(prev => {
            const todayMeals = prev.mealEntries.filter(m => m.date === today);
            const totals = todayMeals.reduce(
                (acc, m) => ({
                    calories: acc.calories + (m.calories || 0),
                    protein: acc.protein + (m.protein || 0),
                    carbs: acc.carbs + (m.carbs || 0),
                    fats: acc.fats + (m.fats || 0),
                }),
                { calories: 0, protein: 0, carbs: 0, fats: 0 }
            );
            updatedLog = {
                date: today,
                calories: Math.round(totals.calories),
                protein: Math.round(totals.protein),
                carbs: Math.round(totals.carbs),
                fats: Math.round(totals.fats)
            };
            console.log('[addMealToDaily] Computed from mealEntries:', updatedLog);

            // Update nutritionLogs in state for DB persistence
            const existingIdx = prev.nutritionLogs.findIndex(l =>
                l.date === today || l.date.split('T')[0] === today
            );
            const newLogs = [...prev.nutritionLogs];
            if (existingIdx >= 0) {
                newLogs[existingIdx] = updatedLog!;
            } else {
                newLogs.unshift(updatedLog!);
            }
            return { ...prev, nutritionLogs: newLogs };
        });

        // Persist to DB (fire-and-forget for display; computedNutritionLogs handles UI)
        if (updatedLog) {
            try {
                const { error } = await supabaseUpsert('nutrition_logs', {
                    user_id: user.id,
                    date: today,
                    calories: updatedLog.calories,
                    protein: updatedLog.protein,
                    carbs: updatedLog.carbs,
                    fats: updatedLog.fats
                }, 'user_id,date');
                if (error) {
                    console.error('[addMealToDaily] DB upsert error:', error);
                }
            } catch (err) {
                console.error('[addMealToDaily] DB persist error:', err);
            }
        }
    }, [user]);

    // Save individual meal entry - Bug #1 fix + Offline queue support
    const saveMealEntry = useCallback(async (entry: {
        description: string;
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
        mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        inputMethod?: 'photo' | 'text' | 'quick_add';
        photoUrl?: string;
    }): Promise<MealEntry | null> => {
        console.log('[saveMealEntry] Called with:', entry);
        console.log('[saveMealEntry] User:', user?.id || 'null');
        if (!user) {
            console.error('[saveMealEntry] No user - cannot save!');
            return null;
        }

        const today = formatDateForDB();
        const now = new Date().toISOString();

        // Create optimistic entry
        const optimisticEntry: MealEntry = {
            id: crypto.randomUUID(),
            user_id: user.id,
            date: today,
            meal_type: entry.mealType || null,
            input_method: entry.inputMethod || 'text',
            description: entry.description,
            photo_url: entry.photoUrl || null,
            calories: entry.calories,
            protein: entry.protein,
            carbs: entry.carbs,
            fats: entry.fats,
            created_at: now
        };

        // Optimistic update - always apply immediately
        setData(prev => ({
            ...prev,
            mealEntries: [optimisticEntry, ...prev.mealEntries]
        }));

        // Check if offline - queue the meal instead of saving
        if (!navigator.onLine) {
            console.log('[saveMealEntry] Offline - queuing meal for later sync');
            queueMeal({
                description: entry.description,
                calories: entry.calories,
                protein: entry.protein,
                carbs: entry.carbs,
                fats: entry.fats,
                mealType: entry.mealType,
                inputMethod: entry.inputMethod,
                photoUrl: entry.photoUrl,
                date: today
            }, user.id);
            setOfflineQueueCount(getQueuedCount());
            // Still update daily totals locally
            await addMealToDaily({
                calories: entry.calories,
                protein: entry.protein,
                carbs: entry.carbs,
                fats: entry.fats
            });
            return optimisticEntry; // Return optimistic entry - will sync later
        }

        try {
            const { data: savedData, error } = await supabaseInsert('meal_entries', {
                user_id: user.id,
                date: today,
                meal_type: entry.mealType || null,
                input_method: entry.inputMethod || 'text',
                description: entry.description,
                photo_url: entry.photoUrl || null,
                calories: entry.calories,
                protein: entry.protein,
                carbs: entry.carbs,
                fats: entry.fats
            });

            console.log('[saveMealEntry] Supabase response:', { savedData, error });

            if (error) {
                console.error('[saveMealEntry] Database error:', error);
                // Check if it might be a network error (offline status can change)
                if (!navigator.onLine) {
                    console.log('[saveMealEntry] Network error - queuing meal');
                    queueMeal({
                        description: entry.description,
                        calories: entry.calories,
                        protein: entry.protein,
                        carbs: entry.carbs,
                        fats: entry.fats,
                        mealType: entry.mealType,
                        inputMethod: entry.inputMethod,
                        photoUrl: entry.photoUrl,
                        date: today
                    }, user.id);
                    setOfflineQueueCount(getQueuedCount());
                    await addMealToDaily({
                        calories: entry.calories,
                        protein: entry.protein,
                        carbs: entry.carbs,
                        fats: entry.fats
                    });
                    return optimisticEntry;
                }
                // Revert optimistic update on error (online but failed)
                setData(prev => ({
                    ...prev,
                    mealEntries: prev.mealEntries.filter(m => m.id !== optimisticEntry.id)
                }));
                return null;
            }

            console.log('[saveMealEntry] Saved successfully, updating daily totals...');
            // Also update daily totals
            await addMealToDaily({
                calories: entry.calories,
                protein: entry.protein,
                carbs: entry.carbs,
                fats: entry.fats
            });

            // Update with real ID from database if available
            if (savedData && Array.isArray(savedData) && savedData[0]?.id) {
                setData(prev => ({
                    ...prev,
                    mealEntries: prev.mealEntries.map(m =>
                        m.id === optimisticEntry.id ? { ...m, id: savedData[0].id } : m
                    )
                }));
                return { ...optimisticEntry, id: savedData[0].id };
            }

            return optimisticEntry;
        } catch (err) {
            console.error('[saveMealEntry] Error:', err);
            // On network error, queue for later
            if (!navigator.onLine) {
                console.log('[saveMealEntry] Caught error while offline - queuing meal');
                queueMeal({
                    description: entry.description,
                    calories: entry.calories,
                    protein: entry.protein,
                    carbs: entry.carbs,
                    fats: entry.fats,
                    mealType: entry.mealType,
                    inputMethod: entry.inputMethod,
                    photoUrl: entry.photoUrl,
                    date: today
                }, user.id);
                setOfflineQueueCount(getQueuedCount());
                await addMealToDaily({
                    calories: entry.calories,
                    protein: entry.protein,
                    carbs: entry.carbs,
                    fats: entry.fats
                });
                return optimisticEntry;
            }
            // Revert on error
            setData(prev => ({
                ...prev,
                mealEntries: prev.mealEntries.filter(m => m.id !== optimisticEntry.id)
            }));
            return null;
        }
    }, [user, addMealToDaily]);

    // Delete meal entry - Bug #4 fix
    // Uses functional setData updater to avoid stale closure over data.mealEntries.
    // Display updates instantly via computedNutritionLogs; DB persist is fire-and-forget.
    const deleteMealEntry = useCallback(async (entryId: string): Promise<boolean> => {
        if (!user) return false;

        // Use functional updater to find the entry and remove it atomically (avoids stale closure)
        let entryToDelete: MealEntry | undefined;
        setData(prev => {
            entryToDelete = prev.mealEntries.find(m => m.id === entryId);
            if (!entryToDelete) return prev;
            return {
                ...prev,
                mealEntries: prev.mealEntries.filter(m => m.id !== entryId)
            };
        });

        if (!entryToDelete) return false;

        try {
            const { error: deleteError } = await supabaseDelete(`meal_entries?id=eq.${entryId}`);

            if (deleteError) {
                // Revert on error
                setData(prev => ({
                    ...prev,
                    mealEntries: [entryToDelete!, ...prev.mealEntries]
                }));
                return false;
            }

            // Persist updated daily totals to nutrition_logs DB table
            // Display is already correct via computedNutritionLogs recomputing from mealEntries
            const entryDate = entryToDelete.date;
            setData(prev => {
                const remainingMeals = prev.mealEntries.filter(m => m.date === entryDate);
                const totals = remainingMeals.reduce(
                    (acc, m) => ({
                        calories: acc.calories + (m.calories || 0),
                        protein: acc.protein + (m.protein || 0),
                        carbs: acc.carbs + (m.carbs || 0),
                        fats: acc.fats + (m.fats || 0),
                    }),
                    { calories: 0, protein: 0, carbs: 0, fats: 0 }
                );
                const updatedLog: NutritionLog = {
                    date: entryDate,
                    calories: Math.round(totals.calories),
                    protein: Math.round(totals.protein),
                    carbs: Math.round(totals.carbs),
                    fats: Math.round(totals.fats)
                };
                const existingIdx = prev.nutritionLogs.findIndex(l =>
                    l.date === entryDate || l.date.split('T')[0] === entryDate
                );
                const newLogs = [...prev.nutritionLogs];
                if (existingIdx >= 0) {
                    newLogs[existingIdx] = updatedLog;
                } else {
                    newLogs.unshift(updatedLog);
                }

                // Fire-and-forget DB persist
                supabaseUpsert('nutrition_logs', {
                    user_id: user!.id,
                    date: entryDate,
                    ...totals
                }, 'user_id,date').catch(err => {
                    console.error('[deleteMealEntry] DB persist error:', err);
                });

                return { ...prev, nutritionLogs: newLogs };
            });

            return true;
        } catch {
            // Revert on error
            setData(prev => ({
                ...prev,
                mealEntries: [entryToDelete!, ...prev.mealEntries]
            }));
            return false;
        }
    }, [user]);

    // Add to favorites - Bug #7 fix
    const addToFavorites = useCallback(async (meal: {
        name: string;
        calories: number;
        protein: number;
        carbs: number;
        fats: number;
    }): Promise<boolean> => {
        if (!user) return false;

        const now = new Date().toISOString();

        // Check if already in favorites
        const existing = data.favorites.find(f =>
            f.name.toLowerCase() === meal.name.toLowerCase()
        );

        if (existing) {
            // Update times_logged
            setData(prev => ({
                ...prev,
                favorites: prev.favorites.map(f =>
                    f.id === existing.id
                        ? { ...f, times_logged: f.times_logged + 1, updated_at: now }
                        : f
                )
            }));

            try {
                await supabaseUpdate(
                    `favorite_foods?id=eq.${existing.id}`,
                    { times_logged: existing.times_logged + 1, updated_at: now }
                );
                return true;
            } catch {
                return false;
            }
        }

        // Create new favorite
        const optimisticFavorite: FavoriteFood = {
            id: crypto.randomUUID(),
            user_id: user.id,
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fats: meal.fats,
            times_logged: 1,
            created_at: now,
            updated_at: now
        };

        setData(prev => ({
            ...prev,
            favorites: [optimisticFavorite, ...prev.favorites]
        }));

        try {
            const { error } = await supabaseInsert('favorite_foods', {
                user_id: user.id,
                name: meal.name,
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fats: meal.fats,
                times_logged: 1
            });

            if (error) {
                setData(prev => ({
                    ...prev,
                    favorites: prev.favorites.filter(f => f.id !== optimisticFavorite.id)
                }));
                return false;
            }

            return true;
        } catch {
            setData(prev => ({
                ...prev,
                favorites: prev.favorites.filter(f => f.id !== optimisticFavorite.id)
            }));
            return false;
        }
    }, [user, data.favorites]);

    // Remove from favorites
    const removeFromFavorites = useCallback(async (favoriteId: string): Promise<boolean> => {
        if (!user) return false;

        const favoriteToRemove = data.favorites.find(f => f.id === favoriteId);
        if (!favoriteToRemove) return false;

        setData(prev => ({
            ...prev,
            favorites: prev.favorites.filter(f => f.id !== favoriteId)
        }));

        try {
            const { error: deleteError } = await supabaseDelete(`favorite_foods?id=eq.${favoriteId}`);

            if (deleteError) {
                setData(prev => ({
                    ...prev,
                    favorites: [favoriteToRemove, ...prev.favorites]
                }));
                return false;
            }

            return true;
        } catch {
            setData(prev => ({
                ...prev,
                favorites: [favoriteToRemove, ...prev.favorites]
            }));
            return false;
        }
    }, [user, data.favorites]);

    // Refetch profile (called after onboarding or Settings save)
    // FIX 26: Accept optional savedData for optimistic update (avoids stale read replica race)
    const refetchProfile = useCallback(async (savedData?: Partial<UserProfile>): Promise<boolean> => {
        if (!user) return false;

        // If caller provides saved data, apply it optimistically first
        if (savedData) {
            setData(prev => ({
                ...prev,
                goal: savedData.goal !== undefined ? savedData.goal : prev.goal,
                // Preserve existing onboardingComplete — don't force true from Settings save
                onboardingComplete: prev.onboardingComplete ?? true,
                profile: { ...prev.profile, ...savedData }
            }));
        } else {
            // Optimistically set onboarding complete
            setData(prev => ({
                ...prev,
                onboardingComplete: true
            }));
        }

        // Still fetch from DB to get authoritative state (may arrive after optimistic update)
        try {
            const { data: profile, error } = await supabaseGetSingle<any>(
                `profiles?id=eq.${user.id}&select=goal,onboarding_complete,height_inches,weight_lbs,age,gender,activity_level,training_experience,equipment_access,days_per_week,full_name,role,trainer_id`
            );

            if (error) {
                // If we had optimistic data, keep it; otherwise revert
                if (!savedData) {
                    setData(prev => ({ ...prev, onboardingComplete: false }));
                }
                return false;
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
                        gender: profile.gender || null,
                        activity_level: profile.activity_level || null,
                        training_experience: profile.training_experience,
                        equipment_access: profile.equipment_access,
                        days_per_week: profile.days_per_week,
                        role: profile.role || 'consumer',
                        trainer_id: profile.trainer_id,
                        full_name: profile.full_name
                    }
                }));
            }
            return true;
        } catch {
            if (!savedData) {
                setData(prev => ({ ...prev, onboardingComplete: false }));
            }
            return false;
        }
    }, [user]);

    // Computed values - memoize to prevent recalculation
    const nutritionTargets = useMemo(
        () => calculateNutritionTargets(data.profile),
        [data.profile.weight_lbs, data.profile.height_inches, data.profile.age, data.profile.goal, data.profile.gender, data.profile.activity_level]
    );

    // Single source of truth: compute daily nutrition totals from mealEntries.
    // This eliminates the stale-closure / async-pipeline bugs in the old addMealToDaily → saveNutrition chain.
    // DB-fetched nutritionLogs are preserved for historical dates that have no meal_entries.
    const computedNutritionLogs = useMemo<NutritionLog[]>(() => {
        // Group mealEntries by date and sum macros
        const mealTotalsByDate = new Map<string, NutritionLog>();
        for (const meal of data.mealEntries) {
            const date = meal.date.includes('T') ? meal.date.split('T')[0] : meal.date;
            const existing = mealTotalsByDate.get(date);
            if (existing) {
                existing.calories += meal.calories || 0;
                existing.protein += meal.protein || 0;
                existing.carbs += meal.carbs || 0;
                existing.fats += meal.fats || 0;
            } else {
                mealTotalsByDate.set(date, {
                    date,
                    calories: meal.calories || 0,
                    protein: meal.protein || 0,
                    carbs: meal.carbs || 0,
                    fats: meal.fats || 0
                });
            }
        }

        // Round computed values
        for (const log of mealTotalsByDate.values()) {
            log.calories = Math.round(log.calories);
            log.protein = Math.round(log.protein);
            log.carbs = Math.round(log.carbs);
            log.fats = Math.round(log.fats);
        }

        // Merge: computed values override DB values for dates with meal entries;
        // DB values preserved for historical dates without meal entries
        const merged = new Map<string, NutritionLog>();

        // Start with DB-fetched logs
        for (const log of data.nutritionLogs) {
            const date = log.date.includes('T') ? log.date.split('T')[0] : log.date;
            merged.set(date, { ...log, date });
        }

        // Override with computed-from-mealEntries (source of truth for dates with meals)
        for (const [date, log] of mealTotalsByDate) {
            merged.set(date, log);
        }

        // Sort descending by date
        return Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [data.mealEntries, data.nutritionLogs]);

    const loading = loadingState === 'loading' || loadingState === 'idle';

    return {
        // Data
        goal: data.goal,
        onboardingComplete: data.onboardingComplete,
        userProfile: data.profile,
        nutritionTargets,
        workouts: data.workouts,
        nutritionLogs: computedNutritionLogs,
        mealEntries: data.mealEntries,
        favorites: data.favorites,

        // State
        loading,
        loadingState,
        error,

        // Actions
        updateGoal,
        addWorkout,
        saveNutrition,
        addMealToDaily,
        saveMealEntry,
        deleteMealEntry,
        addToFavorites,
        removeFromFavorites,
        refetchProfile,
        retry
    };
};
