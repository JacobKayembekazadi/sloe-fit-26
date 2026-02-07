import React, { useState } from 'react';
import { GeneratedWorkout } from '../services/aiService';

export interface QuickRecoveryResult {
  status: 'good' | 'tired' | 'sore';
  sorenessConflict: boolean;
  adjustedWorkout?: GeneratedWorkout;
}

interface QuickRecoveryCheckProps {
  workout: GeneratedWorkout;
  onProceed: (result: QuickRecoveryResult) => void;
  onFullCheckIn: () => void;
  onCancel: () => void;
}

// Check if workout targets sore areas
function checkSorenessConflict(workout: GeneratedWorkout, sorenessAreas: string[]): boolean {
  if (sorenessAreas.length === 0) return false;

  const workoutMuscles = new Set<string>();
  workout.exercises.forEach(ex => {
    ex.target_muscles?.forEach(m => workoutMuscles.add(m.toLowerCase()));
  });

  // Also check title
  const titleLower = workout.title.toLowerCase();
  if (titleLower.includes('leg') || titleLower.includes('lower')) workoutMuscles.add('legs');
  if (titleLower.includes('chest') || titleLower.includes('push')) workoutMuscles.add('chest');
  if (titleLower.includes('back') || titleLower.includes('pull')) workoutMuscles.add('back');
  if (titleLower.includes('shoulder')) workoutMuscles.add('shoulders');
  if (titleLower.includes('arm')) workoutMuscles.add('arms');
  if (titleLower.includes('core') || titleLower.includes('ab')) workoutMuscles.add('core');

  return sorenessAreas.some(area => workoutMuscles.has(area.toLowerCase()));
}

const QuickRecoveryCheck: React.FC<QuickRecoveryCheckProps> = ({
  workout,
  onProceed,
  onFullCheckIn,
  onCancel
}) => {
  const [selectedSoreness, setSelectedSoreness] = useState<string[]>([]);
  const [showSorenessWarning, setShowSorenessWarning] = useState(false);

  const QUICK_SORENESS_AREAS = [
    { id: 'chest', label: 'Chest' },
    { id: 'back', label: 'Back' },
    { id: 'shoulders', label: 'Shoulders' },
    { id: 'arms', label: 'Arms' },
    { id: 'legs', label: 'Legs' },
    { id: 'core', label: 'Core' }
  ];

  const toggleSoreness = (area: string) => {
    setSelectedSoreness(prev =>
      prev.includes(area)
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
    setShowSorenessWarning(false);
  };

  const handleProceed = (status: 'good' | 'tired' | 'sore') => {
    const hasConflict = checkSorenessConflict(workout, selectedSoreness);

    if (hasConflict && !showSorenessWarning) {
      // Show warning first
      setShowSorenessWarning(true);
      return;
    }

    onProceed({
      status,
      sorenessConflict: hasConflict,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick recovery check"
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="w-full max-w-md">
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="flex items-center justify-center size-10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="card p-6 space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-2xl">fitness_center</span>
            </div>
            <h2 className="text-xl font-black text-white mb-1">Quick Check</h2>
            <p className="text-gray-400 text-sm">
              Starting: <span className="text-white font-medium">{workout.title}</span>
            </p>
          </div>

          {/* Soreness check */}
          <div>
            <p className="text-sm text-gray-300 mb-3 text-center">Any sore areas today?</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_SORENESS_AREAS.map(area => (
                <button
                  key={area.id}
                  onClick={() => toggleSoreness(area.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedSoreness.includes(area.id)
                      ? 'bg-red-500/20 border border-red-500 text-red-400'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {area.label}
                </button>
              ))}
            </div>
          </div>

          {/* Soreness conflict warning */}
          {showSorenessWarning && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 animate-slide-up">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-yellow-400 text-lg shrink-0">warning</span>
                <div>
                  <p className="text-yellow-400 text-sm font-medium">Heads up!</p>
                  <p className="text-yellow-200/80 text-sm mt-0.5">
                    This workout targets muscles you marked as sore. Proceed carefully or do full check-in for a modified workout.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={() => handleProceed('good')}
              className="w-full py-3 px-4 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <span className="material-symbols-outlined">play_arrow</span>
              {showSorenessWarning ? 'Start Anyway' : 'Start Workout'}
            </button>

            <button
              onClick={onFullCheckIn}
              className="w-full py-3 px-4 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors text-sm"
            >
              Full Recovery Check-In (Get Modified Workout)
            </button>
          </div>

          {/* Tip */}
          <p className="text-center text-xs text-gray-500">
            Full check-in generates a workout based on your current recovery
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuickRecoveryCheck;
