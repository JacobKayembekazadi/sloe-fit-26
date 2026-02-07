import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Muscle group aliases for better matching
const MUSCLE_ALIASES: Record<string, string[]> = {
  chest: ['chest', 'pec', 'pecs', 'pectorals', 'push'],
  back: ['back', 'lat', 'lats', 'pull', 'rowing'],
  shoulders: ['shoulder', 'shoulders', 'delt', 'delts', 'deltoid'],
  arms: ['arm', 'arms', 'bicep', 'biceps', 'tricep', 'triceps', 'forearm'],
  legs: ['leg', 'legs', 'quad', 'quads', 'hamstring', 'glute', 'glutes', 'calf', 'calves', 'lower body', 'lower-body'],
  core: ['core', 'ab', 'abs', 'abdominal', 'oblique']
};

// Word-boundary matching to prevent false positives (e.g., "arm" in "charm")
function matchesWordBoundary(text: string, term: string): boolean {
  // Create regex with word boundaries
  const regex = new RegExp(`\\b${term}\\b`, 'i');
  return regex.test(text);
}

// Check if workout targets sore areas with improved matching
function checkSorenessConflict(workout: GeneratedWorkout, sorenessAreas: string[]): boolean {
  if (sorenessAreas.length === 0) return false;

  const workoutMuscles = new Set<string>();

  // Null-safe check on exercises array
  const exercises = workout.exercises || [];
  exercises.forEach(ex => {
    // Add target muscles from exercise data
    ex.target_muscles?.forEach(m => {
      const muscleNormalized = m.toLowerCase().trim();
      workoutMuscles.add(muscleNormalized);

      // Also map to canonical muscle groups
      for (const [canonical, aliases] of Object.entries(MUSCLE_ALIASES)) {
        if (aliases.some(alias => muscleNormalized.includes(alias))) {
          workoutMuscles.add(canonical);
        }
      }
    });
  });

  // Check workout title with word-boundary matching
  const titleLower = workout.title?.toLowerCase() || '';
  for (const [canonical, aliases] of Object.entries(MUSCLE_ALIASES)) {
    if (aliases.some(alias => matchesWordBoundary(titleLower, alias))) {
      workoutMuscles.add(canonical);
    }
  }

  // Check if any sore area matches workout muscles
  return sorenessAreas.some(area => {
    const areaNormalized = area.toLowerCase().trim();
    // Direct match
    if (workoutMuscles.has(areaNormalized)) return true;
    // Check aliases for the sore area
    const areaAliases = MUSCLE_ALIASES[areaNormalized] || [areaNormalized];
    return areaAliases.some(alias => workoutMuscles.has(alias));
  });
}

const QuickRecoveryCheck: React.FC<QuickRecoveryCheckProps> = ({
  workout,
  onProceed,
  onFullCheckIn,
  onCancel
}) => {
  const [selectedSoreness, setSelectedSoreness] = useState<string[]>([]);
  const [showSorenessWarning, setShowSorenessWarning] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  const QUICK_SORENESS_AREAS = [
    { id: 'chest', label: 'Chest' },
    { id: 'back', label: 'Back' },
    { id: 'shoulders', label: 'Shoulders' },
    { id: 'arms', label: 'Arms' },
    { id: 'legs', label: 'Legs' },
    { id: 'core', label: 'Core' }
  ];

  // Focus trap and keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      // Focus trap: Tab/Shift+Tab within modal
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus first interactive element on mount
    setTimeout(() => firstFocusableRef.current?.focus(), 0);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const toggleSoreness = useCallback((area: string) => {
    setSelectedSoreness(prev =>
      prev.includes(area)
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
    setShowSorenessWarning(false);
  }, []);

  const handleProceed = useCallback((status: 'good' | 'tired' | 'sore') => {
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
  }, [workout, selectedSoreness, showSorenessWarning, onProceed]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-recovery-title"
      aria-describedby="quick-recovery-desc"
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="w-full max-w-md">
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button
            ref={firstFocusableRef}
            onClick={onCancel}
            aria-label="Cancel and close"
            className="flex items-center justify-center size-10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="card p-6 space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-2xl" aria-hidden="true">fitness_center</span>
            </div>
            <h2 id="quick-recovery-title" className="text-xl font-black text-white mb-1">Quick Check</h2>
            <p id="quick-recovery-desc" className="text-gray-400 text-sm">
              Starting: <span className="text-white font-medium">{workout.title}</span>
            </p>
          </div>

          {/* Soreness check */}
          <fieldset>
            <legend className="text-sm text-gray-300 mb-3 text-center w-full">Any sore areas today?</legend>
            <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label="Select sore body areas">
              {QUICK_SORENESS_AREAS.map(area => {
                const isSelected = selectedSoreness.includes(area.id);
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleSoreness(area.id)}
                    aria-pressed={isSelected}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
                      isSelected
                        ? 'bg-red-500/20 border border-red-500 text-red-400'
                        : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {area.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Soreness conflict warning - aria-live for screen readers */}
          <div aria-live="polite" aria-atomic="true">
            {showSorenessWarning && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 animate-slide-up"
              >
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-yellow-400 text-lg shrink-0" aria-hidden="true">warning</span>
                  <div>
                    <p className="text-yellow-400 text-sm font-medium">Heads up!</p>
                    <p className="text-yellow-200/80 text-sm mt-0.5">
                      This workout targets muscles you marked as sore. Proceed carefully or do full check-in for a modified workout.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleProceed('good')}
              className="w-full py-3 px-4 bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
              {showSorenessWarning ? 'Start Anyway' : 'Start Workout'}
            </button>

            <button
              type="button"
              onClick={onFullCheckIn}
              className="w-full py-3 px-4 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
