import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
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
import WorkoutSession, { WorkoutDraft } from './WorkoutSession';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import type { ExerciseLog, NutritionLog, CompletedWorkout } from '../App';
import type { NutritionTargets, UserProfile } from '../hooks/useUserData';
import WorkoutPreview from './WorkoutPreview';
import WorkoutSummary from './WorkoutSummary';

const DRAFT_STORAGE_KEY = 'sloefit_workout_draft';

type Tab = 'dashboard' | 'history' | 'body' | 'meal' | 'mindset';

interface DashboardProps {
    setActiveTab: (tab: Tab) => void;
    addWorkoutToHistory: (log: ExerciseLog[], title: string, rating?: number) => Promise<boolean>;
    showHistoryView: () => void;
    showTrainerView?: () => void;
    nutritionLog: NutritionLog[];
    saveNutritionLog: (data: NutritionLog) => void;
    nutritionTargets: NutritionTargets;
    goal: string | null;
    workoutHistory: CompletedWorkout[];
    userProfile?: UserProfile;
}

// Helper to format time ago
const formatTimeAgo = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
};

const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, addWorkoutToHistory, showHistoryView, showTrainerView, nutritionLog, saveNutritionLog, nutritionTargets, goal, workoutHistory, userProfile }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    // Added 'preview' to status
    const [workoutStatus, setWorkoutStatus] = useState<'idle' | 'recovery' | 'generating' | 'preview' | 'active' | 'completed'>('idle');
    const [aiWorkout, setAiWorkout] = useState<GeneratedWorkout | null>(null);
    const [postWorkoutRating, setPostWorkoutRating] = useState<number>(3); // Keep for internal tracking
    const [completedLog, setCompletedLog] = useState<ExerciseLog[]>([]);
    const [pendingWorkoutsCount, setPendingWorkoutsCount] = useState(0);
    const [trainerName, setTrainerName] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [recoveryDraft, setRecoveryDraft] = useState<WorkoutDraft | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Check for draft workout on mount
    useEffect(() => {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved && workoutStatus === 'idle') {
            try {
                const draft: WorkoutDraft = JSON.parse(saved);
                const ageMinutes = (Date.now() - draft.savedAt) / 60000;

                if (ageMinutes < 120) {  // Less than 2 hours old
                    setRecoveryDraft(draft);
                } else {
                    // Too old, discard
                    localStorage.removeItem(DRAFT_STORAGE_KEY);
                }
            } catch {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            }
        }
    }, [workoutStatus]);

    // Fetch pending workouts count for clients with trainers - PARALLELIZED
    useEffect(() => {
        const fetchTrainerData = async () => {
            if (!user || !userProfile?.trainer_id) return;

            try {
                // Run both queries in parallel instead of sequentially
                const [pendingResult, trainerResult] = await Promise.all([
                    supabase
                        .from('assigned_workouts')
                        .select('*', { count: 'exact', head: true })
                        .eq('client_id', user.id)
                        .eq('status', 'pending'),
                    supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', userProfile.trainer_id)
                        .single()
                ]);

                setPendingWorkoutsCount(pendingResult.count || 0);

                if (trainerResult.data) {
                    setTrainerName(trainerResult.data.full_name);
                }
            } catch {
                // Optional feature - trainer data may not be set up
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
        setEndTime(Date.now());
        setWorkoutStatus('completed');
    };

    // Handle cancel from WorkoutSession
    const handleWorkoutCancel = () => {
        setWorkoutStatus('idle');
        setAiWorkout(null);
    };

    const handleRateWorkout = async (rating: number) => {
        setPostWorkoutRating(rating);
        setIsSaving(true);

        // Pass rating to save function
        const saved = await addWorkoutToHistory(completedLog, workoutTitle, rating);
        saveNutritionLog(todayNutrition);

        setIsSaving(false);

        if (saved) {
            showToast('Workout Saved!', 'success');
            setWorkoutStatus('idle');
        } else {
            showToast('Failed to save workout. Please try again.', 'error');
            // DON'T close modal - let user retry
        }
    };

    const handleResumeDraft = () => {
        if (!recoveryDraft) return;

        // Convert draft exercises to ExerciseLog format for WorkoutSession
        const exerciseLogs: ExerciseLog[] = recoveryDraft.exercises.map(ex => ({
            id: ex.id,
            name: ex.name,
            sets: String(ex.targetSets),
            reps: ex.targetReps,
            weight: ex.sets[0]?.weight || ''
        }));

        setWorkoutLog(exerciseLogs);
        setWorkoutTitle(recoveryDraft.workoutTitle);
        setRecoveryDraft(null);
        setWorkoutStatus('active');
    };

    const handleDiscardDraft = () => {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setRecoveryDraft(null);
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
            setWorkoutLog(fallbackWorkout.exercises);
            setWorkoutTitle(fallbackWorkout.title);
            showToast('Using fallback workout - AI unavailable', 'info');
        }

        // Show Preview instead of going straight to active
        setWorkoutStatus('preview');
    }, [userProfile, goal, recentWorkouts, fallbackWorkout]);

    const skipRecoveryAndStart = () => {
        setWorkoutLog(fallbackWorkout.exercises);
        setWorkoutTitle(fallbackWorkout.title);
        setWorkoutStatus('preview');
    };

    const handleStartFromPreview = () => {
        setStartTime(Date.now());
        setWorkoutStatus('active');
    };

    const calculateVolume = (logs: ExerciseLog[]) => {
        return logs.reduce((acc, log) => {
            const weight = parseFloat(log.weight) || 0;
            const sets = parseInt(log.sets) || 0;
            // Assuming 10 reps average if not specified for volume calc approximation
            // Parse reps string "8-12" -> 10
            const repsStr = log.reps.split('-')[0];
            const reps = parseInt(repsStr) || 10;
            return acc + (weight * sets * reps);
        }, 0);
    };

    const getDurationString = () => {
        const diff = (endTime - startTime) / 1000 / 60; // minutes
        const hrs = Math.floor(diff / 60);
        const mins = Math.floor(diff % 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <div className="w-full space-y-8 pb-8">
            {/* Draft Recovery Modal */}
            {recoveryDraft && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4">
                    <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-gray-700">
                        <div className="text-center mb-4">
                            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">💪</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Resume Workout?</h3>
                            <p className="text-gray-400 text-sm">
                                You have an unfinished <span className="text-white font-medium">{recoveryDraft.workoutTitle}</span> from {formatTimeAgo(recoveryDraft.savedAt)}.
                            </p>
                            <p className="text-gray-500 text-xs mt-2">
                                {recoveryDraft.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)} sets completed
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDiscardDraft}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleResumeDraft}
                                className="flex-1 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-black font-bold transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                            >
                                Resume
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recovery Check-In Modal */}
            {workoutStatus === 'recovery' && (
                <RecoveryCheckIn
                    onComplete={handleRecoveryComplete}
                    isLoading={false}
                />
            )}

            {/* Full Screen Overlays */}
            {workoutStatus === 'preview' && (
                <div className="fixed inset-0 z-[60] overflow-y-auto bg-background-dark">
                    <WorkoutPreview
                        title={workoutTitle}
                        duration={45} // Estimate
                        difficulty="Intermediate"
                        description={aiWorkout?.recovery_notes || "A balanced session targeting hypertrophy."}
                        exercises={workoutLog.map(ex => ({
                            name: ex.name,
                            sets: parseInt(ex.sets),
                            reps: ex.reps
                        }))}
                        onStart={handleStartFromPreview}
                        onBack={() => setWorkoutStatus('idle')}
                    />
                </div>
            )}

            {workoutStatus === 'active' && (
                <div className="fixed inset-0 z-[60] overflow-hidden bg-background-dark">
                    <WorkoutSession
                        initialExercises={workoutLog}
                        workoutTitle={workoutTitle}
                        onComplete={handleWorkoutComplete}
                        onCancel={handleWorkoutCancel}
                        recoveryAdjusted={aiWorkout?.recovery_adjusted}
                        recoveryNotes={aiWorkout?.recovery_notes}
                    />
                </div>
            )}

            {workoutStatus === 'completed' && (
                <div className="fixed inset-0 z-[60] overflow-y-auto bg-background-dark">
                    <WorkoutSummary
                        duration={getDurationString()}
                        volume={calculateVolume(completedLog)}
                        exercisesCount={completedLog.length}
                        onShare={() => showToast('Shared to feed!', 'success')}
                        onClose={() => handleRateWorkout(3)} // Default rating if closed without rating
                        onRate={handleRateWorkout}
                        onViewHistory={async () => {
                            await handleRateWorkout(3); // Save with default rating
                            showHistoryView(); // Then navigate to history
                        }}
                        isSaving={isSaving}
                    />
                </div>
            )}

            {/* Standard Dashboard Content (Hidden when in modal mode, or just don't render?) */}
            {/* We will conditionally render the Dashboard content only when status is idle/generating/recovery(modal) */}

            {['idle', 'recovery', 'generating'].includes(workoutStatus) && (
                <>
                    <header className="flex justify-between items-end">
                        <div>
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter">TODAY</h2>
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
                    {/* ... (Existing Nutrition Card Code) ... */}
                    <div className="card">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <MealIcon className="w-5 h-5 text-[var(--color-primary)]" /> NUTRITION
                            </h3>
                        </div>
                        <div className="space-y-6">
                            <ProgressBar label="Calories" currentValue={nutritionData.calories.current} targetValue={nutritionData.calories.target} unit="kcal" />
                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
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
                                <button onClick={startNewWorkout} className="btn-primary w-full focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1C1E]">
                                    Start Today's Workout
                                </button>
                                <button onClick={skipRecoveryAndStart} className="text-gray-500 text-sm mt-3 hover:text-white transition-colors focus-visible:text-white focus-visible:underline">
                                    Skip recovery check
                                </button>
                            </div>
                        ) : workoutStatus === 'generating' ? (
                            // AI is generating workout
                            <div className="py-12 text-center">
                                <LoaderIcon className="w-12 h-12 text-[var(--color-primary)] animate-spin motion-reduce:animate-none mx-auto mb-4" />
                                <p className="text-xl font-black text-white animate-pulse motion-reduce:animate-none">GENERATING WORKOUT...</p>
                                <p className="text-gray-400 text-sm mt-2">Personalizing based on your recovery</p>
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
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                        <button
                            onClick={() => setActiveTab('meal')}
                            aria-label="Log a meal"
                            className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group touch-manipulation focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset"
                        >
                            <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                                <MealIcon className="w-6 h-6" aria-hidden="true" />
                            </div>
                            <span className="font-bold text-sm text-gray-300 group-hover:text-white">Log Meal</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('body')}
                            aria-label="Body check-in with camera"
                            className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group touch-manipulation focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset"
                        >
                            <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                                <CameraIcon className="w-6 h-6" aria-hidden="true" />
                            </div>
                            <span className="font-bold text-sm text-gray-300 group-hover:text-white">Check In</span>
                        </button>
                    </div>

                    <a href="https://sloe-fit.com" target="_blank" rel="noopener noreferrer" className="card flex items-center justify-between p-4 bg-gradient-to-r from-[var(--bg-card)] to-[var(--color-primary)]/10 border-0 hover:scale-[1.02] touch-manipulation focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset">
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
                </>
            )}
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

export default memo(Dashboard);
