import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ProgressBar from './ProgressBar';
import MealIcon from './icons/MealIcon';
import CameraIcon from './icons/CameraIcon';
import ShopIcon from './icons/ShopIcon';
import CheckIcon from './icons/CheckIcon';
import ListIcon from './icons/ListIcon';
import LoaderIcon from './icons/LoaderIcon';
import { getTodaysWorkout } from '../services/workoutService';
import { generateWorkout, GeneratedWorkout } from '../services/openaiService';
import RecoveryCheckIn, { RecoveryState } from './RecoveryCheckIn';
import WorkoutSession from './WorkoutSession';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { ExerciseLog, NutritionLog, CompletedWorkout } from '../App';
import type { NutritionTargets, UserProfile } from '../hooks/useUserData';

type Tab = 'dashboard' | 'body' | 'meal' | 'mindset';

interface DashboardProps {
    setActiveTab: (tab: Tab) => void;
    addWorkoutToHistory: (log: ExerciseLog[], title: string) => void;
    showHistoryView: () => void;
    showTrainerView?: () => void;
    nutritionLog: NutritionLog[];
    saveNutritionLog: (data: NutritionLog) => void;
    nutritionTargets: NutritionTargets;
    goal: string | null;
    workoutHistory: CompletedWorkout[];
    userProfile?: UserProfile;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, addWorkoutToHistory, showHistoryView, showTrainerView, nutritionLog, saveNutritionLog, nutritionTargets, goal, workoutHistory, userProfile }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [workoutStatus, setWorkoutStatus] = useState<'idle' | 'recovery' | 'generating' | 'active' | 'rating' | 'completed'>('idle');
    const [aiWorkout, setAiWorkout] = useState<GeneratedWorkout | null>(null);
    const [postWorkoutRating, setPostWorkoutRating] = useState<number>(3);
    const [completedLog, setCompletedLog] = useState<ExerciseLog[]>([]);
    const [pendingWorkoutsCount, setPendingWorkoutsCount] = useState(0);
    const [trainerName, setTrainerName] = useState<string | null>(null);

    // Fetch pending workouts count for clients with trainers
    useEffect(() => {
        const fetchTrainerData = async () => {
            if (!user || !userProfile?.trainer_id) return;

            try {
                // Fetch pending workouts count
                const { count } = await supabase
                    .from('assigned_workouts')
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', user.id)
                    .eq('status', 'pending');

                setPendingWorkoutsCount(count || 0);

                // Fetch trainer name
                const { data: trainerData } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', userProfile.trainer_id)
                    .single();

                if (trainerData) {
                    setTrainerName(trainerData.full_name);
                }
            } catch (err) {
                console.log('Could not fetch trainer data:', err);
                // Don't show toast - optional feature that may not be set up
            }
        };

        fetchTrainerData();
    }, [user, userProfile?.trainer_id]);

    // Calculate workouts completed this week for rotation
    const workoutsThisWeek = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0, 0, 0, 0);

        return workoutHistory.filter(w => {
            const workoutDate = new Date(w.date);
            return workoutDate >= startOfWeek;
        }).length;
    }, [workoutHistory]);

    // Get fallback workout if AI is not used
    const fallbackWorkout = useMemo(() => getTodaysWorkout(goal, workoutsThisWeek), [goal, workoutsThisWeek]);

    // Convert AI workout to exercise log format
    const aiWorkoutToExerciseLog = (workout: GeneratedWorkout): ExerciseLog[] => {
        return workout.exercises.map((ex, idx) => ({
            id: idx + 1,
            name: ex.name,
            sets: String(ex.sets),
            reps: ex.reps,
            weight: ''
        }));
    };

    const [workoutLog, setWorkoutLog] = useState<ExerciseLog[]>(fallbackWorkout.exercises);
    const [workoutTitle, setWorkoutTitle] = useState<string>(fallbackWorkout.title);

    // Calculate current day in program (based on total workout history)
    const currentDay = Math.min(workoutHistory.length + 1, 30);

    // Get today's nutrition from log or use defaults
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const todayNutrition = nutritionLog.find(entry => entry.date === today) || {
        date: today,
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0
    };

    const nutritionData = {
        calories: { current: todayNutrition.calories, target: nutritionTargets.calories },
        protein: { current: todayNutrition.protein, target: nutritionTargets.protein },
        carbs: { current: todayNutrition.carbs, target: nutritionTargets.carbs },
    };

    // Get recent workouts for AI context
    const recentWorkouts = useMemo(() => {
        return workoutHistory.slice(0, 3).map(w => ({
            title: w.title,
            date: w.date,
            muscles: extractMuscleGroups(w.title)
        }));
    }, [workoutHistory]);

    // Handle workout completion from WorkoutSession
    const handleWorkoutComplete = (exercises: ExerciseLog[], title: string) => {
        setCompletedLog(exercises);
        setWorkoutTitle(title);
        setWorkoutStatus('rating');
    };

    // Handle cancel from WorkoutSession
    const handleWorkoutCancel = () => {
        setWorkoutStatus('idle');
        setAiWorkout(null);
    };

    const handleSubmitRating = () => {
        addWorkoutToHistory(completedLog, workoutTitle);
        saveNutritionLog(todayNutrition);
        setWorkoutStatus('completed');
    };

    const startNewWorkout = () => {
        setWorkoutStatus('recovery');
        setAiWorkout(null);
    };

    const handleRecoveryComplete = useCallback(async (recovery: RecoveryState) => {
        setWorkoutStatus('generating');

        // Build profile for AI
        const profile: UserProfile = userProfile || {
            goal: goal,
            height_inches: null,
            weight_lbs: null,
            age: null,
            training_experience: 'beginner',
            equipment_access: 'gym',
            days_per_week: 4,
            role: 'consumer',
            trainer_id: null,
            full_name: null
        };

        try {
            const workout = await generateWorkout({
                profile,
                recovery,
                recentWorkouts
            });

            if (workout) {
                setAiWorkout(workout);
                setWorkoutLog(aiWorkoutToExerciseLog(workout));
                setWorkoutTitle(workout.title);
            } else {
                // Fallback to static workout
                setWorkoutLog(fallbackWorkout.exercises);
                setWorkoutTitle(fallbackWorkout.title);
            }
        } catch (error) {
            console.error('Error generating workout:', error);
            setWorkoutLog(fallbackWorkout.exercises);
            setWorkoutTitle(fallbackWorkout.title);
            showToast('Using fallback workout - AI unavailable', 'info');
        }

        setWorkoutStatus('active');
    }, [userProfile, goal, recentWorkouts, fallbackWorkout]);

    const skipRecoveryAndStart = () => {
        setWorkoutLog(fallbackWorkout.exercises);
        setWorkoutTitle(fallbackWorkout.title);
        setWorkoutStatus('active');
    };

    return (
        <div className="w-full space-y-8 pb-8">
            {/* Recovery Check-In Modal */}
            {workoutStatus === 'recovery' && (
                <RecoveryCheckIn
                    onComplete={handleRecoveryComplete}
                    isLoading={false}
                />
            )}

            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter">TODAY</h2>
                    <p className="text-gray-400 text-sm font-medium">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-[var(--color-primary)] font-bold text-xl">Day {currentDay}</span>
                    <span className="text-white/50 text-xs block">of 30</span>
                </div>
            </header>

            {/* Nutrition Card */}
            <div className="card">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <MealIcon className="w-5 h-5 text-[var(--color-primary)]" /> NUTRITION
                    </h3>
                </div>
                <div className="space-y-6">
                    <ProgressBar label="Calories" currentValue={nutritionData.calories.current} targetValue={nutritionData.calories.target} unit="kcal" />
                    <div className="grid grid-cols-2 gap-4">
                        <ProgressBar label="Protein" currentValue={nutritionData.protein.current} targetValue={nutritionData.protein.target} unit="g" />
                        <ProgressBar label="Carbs" currentValue={nutritionData.carbs.current} targetValue={nutritionData.carbs.target} unit="g" />
                    </div>
                </div>
            </div>

            {/* Workout Section */}
            <div className="card">
                {workoutStatus === 'idle' ? (
                    // No workout started yet
                    <div className="py-8 text-center">
                        <div className="mb-6">
                            <div className="w-16 h-16 mx-auto bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center mb-4">
                                <span className="text-3xl">💪</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Ready to Train?</h3>
                            <p className="text-gray-400 text-sm">AI will generate a workout based on your recovery</p>
                        </div>
                        <button onClick={startNewWorkout} className="btn-primary w-full">
                            Start Today's Workout
                        </button>
                        <button onClick={skipRecoveryAndStart} className="text-gray-500 text-sm mt-3 hover:text-white transition-colors">
                            Skip recovery check
                        </button>
                    </div>
                ) : workoutStatus === 'generating' ? (
                    // AI is generating workout
                    <div className="py-12 text-center">
                        <LoaderIcon className="w-12 h-12 text-[var(--color-primary)] animate-spin mx-auto mb-4" />
                        <p className="text-xl font-black text-white animate-pulse">GENERATING WORKOUT...</p>
                        <p className="text-gray-400 text-sm mt-2">Personalizing based on your recovery</p>
                    </div>
                ) : workoutStatus === 'rating' ? (
                    // Post-workout rating
                    <div className="py-8 text-center space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">How was that workout?</h3>
                            <p className="text-gray-400 text-sm">This helps AI optimize future sessions</p>
                        </div>

                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map(rating => (
                                <button
                                    key={rating}
                                    onClick={() => setPostWorkoutRating(rating)}
                                    className={`w-14 h-14 rounded-xl border-2 transition-all font-bold text-lg ${
                                        postWorkoutRating === rating
                                            ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)] text-[var(--color-primary)]'
                                            : 'bg-gray-800/50 border-gray-700 text-gray-400'
                                    }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>

                        <div className="text-sm text-gray-500">
                            {postWorkoutRating <= 2 ? "That's okay - we'll adjust next time" :
                             postWorkoutRating === 3 ? "Solid effort!" :
                             "Great session!"}
                        </div>

                        <button onClick={handleSubmitRating} className="btn-primary w-full">
                            Submit & Complete
                        </button>
                    </div>
                ) : workoutStatus === 'active' ? (
                    // Active workout with WorkoutSession component
                    <WorkoutSession
                        initialExercises={workoutLog}
                        workoutTitle={workoutTitle}
                        onComplete={handleWorkoutComplete}
                        onCancel={handleWorkoutCancel}
                        recoveryAdjusted={aiWorkout?.recovery_adjusted}
                        recoveryNotes={aiWorkout?.recovery_notes}
                    />
                ) : workoutStatus === 'completed' ? (
                    // Workout completed summary
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wide">Workout Complete!</h3>
                                <p className="text-[var(--color-primary)] text-sm font-bold">{workoutTitle}</p>
                            </div>
                            <div className="bg-green-500/20 text-green-400 p-2 rounded-full">
                                <CheckIcon className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {completedLog.map(ex => ex.name && (
                                <div key={ex.id} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                                    <span className="font-medium text-white">{ex.name}</span>
                                    <span className="text-gray-400 text-sm">
                                        {ex.sets} × {ex.reps} {ex.weight && `@ ${ex.weight} lbs`}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 flex flex-col gap-3">
                            <button onClick={showHistoryView} className="btn-secondary w-full flex items-center justify-center gap-2">
                                <ListIcon className="w-5 h-5" /> View History
                            </button>
                            <button onClick={startNewWorkout} className="text-gray-400 text-sm font-medium py-2 hover:text-white transition-colors">
                                Start New Workout
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Trainer Card (for clients with trainers) */}
            {userProfile?.trainer_id && showTrainerView && (
                <button
                    onClick={showTrainerView}
                    className="card flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/30 to-purple-600/20 border-purple-500/30 hover:border-purple-500/50 transition-all hover:scale-[1.02]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-white">My Trainer</h4>
                            <p className="text-sm text-gray-400">{trainerName || 'Your Coach'}</p>
                            {pendingWorkoutsCount > 0 && (
                                <p className="text-xs text-yellow-400 mt-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                                    {pendingWorkoutsCount} workout{pendingWorkoutsCount > 1 ? 's' : ''} assigned
                                </p>
                            )}
                        </div>
                    </div>
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setActiveTab('meal')} className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group">
                    <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                        <MealIcon className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white">Log Meal</span>
                </button>
                <button onClick={() => setActiveTab('body')} className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group">
                    <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                        <CameraIcon className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white">Check In</span>
                </button>
            </div>

            <a href="https://sloe-fit.com" target="_blank" rel="noopener noreferrer" className="card flex items-center justify-between p-4 bg-gradient-to-r from-[var(--bg-card)] to-[var(--color-primary)]/10 border-0 hover:scale-[1.02]">
                <div className="flex items-center gap-4">
                    <div className="bg-[var(--color-primary)] text-black p-2 rounded-lg">
                        <ShopIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-white">Supplements</h4>
                        <p className="text-xs text-[var(--color-primary)]">Restock & Fuel Up</p>
                    </div>
                </div>
                <div className="text-gray-400">→</div>
            </a>
        </div>
    );
};

// Helper function to extract muscle groups from workout title
function extractMuscleGroups(title: string): string[] {
    const titleLower = title.toLowerCase();
    const muscles: string[] = [];

    if (titleLower.includes('push') || titleLower.includes('chest')) muscles.push('chest', 'shoulders', 'triceps');
    if (titleLower.includes('pull') || titleLower.includes('back')) muscles.push('back', 'biceps');
    if (titleLower.includes('leg') || titleLower.includes('lower')) muscles.push('legs', 'glutes');
    if (titleLower.includes('upper')) muscles.push('chest', 'back', 'shoulders', 'arms');
    if (titleLower.includes('full body')) muscles.push('chest', 'back', 'legs', 'shoulders');
    if (titleLower.includes('arm')) muscles.push('biceps', 'triceps');
    if (titleLower.includes('shoulder')) muscles.push('shoulders');
    if (titleLower.includes('core')) muscles.push('core');

    return muscles.length > 0 ? muscles : ['full body'];
}

export default Dashboard;
