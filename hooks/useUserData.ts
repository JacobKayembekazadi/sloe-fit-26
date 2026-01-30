
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { CompletedWorkout, NutritionLog } from '../App';

// Nutrition targets based on user goal
export interface NutritionTargets {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
}

// Extended user profile with training preferences
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

// Activity multiplier for TDEE calculation
const ACTIVITY_MULTIPLIER = 1.55; // Moderate activity (3-5 days/week)

// Calculate BMR using Mifflin-St Jeor equation (assumes male for now)
const calculateBMR = (weightLbs: number, heightInches: number, age: number): number => {
    const weightKg = weightLbs * 0.453592;
    const heightCm = heightInches * 2.54;
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
};

// Get default targets based on goal only
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

// Calculate personalized targets based on user stats
export const calculateNutritionTargets = (profile: UserProfile): NutritionTargets => {
    // If user provided weight/height/age, calculate properly
    if (profile.weight_lbs && profile.height_inches && profile.age) {
        const bmr = calculateBMR(profile.weight_lbs, profile.height_inches, profile.age);
        const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER);
        const goalAdjustment = { CUT: -500, BULK: 300, RECOMP: 0 }[profile.goal || 'RECOMP'] || 0;
        const calories = tdee + goalAdjustment;
        const protein = profile.weight_lbs; // 1g per lb bodyweight
        const fats = Math.round((calories * 0.25) / 9); // 25% from fats
        const carbs = Math.round((calories - protein * 4 - fats * 9) / 4); // Remainder from carbs

        return { calories, protein, carbs, fats };
    }
    // Fallback to goal-based defaults
    return getDefaultTargets(profile.goal);
};

export const useUserData = () => {
    const { user } = useAuth();
    const [goal, setGoal] = useState<string | null>(null);
    const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile>({
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
    });
    const [workouts, setWorkouts] = useState<CompletedWorkout[]>([]);
    const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async () => {
        if (!user) return;
        try {
            // Single query for all profile fields
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('goal, onboarding_complete, height_inches, weight_lbs, age, training_experience, equipment_access, days_per_week, full_name, role, trainer_id')
                .eq('id', user.id)
                .single();

            if (error || !profile) {
                console.log('No profile found or error:', error);
                setOnboardingComplete(false);
                return;
            }

            // Set profile data
            setGoal(profile.goal);
            setOnboardingComplete(profile.onboarding_complete ?? false);
            setUserProfile({
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
            });
        } catch (err) {
            console.error('Error fetching profile:', err);
            setOnboardingComplete(false);
        }
    };

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // Timeout safeguard - never stay loading forever
        const timeout = setTimeout(() => {
            console.warn('useUserData timeout - forcing loading to false');
            setLoading(false);
            setOnboardingComplete(prev => prev ?? false);
        }, 8000);

        const fetchData = async () => {
            setLoading(true);
            try {
                // Run all queries in parallel for faster loading
                const [profileResult, workoutsResult, nutritionResult] = await Promise.all([
                    // Fetch Profile
                    fetchProfile().catch(err => {
                        console.error('Profile fetch failed:', err);
                        return null;
                    }),
                    // Fetch Workouts
                    supabase
                        .from('workouts')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('date', { ascending: false })
                        .then(({ data }) => data)
                        .catch(err => {
                            console.error('Workouts fetch failed:', err);
                            return null;
                        }),
                    // Fetch Nutrition
                    supabase
                        .from('nutrition_logs')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('date', { ascending: false })
                        .then(({ data }) => data)
                        .catch(err => {
                            console.error('Nutrition fetch failed:', err);
                            return null;
                        })
                ]);

                if (workoutsResult) {
                    const parsedWorkouts = workoutsResult.map((w: any) => ({
                        date: new Date(w.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        title: w.title,
                        log: Array.isArray(w.exercises) ? w.exercises : (w.exercises as any)?.exercises || []
                    }));
                    setWorkouts(parsedWorkouts);
                }

                if (nutritionResult) {
                    const parsedNutrition = nutritionResult.map((n: any) => ({
                        date: n.date,
                        calories: n.calories,
                        protein: n.protein,
                        carbs: n.carbs,
                        fats: n.fats
                    }));
                    setNutritionLogs(parsedNutrition);
                }

            } catch (error) {
                console.error('Error fetching user data:', error);
            } finally {
                clearTimeout(timeout);
                setLoading(false);
            }
        };

        fetchData();

        return () => clearTimeout(timeout);
    }, [user]);

    const updateGoal = async (newGoal: string) => {
        if (!user) return;
        setGoal(newGoal);
        setUserProfile(prev => ({ ...prev, goal: newGoal }));
        await supabase.from('profiles').update({ goal: newGoal }).eq('id', user.id);
    };

    const addWorkout = async (title: string, exercises: any[]) => {
        if (!user) return;

        // Optimistic update
        const newWorkout: CompletedWorkout = {
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            title,
            log: exercises
        };
        setWorkouts([newWorkout, ...workouts]);

        // DB Insert
        await supabase.from('workouts').insert({
            user_id: user.id,
            title,
            date: new Date().toISOString(),
            exercises: exercises
        });
    };

    const saveNutrition = async (log: NutritionLog) => {
        if (!user) return;

        // Optimistic Update
        const updatedLogs = [...nutritionLogs];
        const existingIndex = updatedLogs.findIndex(l => l.date === log.date);
        if (existingIndex >= 0) {
            updatedLogs[existingIndex] = log;
        } else {
            updatedLogs.push(log);
        }
        setNutritionLogs(updatedLogs);

        // DB Upsert (Insert or Update)
        // Check if exists for today
        const { data: existing } = await supabase
            .from('nutrition_logs')
            .select('id')
            .eq('user_id', user.id)
            .eq('date', log.date)
            .single();

        if (existing) {
            await supabase.from('nutrition_logs').update({
                calories: log.calories,
                protein: log.protein,
                carbs: log.carbs,
                fats: log.fats
            }).eq('id', existing.id);
        } else {
            await supabase.from('nutrition_logs').insert({
                user_id: user.id,
                date: log.date,
                calories: log.calories,
                protein: log.protein,
                carbs: log.carbs,
                fats: log.fats
            });
        }
    };

    // Add meal macros to today's daily totals
    const addMealToDaily = async (macros: { calories: number; protein: number; carbs: number; fats: number }) => {
        if (!user) return;

        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Find existing log for today or start from zero
        const existingLog = nutritionLogs.find(l => l.date === today);
        const updatedLog: NutritionLog = {
            date: today,
            calories: (existingLog?.calories || 0) + macros.calories,
            protein: (existingLog?.protein || 0) + macros.protein,
            carbs: (existingLog?.carbs || 0) + macros.carbs,
            fats: (existingLog?.fats || 0) + macros.fats
        };

        await saveNutrition(updatedLog);
    };

    const nutritionTargets = calculateNutritionTargets(userProfile);

    // Refetch profile after onboarding completes - optimistically set onboardingComplete
    const refetchProfile = async () => {
        // Optimistically set onboarding as complete to prevent loading loop
        setOnboardingComplete(true);
        try {
            await fetchProfile();
        } catch (err) {
            console.error('Error refetching profile:', err);
        }
    };

    return {
        goal,
        onboardingComplete,
        userProfile,
        nutritionTargets,
        workouts,
        nutritionLogs,
        loading,
        updateGoal,
        addWorkout,
        saveNutrition,
        addMealToDaily,
        refetchProfile
    };
};
