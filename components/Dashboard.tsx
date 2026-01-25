import React, { useState, useMemo } from 'react';
import ProgressBar from './ProgressBar';
import MealIcon from './icons/MealIcon';
import CameraIcon from './icons/CameraIcon';
import ShopIcon from './icons/ShopIcon';
import CheckIcon from './icons/CheckIcon';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import ListIcon from './icons/ListIcon';
import { EXERCISE_LIST } from '../data/exercises';
import { getTodaysWorkout } from '../services/workoutService';
import type { ExerciseLog, NutritionLog, CompletedWorkout } from '../App';
import type { NutritionTargets } from '../hooks/useUserData';

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
}

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, addWorkoutToHistory, showHistoryView, nutritionLog, saveNutritionLog, nutritionTargets, goal, workoutHistory }) => {
    const [workoutStatus, setWorkoutStatus] = useState<'logging' | 'saved' | 'completed'>('logging');
    const [activeSearch, setActiveSearch] = useState<number | null>(null);

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

    // Get today's workout based on goal and rotation
    const todaysWorkout = useMemo(() => getTodaysWorkout(goal, workoutsThisWeek), [goal, workoutsThisWeek]);
    const [workoutLog, setWorkoutLog] = useState<ExerciseLog[]>(todaysWorkout.exercises);
    const workoutTitle = todaysWorkout.title;

    // Calculate current day in program (based on total workout history)
    const currentDay = Math.min(workoutHistory.length + 1, 30);

    // Get today's nutrition from log or use defaults
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const todayNutrition = nutritionLog.find(entry => entry.date === today) || {
        date: today,
        calories: 1875,
        protein: 140,
        carbs: 190,
        fats: 50
    };

    const nutritionData = {
        calories: { current: todayNutrition.calories, target: nutritionTargets.calories },
        protein: { current: todayNutrition.protein, target: nutritionTargets.protein },
        carbs: { current: todayNutrition.carbs, target: nutritionTargets.carbs },
    };

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
        console.log("Workout Progress Saved:", workoutLog);
        setWorkoutStatus('saved');
    };

    const handleEditWorkout = () => {
        setWorkoutStatus('logging');
    };

    const handleMarkComplete = () => {
        addWorkoutToHistory(workoutLog, workoutTitle);
        // Save today's nutrition when marking workout complete
        saveNutritionLog(todayNutrition);
        setWorkoutStatus('completed');
    };

    const startNewWorkout = () => {
        setWorkoutStatus('logging');
        setWorkoutLog(todaysWorkout.exercises);
    }


    return (
        <div className="w-full space-y-8 pb-8">
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
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white uppercase tracking-wide">Current Session</h3>
                        <p className="text-[var(--color-primary)] text-sm font-bold">{workoutTitle}</p>
                    </div>
                    {workoutStatus === 'completed' && (
                        <div className="bg-green-500/20 text-green-400 p-2 rounded-full">
                            <CheckIcon className="w-5 h-5" />
                        </div>
                    )}
                </div>

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

export default Dashboard;
