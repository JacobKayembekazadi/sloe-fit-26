import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import type { ExerciseLog } from '../App';
import RestTimer from './RestTimer';
import WorkoutSetsLogger from './WorkoutSetsLogger';

// -- Constants --

const DRAFT_STORAGE_KEY = 'sloefit_workout_draft';

// -- Interfaces --

interface SetData {
  id: number;
  reps: string;
  weight: string;
  completed: boolean;
  restStartTime?: number;
}

interface TrackedExercise {
  id: number;
  name: string;
  targetSets: number;
  targetReps: string;
  sets: SetData[];
  notes?: string;
}

export interface WorkoutDraft {
  exercises: TrackedExercise[];
  activeExerciseIndex: number;
  elapsedTime: number;
  workoutTitle: string;
  savedAt: number;
}

interface WorkoutSessionProps {
  initialExercises: ExerciseLog[];
  workoutTitle: string;
  onComplete: (exercises: ExerciseLog[], title: string) => void;
  onCancel: () => void;
  recoveryAdjusted?: boolean;
  recoveryNotes?: string;
}

// -- Main Component --

const WorkoutSession: React.FC<WorkoutSessionProps> = ({
  initialExercises,
  workoutTitle,
  onComplete,
  onCancel,
  recoveryAdjusted,
  recoveryNotes
}) => {
  // Helper to convert initial data
  const convertToTracked = (exercises: ExerciseLog[]): TrackedExercise[] => {
    return exercises.map((ex, i) => {
      const numSets = parseInt(ex.sets) || 3;
      const sets: SetData[] = Array.from({ length: numSets }, (_, j) => ({
        id: j + 1,
        reps: '',
        weight: ex.weight || '',
        completed: false
      }));
      return {
        id: ex.id || i + 1, // Fallback ID if missing
        name: ex.name,
        targetSets: numSets,
        targetReps: ex.reps,
        sets
      };
    });
  };

  // State
  const [exercises, setExercises] = useState<TrackedExercise[]>(convertToTracked(initialExercises));
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [workoutStartTime] = useState<number>(Date.now());
  const [isPaused, setIsPaused] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Rest Timer State
  const [restTimerOpen, setRestTimerOpen] = useState(false);
  const [restDuration, setRestDuration] = useState(90); // Default 90s

  // Memoized callbacks for RestTimer to prevent re-renders triggering setState during render
  const handleRestComplete = useCallback(() => setRestTimerOpen(false), []);
  const handleRestSkip = useCallback(() => setRestTimerOpen(false), []);
  const handleRestAdd = useCallback((s: number) => setRestDuration(prev => prev + s), []);
  const handleRestSubtract = useCallback((s: number) => setRestDuration(prev => Math.max(0, prev - s)), []);

  // Elapsed time tracker
  useEffect(() => {
    if (isPaused || restTimerOpen) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [workoutStartTime, isPaused, restTimerOpen]);

  // Autosave draft to localStorage
  useEffect(() => {
    // Don't save empty state
    if (exercises.length === 0) return;

    const draft: WorkoutDraft = {
      exercises,
      activeExerciseIndex,
      elapsedTime,
      workoutTitle,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // localStorage might be full or unavailable - fail silently
    }
  }, [exercises, activeExerciseIndex, elapsedTime, workoutTitle]);

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Derived State
  const activeExercise = exercises[activeExerciseIndex];

  // Calculate Progress
  const progress = useMemo(() => {
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);
    return totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  }, [exercises]);

  // -- Handlers --

  const handleUpdateSet = (setId: number, field: 'weight' | 'reps', value: string) => {
    setExercises(prev => {
      const newExercises = [...prev];
      const exercise = newExercises[activeExerciseIndex];
      const setIndex = exercise.sets.findIndex(s => s.id === setId);
      if (setIndex !== -1) {
        exercise.sets[setIndex] = { ...exercise.sets[setIndex], [field]: value };
      }
      return newExercises;
    });
  };

  const handleToggleSet = (setId: number) => {
    setExercises(prev => {
      const newExercises = [...prev];
      const exercise = newExercises[activeExerciseIndex];
      const setIndex = exercise.sets.findIndex(s => s.id === setId);

      if (setIndex !== -1) {
        const set = exercise.sets[setIndex];
        const newCompleted = !set.completed;
        exercise.sets[setIndex] = { ...set, completed: newCompleted };

        // Auto-trigger rest timer on completion
        if (newCompleted) {
          setRestTimerOpen(true);
        }
      }
      return newExercises;
    });
  };

  const handleAddSet = () => {
    setExercises(prev => prev.map((exercise, i) => {
      if (i !== activeExerciseIndex) return exercise;

      const newId = (exercise.sets.length > 0
        ? Math.max(...exercise.sets.map(s => s.id))
        : 0) + 1;
      const lastSet = exercise.sets[exercise.sets.length - 1];

      return {
        ...exercise,
        sets: [...exercise.sets, {
          id: newId,
          reps: '',
          weight: lastSet?.weight || '',
          completed: false
        }],
        targetSets: exercise.targetSets + 1
      };
    }));
  };

  const handleCancel = () => {
    const hasProgress = exercises.some(ex => ex.sets.some(s => s.completed));
    if (hasProgress) {
      setShowCancelConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleFinishWorkout = () => {
    // Clear the draft since workout is complete
    localStorage.removeItem(DRAFT_STORAGE_KEY);

    // Convert back to ExerciseLog format
    const completedLogs: ExerciseLog[] = exercises.map(ex => {
      const completedSets = ex.sets.filter(s => s.completed);
      const avgWeight = completedSets.length > 0
        ? Math.round(completedSets.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0) / completedSets.length)
        : 0;

      return {
        id: ex.id,
        name: ex.name,
        sets: String(completedSets.length),
        reps: completedSets.map(s => s.reps).join(', ') || ex.targetReps,
        weight: avgWeight > 0 ? String(avgWeight) : ''
      };
    }).filter(ex => parseInt(ex.sets) > 0); // Only include exercises with done sets? Or all? Usually all is safer for "skipped" tracking

    // If no sets completed, maybe include all but empty?
    // Let's include everything but with 0 sets if none are done
    const finalLogs = exercises.map(ex => {
      const s = ex.sets.filter(xs => xs.completed);
      // Use actual reps from completed sets, fallback to target if none recorded
      const actualReps = s.map(set => set.reps).filter(Boolean);
      return {
        id: ex.id,
        name: ex.name,
        sets: String(s.length),
        reps: actualReps.length > 0 ? actualReps.join(', ') : ex.targetReps,
        weight: s[0]?.weight || ''
      }
    });

    onComplete(finalLogs, workoutTitle);
  };

  return (
    <div className="flex flex-col min-h-screen h-dvh bg-background-dark font-display text-white overflow-hidden">

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a2e20] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-2">End Workout?</h3>
            <p className="text-slate-400 text-sm mb-6">You have unsaved progress. Are you sure you want to quit?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-600 font-bold text-sm"
              >
                Keep Going
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem(DRAFT_STORAGE_KEY);
                  onCancel();
                }}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {restTimerOpen && (
        <RestTimer
          initialTime={restDuration}
          onComplete={handleRestComplete}
          onSkip={handleRestSkip}
          onAdd={handleRestAdd}
          onSubtract={handleRestSubtract}
        />
      )}

      {/* Main Workout UI (hidden when rest timer is open) */}
      {!restTimerOpen && (
        <>
          {/* Compact Top Bar with Timer */}
          <div className="shrink-0 z-10 bg-background-dark border-b border-slate-800 pt-[env(safe-area-inset-top)]">
            <div className="flex items-center p-3 sm:p-4 justify-between">
              <button onClick={handleCancel} aria-label="Cancel workout" className="text-white flex size-12 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              {/* Compact Timer */}
              <div className="flex items-center gap-2 bg-[#223649] px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-sm">timer</span>
                <span className="text-sm font-bold tabular-nums">{formatTime(elapsedTime)}</span>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="ml-1 text-slate-500 hover:text-[var(--color-primary)] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">{isPaused ? 'play_arrow' : 'pause'}</span>
                </button>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[var(--color-primary)]">{progress}%</span>
              </div>
            </div>

            {/* Exercise Navigation */}
            <div className="flex items-center gap-2 px-3 sm:px-4 pb-3">
              <button
                onClick={() => activeExerciseIndex > 0 && setActiveExerciseIndex(prev => prev - 1)}
                disabled={activeExerciseIndex === 0}
                aria-label="Previous exercise"
                className="size-11 min-w-[44px] min-h-[44px] bg-[#223649] rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-[#2a435a] transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>

              <div className="flex-1 text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  Exercise {activeExerciseIndex + 1} of {exercises.length}
                </p>
              </div>

              <button
                onClick={() => activeExerciseIndex < exercises.length - 1 && setActiveExerciseIndex(prev => prev + 1)}
                disabled={activeExerciseIndex === exercises.length - 1}
                aria-label="Next exercise"
                className="size-11 min-w-[44px] min-h-[44px] bg-[#223649] rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-[#2a435a] transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="px-4 pb-3">
              <div className="rounded-full bg-[#223649] h-1 overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>

          {/* Main Content - Sets Logger */}
          <div className="flex-1 overflow-y-auto">
            <WorkoutSetsLogger
              exerciseName={activeExercise.name}
              sets={activeExercise.sets}
              targetReps={activeExercise.targetReps}
              onUpdateSet={handleUpdateSet}
              onToggleSet={handleToggleSet}
              onAddSet={handleAddSet}
            />
          </div>

          {/* Footer - Finish Workout Button */}
          <div className="shrink-0 bg-background-dark/95 backdrop-blur-md p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-slate-800">
            <div className="max-w-md mx-auto">
              <button
                onClick={handleFinishWorkout}
                aria-label="Finish workout"
                className="w-full bg-[var(--color-primary)] text-black font-bold py-4 rounded-xl shadow-lg shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-base flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <span className="material-symbols-outlined">check_circle</span>
                FINISH WORKOUT
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default memo(WorkoutSession);
