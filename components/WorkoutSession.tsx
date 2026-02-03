import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EXERCISE_LIST } from '../data/exercises';
import CheckIcon from './icons/CheckIcon';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import type { ExerciseLog } from '../App';

// Exercise categories for better selection UI
const EXERCISE_CATEGORIES = {
  Chest: [
    "Barbell Bench Press", "Dumbbell Bench Press", "Incline Barbell Bench Press",
    "Incline Dumbbell Bench Press", "Decline Barbell Bench Press", "Decline Dumbbell Bench Press",
    "Push-ups", "Dips", "Cable Crossover", "Dumbbell Flyes", "Machine Chest Press", "Pec Deck Machine"
  ],
  Back: [
    "Deadlift", "Bent-Over Barbell Row", "Dumbbell Row", "T-Bar Row", "Pull-ups", "Chin-ups",
    "Lat Pulldown", "Seated Cable Row", "Face Pulls", "Good Mornings", "Back Extensions"
  ],
  Shoulders: [
    "Overhead Press (Barbell)", "Seated Dumbbell Press", "Arnold Press", "Lateral Raises (Dumbbell)",
    "Front Raises (Dumbbell)", "Bent-Over Dumbbell Reverse Flyes", "Upright Row", "Shrugs (Barbell/Dumbbell)"
  ],
  Legs: [
    "Squat (Barbell)", "Front Squat (Barbell)", "Leg Press", "Lunges (Dumbbell/Barbell)",
    "Romanian Deadlift", "Leg Curls", "Leg Extensions", "Goblet Squat", "Calf Raises"
  ],
  Arms: [
    "Barbell Curl", "Dumbbell Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl", "Cable Curl",
    "Tricep Pushdown", "Skull Crushers", "Close-Grip Bench Press", "Overhead Tricep Extension", "Tricep Dips"
  ],
  Core: [
    "Crunches", "Leg Raises", "Plank", "Russian Twists", "Cable Crunches", "Hanging Leg Raises", "Ab Rollout"
  ]
};

// Individual set data
interface SetData {
  id: number;
  reps: string;
  weight: string;
  completed: boolean;
  restStartTime?: number;
}

// Enhanced exercise with per-set tracking
interface TrackedExercise {
  id: number;
  name: string;
  targetSets: number;
  targetReps: string;
  sets: SetData[];
  notes?: string;
}

interface WorkoutSessionProps {
  initialExercises: ExerciseLog[];
  workoutTitle: string;
  onComplete: (exercises: ExerciseLog[], title: string) => void;
  onCancel: () => void;
  recoveryAdjusted?: boolean;
  recoveryNotes?: string;
}

// Rest timer presets (in seconds)
const REST_PRESETS = [30, 60, 90, 120, 180];

