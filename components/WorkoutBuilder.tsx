import React, { useState, memo, lazy, Suspense } from 'react';
import type { Exercise } from '../data/exercises';
import type { ExerciseLog } from '../App';
import { getExerciseById } from '../data/exercises';
import { saveTemplate } from '../services/templateService';
import type { WorkoutTemplate } from '../services/templateService';

const ExerciseLibrary = lazy(() => import('./ExerciseLibrary'));

interface BuilderExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

interface WorkoutBuilderProps {
  onBack: () => void;
  onStartWorkout: (exercises: ExerciseLog[], title: string) => void;
  onTemplateSaved?: (template: WorkoutTemplate) => void;
}

const WorkoutBuilder: React.FC<WorkoutBuilderProps> = ({ onBack, onStartWorkout, onTemplateSaved }) => {
  const [workoutName, setWorkoutName] = useState('My Custom Workout');
  const [exercises, setExercises] = useState<BuilderExercise[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddExercise = (ex: Exercise) => {
    setExercises(prev => [...prev, {
      exerciseId: ex.id,
      name: ex.name,
      sets: ex.defaultSets,
      reps: ex.defaultReps,
      restSeconds: ex.defaultRest,
    }]);
    setShowLibrary(false);
  };

  const handleRemoveExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setExercises(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === exercises.length - 1) return;
    setExercises(prev => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleUpdateExercise = (index: number, field: keyof BuilderExercise, value: string | number) => {
    setExercises(prev => prev.map((ex, i) => i === index ? { ...ex, [field]: value } : ex));
  };

  const handleSaveTemplate = () => {
    if (exercises.length === 0) return;
    const template = saveTemplate({ name: workoutName, exercises });
    onTemplateSaved?.(template);
  };

  const handleStartWorkout = () => {
    if (exercises.length === 0) return;
    const logs: ExerciseLog[] = exercises.map((ex, idx) => {
      const libEntry = getExerciseById(ex.exerciseId);
      return {
        id: idx + 1,
        name: ex.name,
        sets: String(ex.sets),
        reps: ex.reps,
        weight: '',
        restSeconds: ex.restSeconds,
        formCues: libEntry?.formCues,
        targetMuscles: libEntry ? [...libEntry.primaryMuscles, ...libEntry.secondaryMuscles] : undefined,
        exerciseId: ex.exerciseId,
      };
    });
    onStartWorkout(logs, workoutName);
  };

  if (showLibrary) {
    return (
      <Suspense fallback={null}>
        <ExerciseLibrary
          onBack={() => setShowLibrary(false)}
          onSelectExercise={handleAddExercise}
          mode="builder"
        />
      </Suspense>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background-dark flex flex-col text-white font-display">
      {/* Header */}
      <div className="shrink-0 bg-background-dark border-b border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 p-3 sm:p-4">
          <button
            onClick={onBack}
            aria-label="Back"
            className="flex size-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold flex-1">Build Workout</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-36">
        {/* Workout Name */}
        <div className="mb-5">
          <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5 block">Workout Name</label>
          <input
            type="text"
            value={workoutName}
            onChange={e => setWorkoutName(e.target.value)}
            className="w-full bg-[#223649] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none border border-transparent focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* Exercise List */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-400">Exercises ({exercises.length})</h3>
          </div>

          {exercises.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block">fitness_center</span>
              <p className="text-sm">No exercises added yet</p>
              <p className="text-xs mt-1">Tap the button below to browse the library</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex, index) => {
                const isEditing = editingIndex === index;

                return (
                  <div key={`${ex.exerciseId}-${index}`} className="bg-[#182634] rounded-xl border border-white/5 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-3">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                          aria-label="Move up"
                        >
                          <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === exercises.length - 1}
                          className="text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                          aria-label="Move down"
                        >
                          <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                        </button>
                      </div>

                      {/* Exercise Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white line-clamp-1">{index + 1}. {ex.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {ex.sets} × {ex.reps} · Rest {ex.restSeconds}s
                        </p>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => setEditingIndex(isEditing ? null : index)}
                        className="size-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
                        aria-label="Edit exercise"
                      >
                        <span className="material-symbols-outlined text-sm">{isEditing ? 'close' : 'edit'}</span>
                      </button>
                      <button
                        onClick={() => handleRemoveExercise(index)}
                        className="size-9 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                        aria-label="Remove exercise"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>

                    {/* Inline Edit */}
                    {isEditing && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/5 grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-500 uppercase font-bold">Sets</label>
                          <input
                            type="number"
                            value={ex.sets}
                            onChange={e => handleUpdateExercise(index, 'sets', parseInt(e.target.value) || 1)}
                            className="w-full bg-[#223649] rounded-lg px-2 py-2 text-center text-sm text-white outline-none border border-transparent focus:border-[var(--color-primary)]"
                            inputMode="numeric"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 uppercase font-bold">Reps</label>
                          <input
                            type="text"
                            value={ex.reps}
                            onChange={e => handleUpdateExercise(index, 'reps', e.target.value)}
                            className="w-full bg-[#223649] rounded-lg px-2 py-2 text-center text-sm text-white outline-none border border-transparent focus:border-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-500 uppercase font-bold">Rest (s)</label>
                          <input
                            type="number"
                            value={ex.restSeconds}
                            onChange={e => handleUpdateExercise(index, 'restSeconds', parseInt(e.target.value) || 30)}
                            className="w-full bg-[#223649] rounded-lg px-2 py-2 text-center text-sm text-white outline-none border border-transparent focus:border-[var(--color-primary)]"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Exercise Button */}
        <button
          onClick={() => setShowLibrary(true)}
          className="w-full py-3 border-2 border-dashed border-[#314d68] text-[#90adcb] rounded-xl font-bold text-sm hover:bg-[#223649] transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add Exercise
        </button>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 bg-background-dark/95 backdrop-blur-md border-t border-slate-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto flex gap-3">
          <button
            onClick={handleSaveTemplate}
            disabled={exercises.length === 0}
            className="flex-1 py-3.5 border-2 border-[var(--color-primary)]/40 text-[var(--color-primary)] font-bold rounded-xl text-sm hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">bookmark</span>
            Save Template
          </button>
          <button
            onClick={handleStartWorkout}
            disabled={exercises.length === 0}
            className="flex-1 py-3.5 bg-[var(--color-primary)] text-black font-bold rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span>
            Start Workout
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(WorkoutBuilder);
