
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { CompletedWorkout, NutritionLog } from '../App';

export const useUserData = () => {
    const { user } = useAuth();
    const [goal, setGoal] = useState<string | null>(null);
    const [workouts, setWorkouts] = useState<CompletedWorkout[]>([]);
    const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Profile for Goal
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('goal')
                    .eq('id', user.id)
                    .single();
                if (profile) setGoal(profile.goal);

                // Fetch Workouts
                const { data: workoutData } = await supabase
                    .from('workouts')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('date', { ascending: false });

                if (workoutData) {
                    const parsedWorkouts = workoutData.map(w => ({
                        date: new Date(w.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        title: w.title,
                        log: Array.isArray(w.exercises) ? w.exercises : (w.exercises as any).exercises || [] // Handle potential JSON structure mismatch
                    }));
                    setWorkouts(parsedWorkouts);
                }

                // Fetch Nutrition
                const { data: nutritionData } = await supabase
                    .from('nutrition_logs')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('date', { ascending: false });

                if (nutritionData) {
                    const parsedNutrition = nutritionData.map(n => ({
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
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const updateGoal = async (newGoal: string) => {
        if (!user) return;
        setGoal(newGoal);
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

    return {
        goal,
        workouts,
        nutritionLogs,
        loading,
        updateGoal,
        addWorkout,
        saveNutrition
    };
};
