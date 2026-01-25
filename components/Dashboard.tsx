import React, { useState, useMemo, useCallback } from 'react';
import ProgressBar from './ProgressBar';
import MealIcon from './icons/MealIcon';
import CameraIcon from './icons/CameraIcon';
import ShopIcon from './icons/ShopIcon';
import CheckIcon from './icons/CheckIcon';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import ListIcon from './icons/ListIcon';
import LoaderIcon from './icons/LoaderIcon';
import { EXERCISE_LIST } from '../data/exercises';
import { getTodaysWorkout } from '../services/workoutService';
import { generateWorkout, GeneratedWorkout } from '../services/geminiService';
import RecoveryCheckIn, { RecoveryState } from './RecoveryCheckIn';
import type { ExerciseLog, NutritionLog, CompletedWorkout } from '../App';
import type { NutritionTargets, UserProfile } from '../hooks/useUserData';

type Tab = 'dashboard' | 'body' | 'meal' | 'mindset' | 'progress';

interface DashboardProps {
    setActiveTab: (tab: Tab) => void;
    addWorkoutToHistory: (log: ExerciseLog[], title: string) => void;
    showHistoryView: () => void;
    nutritionLog: NutritionLog[];
    saveNutritionLog: (data: NutritionLog) => void;
    nutritionTargets: NutritionTargets;
    goal: string | null;
    workoutHistory: CompletedWorkout[];
    userProfile?: UserProfile;
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, addWorkoutToHistory, showHistoryView, nutritionLog, saveNutritionLog, nutritionTargets, goal, workoutHistory, userProfile }) => {
    const [workoutStatus, setWorkoutStatus] = useState<'idle' | 'recovery' | 'generating' | 'logging' | 'saved' | 'rating' | 'completed'>('idle');
    const [activeSearch, setActiveSearch] = useState<number | null>(null);
    const [aiWorkout, setAiWorkout] = useState<GeneratedWorkout | null>(null);
    const [postWorkoutRating, setPostWorkoutRating] = useState<number>(3);

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

    const handleWorkoutChange = (id: number, field: keyof ExerciseLog, value: string) => {
        setWorkoutLog(currentLog =>
            currentLog.map(ex => ex.id === id ? { ...ex, [field]: value } : ex)
        );
    };

    const addExercise = () => {
        const newId = workoutLog.length > 0 ? Math.max(...workoutLog.map(ex => ex.id)) + 1 : 1;
        setWorkoutLog([...workoutLog, { id: newId, name: "", sets: "", reps: "", weight: "" }]);
    };

    const removeExercise = (id: number) => {
        setWorkoutLog(workoutLog.filter(ex => ex.id !== id));
    };

    const handleSaveProgress = () => {
        setWorkoutStatus('saved');
    };

    const handleEditWorkout = () => {
        setWorkoutStatus('logging');
    };

    const handleMarkComplete = () => {
        setWorkoutStatus('rating');
    };

    const handleSubmitRating = () => {
        addWorkoutToHistory(workoutLog, workoutTitle);
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
            days_per_week: 4
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
        }

        setWorkoutStatus('logging');
    }, [userProfile, goal, recentWorkouts, fallbackWorkout]);

    const skipRecoveryAndStart = () => {
        setWorkoutLog(fallbackWorkout.exercises);
        setWorkoutTitle(fallbackWorkout.title);
        setWorkoutStatus('logging');
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
                ) : (
                    // Active workout logging/saved/completed states
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-wide">Current Session</h3>
                                <p className="text-[var(--color-primary)] text-sm font-bold">{workoutTitle}</p>
                                {aiWorkout?.recovery_adjusted && (
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                        Recovery Adjusted
                                    </span>
                                )}
                            </div>
                            {workoutStatus === 'completed' && (
                                <div className="bg-green-500/20 text-green-400 p-2 rounded-full">
                                    <CheckIcon className="w-5 h-5" />
                                </div>
                            )}
                        </div>

                        {/* AI recovery notes */}
                        {aiWorkout?.recovery_notes && workoutStatus === 'logging' && (
                            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm">
                                {aiWorkout.recovery_notes}
                            </div>
                        )}

                        {workoutStatus === 'completed' ? (
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    {workoutLog.map(ex => ex.name && (
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
                        ) : (
                            <>
                                <div className="space-y-4 mb-6">
                                    {workoutLog.map((exercise) => {
                                        const filteredExercises = exercise.name ? EXERCISE_LIST.filter(ex =>
                                            ex.toLowerCase().includes(exercise.name.toLowerCase())
                                        ).slice(0, 5) : [];

                                        return (
                                            <div key={exercise.id} className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-3">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Exercise Name"
                                                        value={exercise.name}
                                                        onChange={(e) => {
                                                            handleWorkoutChange(exercise.id, 'name', e.target.value);
                                                            if (e.target.value) setActiveSearch(exercise.id);
                                                            else setActiveSearch(null);
                                                        }}
                                                        onFocus={() => { if (exercise.name) setActiveSearch(exercise.id) }}
                                                        onBlur={() => setTimeout(() => setActiveSearch(null), 150)}
                                                        disabled={workoutStatus !== 'logging'}
                                                        className="w-full bg-transparent text-white font-bold placeholder:text-gray-600 outline-none border-b border-white/10 focus:border-[var(--color-primary)] py-1 transition-colors"
                                                        autoComplete="off"
                                                    />
                                                    {activeSearch === exercise.id && filteredExercises.length > 0 && (
                                                        <div className="absolute top-full left-0 right-0 bg-[#2C2C2E] border border-white/10 rounded-b-md shadow-xl z-20 overflow-hidden">
                                                            {filteredExercises.map(name => (
                                                                <button
                                                                    key={name}
                                                                    type="button"
                                                                    className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                                                                    onClick={() => {
                                                                        handleWorkoutChange(exercise.id, 'name', name);
                                                                        setActiveSearch(null);
                                                                    }}
                                                                >
                                                                    {name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Sets</label>
                                                        <input type="text" placeholder="3" value={exercise.sets} onChange={(e) => handleWorkoutChange(exercise.id, 'sets', e.target.value)} disabled={workoutStatus !== 'logging'} className="w-full bg-transparent text-gray-300 text-sm font-medium outline-none border-b border-white/10 focus:border-white py-1 text-center" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Reps</label>
                                                        <input type="text" placeholder="10" value={exercise.reps} onChange={(e) => handleWorkoutChange(exercise.id, 'reps', e.target.value)} disabled={workoutStatus !== 'logging'} className="w-full bg-transparent text-gray-300 text-sm font-medium outline-none border-b border-white/10 focus:border-white py-1 text-center" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Lbs</label>
                                                        <input type="number" placeholder="45" value={exercise.weight} onChange={(e) => handleWorkoutChange(exercise.id, 'weight', e.target.value)} disabled={workoutStatus !== 'logging'} className="w-full bg-transparent text-gray-300 text-sm font-medium outline-none border-b border-white/10 focus:border-white py-1 text-center" />
                                                    </div>

                                                    {workoutStatus === 'logging' && (
                                                        <button onClick={() => removeExercise(exercise.id)} className="self-end p-2 text-gray-600 hover:text-red-500 transition-colors">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {workoutStatus === 'logging' && (
                                    <button onClick={addExercise} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide">
                                        <PlusIcon className="w-4 h-4" /> Add Exercise
                                    </button>
                                )}

                                <div className="pt-4 border-t border-white/5 mt-4">
                                    {workoutStatus === 'logging' && (
                                        <button onClick={handleSaveProgress} className="btn-secondary w-full mb-3">
                                            Save Progress
                                        </button>
                                    )}
                                    {workoutStatus === 'saved' && (
                                        <div className="flex flex-col gap-3">
                                            <button onClick={handleMarkComplete} className="btn-primary w-full shadow-lg">
                                                Finish Workout
                                            </button>
                                            <button onClick={handleEditWorkout} className="text-gray-400 text-sm font-medium py-2 hover:text-white transition-colors">
                                                Continue Editing
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setActiveTab('meal')} className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group">
                    <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                        <MealIcon className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white">Log Meal</span>
                </button>
                <button onClick={() => setActiveTab('progress')} className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group">
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