const WorkoutSession: React.FC<WorkoutSessionProps> = ({
  initialExercises,
  workoutTitle,
  onComplete,
  onCancel,
  recoveryAdjusted,
  recoveryNotes
}) => {
  // Convert initial exercises to tracked format
  const convertToTracked = (exercises: ExerciseLog[]): TrackedExercise[] => {
    return exercises.map(ex => {
      const numSets = parseInt(ex.sets) || 3;
      const sets: SetData[] = Array.from({ length: numSets }, (_, i) => ({
        id: i + 1,
        reps: '',
        weight: ex.weight || '',
        completed: false
      }));
      return {
        id: ex.id,
        name: ex.name,
        targetSets: numSets,
        targetReps: ex.reps,
        sets
      };
    });
  };

  const [exercises, setExercises] = useState<TrackedExercise[]>(convertToTracked(initialExercises));
  const [activeExerciseId, setActiveExerciseId] = useState<number | null>(exercises[0]?.id || null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Rest timer state
  const [restTimeRemaining, setRestTimeRemaining] = useState<number>(0);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [defaultRestTime, setDefaultRestTime] = useState(90); // 90 seconds default
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Workout timer
  const [workoutStartTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Initialize audio for timer completion
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ8FasHi8JRkGAB0xOTwh1sVAHDE3uZzUBoAb7rW4GdIFABgqMvWW0YSAF6gwcpTQxAATpKzwks+DwBIiKu7RDkOAEB/o7I9NA0ANXSapjUvDAAt'); // Simple beep sound
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  // Workout elapsed time tracker
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - workoutStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [workoutStartTime]);

  // Rest timer logic
  useEffect(() => {
    if (restTimerActive && restTimeRemaining > 0) {
      restTimerRef.current = setInterval(() => {
        setRestTimeRemaining(prev => {
          if (prev <= 1) {
            setRestTimerActive(false);
            // Play sound and vibrate
            audioRef.current?.play().catch(() => {});
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [restTimerActive, restTimeRemaining]);

  const startRestTimer = (seconds?: number) => {
    const time = seconds || defaultRestTime;
    setRestTimeRemaining(time);
    setRestTimerActive(true);
  };

  const stopRestTimer = () => {
    setRestTimerActive(false);
    setRestTimeRemaining(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Mark a set as completed
  const completeSet = (exerciseId: number, setId: number, reps: string, weight: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => {
          if (s.id !== setId) return s;
          return { ...s, reps, weight, completed: true };
        })
      };
    }));
    // Auto-start rest timer after completing a set
    startRestTimer();
  };

  // Toggle set completion
  const toggleSetCompletion = (exerciseId: number, setId: number) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      const updatedSets = ex.sets.map(s => {
        if (s.id !== setId) return s;
        const newCompleted = !s.completed;
        if (newCompleted) {
          // Starting rest timer when marking complete
          startRestTimer();
        }
        return { ...s, completed: newCompleted };
      });
      return { ...ex, sets: updatedSets };
    }));
  };

  // Update set data without completing
  const updateSetData = (exerciseId: number, setId: number, field: 'reps' | 'weight', value: string) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s)
      };
    }));
  };

  // Add a new set to an exercise
  const addSet = (exerciseId: number) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      const newSetId = ex.sets.length + 1;
      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        targetSets: ex.targetSets + 1,
        sets: [...ex.sets, {
          id: newSetId,
          reps: '',
          weight: lastSet?.weight || '',
          completed: false
        }]
      };
    }));
  };

  // Remove last set from exercise
  const removeSet = (exerciseId: number) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId || ex.sets.length <= 1) return ex;
      return {
        ...ex,
        targetSets: ex.targetSets - 1,
        sets: ex.sets.slice(0, -1)
      };
    }));
  };

  // Add new exercise
  const addExercise = (exerciseName: string) => {
    const newId = Math.max(...exercises.map(e => e.id), 0) + 1;
    const newExercise: TrackedExercise = {
      id: newId,
      name: exerciseName,
      targetSets: 3,
      targetReps: '10-12',
      sets: [
        { id: 1, reps: '', weight: '', completed: false },
        { id: 2, reps: '', weight: '', completed: false },
        { id: 3, reps: '', weight: '', completed: false }
      ]
    };
    setExercises([...exercises, newExercise]);
    setActiveExerciseId(newId);
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  // Remove exercise
  const removeExercise = (exerciseId: number) => {
    setExercises(prev => prev.filter(e => e.id !== exerciseId));
    if (activeExerciseId === exerciseId) {
      setActiveExerciseId(exercises.find(e => e.id !== exerciseId)?.id || null);
    }
  };

  // Calculate workout progress
  const progress = useMemo(() => {
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);
    return totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  }, [exercises]);

  // Check if workout is completable (at least one set completed)
  const canComplete = exercises.some(ex => ex.sets.some(s => s.completed));

  // Convert back to ExerciseLog format for saving
  const convertToExerciseLog = (): ExerciseLog[] => {
    return exercises.map(ex => {
      const completedSets = ex.sets.filter(s => s.completed);
      const avgWeight = completedSets.length > 0
        ? Math.round(completedSets.reduce((acc, s) => acc + (parseFloat(s.weight) || 0), 0) / completedSets.length)
        : 0;
      const repsRange = completedSets.map(s => s.reps).filter(Boolean).join(', ') || ex.targetReps;

      return {
        id: ex.id,
        name: ex.name,
        sets: String(completedSets.length),
        reps: repsRange,
        weight: avgWeight > 0 ? String(avgWeight) : ''
      };
    }).filter(ex => ex.name); // Only include exercises with names
  };

  const handleComplete = () => {
    const exerciseLog = convertToExerciseLog();
    onComplete(exerciseLog, workoutTitle);
  };

  // Filter exercises for picker
  const filteredExercises = useMemo(() => {
    let list = selectedCategory
      ? EXERCISE_CATEGORIES[selectedCategory as keyof typeof EXERCISE_CATEGORIES]
      : EXERCISE_LIST;

    if (searchQuery) {
      list = list.filter(name =>
        name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return list;
  }, [selectedCategory, searchQuery]);

  // Get active exercise
  const activeExercise = exercises.find(e => e.id === activeExerciseId);

  return (
    <div className="space-y-4">
      {/* Header with timer and progress */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{workoutTitle}</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">⏱️ {formatTime(elapsedTime)}</span>
            <span className="text-[var(--color-primary)]">{progress}% complete</span>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Recovery notes */}
      {recoveryNotes && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm mb-4">
          {recoveryAdjusted && (
            <span className="inline-block px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full mr-2">
              Adjusted
            </span>
          )}
          {recoveryNotes}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--color-primary)] to-green-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Rest Timer (when active) */}
      {restTimerActive && (
        <div className="bg-gradient-to-r from-[var(--color-primary)]/20 to-green-500/20 border border-[var(--color-primary)]/30 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Rest Timer</p>
          <p className="text-4xl font-black text-white mb-3">{formatTime(restTimeRemaining)}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setRestTimeRemaining(prev => Math.max(0, prev - 15))}
              className="px-3 py-1 bg-white/10 text-gray-300 rounded-lg text-sm"
            >
              -15s
            </button>
            <button
              onClick={stopRestTimer}
              className="px-4 py-1 bg-[var(--color-primary)] text-black font-bold rounded-lg text-sm"
            >
              Skip
            </button>
            <button
              onClick={() => setRestTimeRemaining(prev => prev + 15)}
              className="px-3 py-1 bg-white/10 text-gray-300 rounded-lg text-sm"
            >
              +15s
            </button>
          </div>
        </div>
      )}

      {/* Exercise tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {exercises.map((ex, index) => {
          const completed = ex.sets.every(s => s.completed);
          const partial = ex.sets.some(s => s.completed);
          return (
            <button
              key={ex.id}
              onClick={() => setActiveExerciseId(ex.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeExerciseId === ex.id
                  ? 'bg-[var(--color-primary)] text-black'
                  : completed
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : partial
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-gray-800 text-gray-400'
              }`}
            >
              {completed && <span className="mr-1">✓</span>}
              {index + 1}. {ex.name.length > 12 ? ex.name.slice(0, 12) + '...' : ex.name}
            </button>
          );
        })}
        <button
          onClick={() => setShowExercisePicker(true)}
          className="flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Active exercise detail */}
      {activeExercise && (
        <div className="bg-black/30 rounded-xl border border-white/5 p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-lg font-bold text-white">{activeExercise.name}</h4>
              <p className="text-gray-400 text-sm">Target: {activeExercise.targetSets} × {activeExercise.targetReps}</p>
            </div>
            <button
              onClick={() => removeExercise(activeExercise.id)}
              className="p-2 text-gray-600 hover:text-red-500 transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Sets list */}
          <div className="space-y-3">
            {activeExercise.sets.map((set, index) => (
              <div
                key={set.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  set.completed ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800/50'
                }`}
              >
                <span className="text-gray-500 font-bold w-8">#{index + 1}</span>

                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-gray-500 font-bold">Weight</label>
                    <input
                      type="number"
                      placeholder="lbs"
                      value={set.weight}
                      onChange={(e) => updateSetData(activeExercise.id, set.id, 'weight', e.target.value)}
                      className="w-full bg-transparent text-white text-lg font-bold outline-none border-b border-white/10 focus:border-[var(--color-primary)] py-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-gray-500 font-bold">Reps</label>
                    <input
                      type="number"
                      placeholder={activeExercise.targetReps.split('-')[0]}
                      value={set.reps}
                      onChange={(e) => updateSetData(activeExercise.id, set.id, 'reps', e.target.value)}
                      className="w-full bg-transparent text-white text-lg font-bold outline-none border-b border-white/10 focus:border-[var(--color-primary)] py-1"
                    />
                  </div>
                </div>

                <button
                  onClick={() => toggleSetCompletion(activeExercise.id, set.id)}
                  className={`p-3 rounded-full transition-all ${
                    set.completed
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-[var(--color-primary)] hover:text-black'
                  }`}
                >
                  <CheckIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add/remove set buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => addSet(activeExercise.id)}
              className="flex-1 py-2 border border-dashed border-white/20 rounded-lg text-gray-400 hover:text-white hover:border-white/40 transition-all text-sm"
            >
              + Add Set
            </button>
            {activeExercise.sets.length > 1 && (
              <button
                onClick={() => removeSet(activeExercise.id)}
                className="px-4 py-2 border border-dashed border-red-500/20 rounded-lg text-red-400 hover:text-red-300 hover:border-red-500/40 transition-all text-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rest timer settings */}
      <div className="bg-black/20 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-2">Default Rest Time</p>
        <div className="flex gap-2 flex-wrap">
          {REST_PRESETS.map(seconds => (
            <button
              key={seconds}
              onClick={() => setDefaultRestTime(seconds)}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                defaultRestTime === seconds
                  ? 'bg-[var(--color-primary)] text-black font-bold'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {formatTime(seconds)}
            </button>
          ))}
        </div>
      </div>

      {/* Complete workout button */}
      <div className="pt-4 border-t border-white/5">
        <button
          onClick={handleComplete}
          disabled={!canComplete}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            canComplete
              ? 'bg-gradient-to-r from-[var(--color-primary)] to-green-400 text-black shadow-lg hover:scale-[1.02]'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          {canComplete ? `Complete Workout (${progress}%)` : 'Complete at least 1 set'}
        </button>
      </div>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#1C1C1E] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-white">Add Exercise</h3>
                <button
                  onClick={() => {
                    setShowExercisePicker(false);
                    setSearchQuery('');
                    setSelectedCategory(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                placeholder="Search exercises..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                autoFocus
              />
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 p-3 overflow-x-auto border-b border-white/5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                  !selectedCategory ? 'bg-[var(--color-primary)] text-black' : 'bg-gray-800 text-gray-400'
                }`}
              >
                All
              </button>
              {Object.keys(EXERCISE_CATEGORIES).map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                    selectedCategory === category ? 'bg-[var(--color-primary)] text-black' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Exercise list */}
            <div className="overflow-y-auto max-h-[50vh] p-2">
              {filteredExercises.map(name => (
                <button
                  key={name}
                  onClick={() => addExercise(name)}
                  className="w-full text-left px-4 py-3 text-gray-200 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {name}
                </button>
              ))}
              {filteredExercises.length === 0 && (
                <p className="text-center text-gray-500 py-8">No exercises found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutSession;
