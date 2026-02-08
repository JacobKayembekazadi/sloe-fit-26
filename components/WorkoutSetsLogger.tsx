import React, { useState } from 'react';

interface SetData {
    id: number;
    reps: string;
    weight: string;
    completed: boolean;
    previous?: string;
}

interface WorkoutSetsLoggerProps {
    exerciseName: string;
    sets: SetData[];
    onUpdateSet: (setId: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSet: (setId: number) => void;
    onAddSet: () => void;
    targetReps?: string;
    notes?: string;
    targetMuscles?: string[];
    formCues?: string[];
    lastWeight?: string | null;
}

const WorkoutSetsLogger: React.FC<WorkoutSetsLoggerProps> = ({
    exerciseName,
    sets,
    onUpdateSet,
    onToggleSet,
    onAddSet,
    targetReps,
    notes,
    targetMuscles,
    formCues,
    lastWeight
}) => {
    const completedSets = sets.filter(s => s.completed).length;
    const [showFormTips, setShowFormTips] = useState(false);
    const hasTips = (formCues && formCues.length > 0) || notes;

    // First incomplete set is active
    const activeSetIndex = sets.findIndex(s => !s.completed);

    return (
        <div className="relative flex h-full w-full flex-col bg-background-dark pb-20 font-display transition-colors duration-300">
            {/* Exercise Header */}
            <div className="px-4 pt-3 pb-1 shrink-0">
                <h2 className="text-xl font-bold text-white tracking-tight">{exerciseName}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                    {completedSets} of {sets.length} sets {targetReps && `· Target: ${targetReps} reps`}
                </p>
            </div>

            {/* Form Tips Toggle */}
            {hasTips && (
                <div className="px-4 pb-1">
                    <button
                        onClick={() => setShowFormTips(!showFormTips)}
                        className="flex items-center gap-1.5 text-[var(--color-primary)] text-xs font-bold py-1.5 hover:opacity-80 transition-opacity"
                        aria-label={showFormTips ? 'Hide form tips' : 'Show form tips'}
                    >
                        <span className="material-symbols-outlined text-sm">
                            {showFormTips ? 'expand_less' : 'expand_more'}
                        </span>
                        Form Tips
                    </button>

                    {showFormTips && (
                        <div className="bg-[#1a2e20] border border-[var(--color-primary)]/20 rounded-xl p-3 mb-1 animate-slide-up">
                            {formCues && formCues.length > 0 && (
                                <ul className="space-y-1">
                                    {formCues.map((cue, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                            <span className="text-[var(--color-primary)] mt-0.5 shrink-0">•</span>
                                            {cue}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {notes && (
                                <p className="text-xs text-slate-400 mt-2 italic">{notes}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Target Muscles */}
            {targetMuscles && targetMuscles.length > 0 && (
                <div className="px-4 pb-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Targets:</span>
                    {targetMuscles.map((m, i) => (
                        <span key={i} className="text-[10px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2 py-0.5 rounded-full font-medium capitalize">
                            {m}
                        </span>
                    ))}
                </div>
            )}

            {/* Timeline Section */}
            <div className="relative mt-3 px-4">
                {/* Vertical Timeline Line */}
                <div
                    className="absolute top-0 bottom-0 w-px opacity-25 left-[calc(1rem+22px)] sm:left-[calc(1rem+28px)]"
                    style={{
                        background: 'linear-gradient(to bottom, transparent, var(--color-primary), transparent)',
                    }}
                />

                <div className="flex flex-col gap-3 sm:gap-4">
                    {sets.map((set, index) => {
                        const isActive = index === activeSetIndex;
                        const isCompleted = set.completed;

                        if (isCompleted) {
                            return (
                                <CompletedSetNode
                                    key={set.id}
                                    index={index}
                                    set={set}
                                    onToggleSet={onToggleSet}
                                />
                            );
                        }

                        if (isActive) {
                            return (
                                <ActiveSetNode
                                    key={set.id}
                                    index={index}
                                    set={set}
                                    onUpdateSet={onUpdateSet}
                                    onToggleSet={onToggleSet}
                                    lastWeight={lastWeight}
                                />
                            );
                        }

                        return (
                            <UpcomingSetNode
                                key={set.id}
                                index={index}
                                targetReps={targetReps}
                            />
                        );
                    })}

                    {/* Add Set Node */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        <button
                            onClick={onAddSet}
                            className="size-11 sm:size-14 shrink-0 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl">add</span>
                        </button>
                        <button
                            onClick={onAddSet}
                            className="text-sm text-slate-500 font-medium hover:text-[var(--color-primary)] transition-colors"
                        >
                            Add Set
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer Spacer */}
            <div className="h-24"></div>
        </div>
    );
};

/* ── Completed Set Node ── */
function CompletedSetNode({ index, set, onToggleSet }: {
    index: number;
    set: { id: number; weight: string; reps: string };
    onToggleSet: (id: number) => void;
}) {
    return (
        <div className="flex items-center gap-3 sm:gap-4 opacity-60">
            <button
                onClick={() => onToggleSet(set.id)}
                className="size-11 sm:size-14 shrink-0 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center"
                aria-label={`Undo set ${index + 1}`}
            >
                <span className="material-symbols-outlined text-green-400 text-xl">check</span>
            </button>
            <div className="glass-panel px-4 py-3 flex-1">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Set {index + 1}</span>
                    <span className="text-sm font-bold text-slate-300">
                        {set.weight && set.reps
                            ? `${set.weight} × ${set.reps}`
                            : set.weight
                                ? `${set.weight} lbs`
                                : set.reps
                                    ? `${set.reps} reps`
                                    : 'Completed'}
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ── Active Set Node ── */
function ActiveSetNode({ index, set, onUpdateSet, onToggleSet, lastWeight }: {
    index: number;
    set: { id: number; weight: string; reps: string };
    onUpdateSet: (id: number, field: 'weight' | 'reps', value: string) => void;
    onToggleSet: (id: number) => void;
    lastWeight?: string | null;
}) {
    return (
        <div className="flex items-start gap-3 sm:gap-4 animate-fade-in-up">
            <div className="size-11 sm:size-14 shrink-0 rounded-full border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10 flex items-center justify-center timeline-dot-active animate-pulse-glow mt-1">
                <span className="text-[var(--color-primary)] font-black text-sm">{index + 1}</span>
            </div>
            <div className="glass-panel-active flex-1 p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-bold text-white">Working Set</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-primary)]/15 text-[var(--color-primary)] px-2.5 py-1 rounded-full">
                        Current Focus
                    </span>
                </div>

                {/* Inputs */}
                <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">
                            Weight (lbs)
                            {lastWeight && <span className="text-[var(--color-primary)] ml-1 normal-case">Last: {lastWeight}lbs</span>}
                        </label>
                        <input
                            className="glass-input w-full h-14"
                            value={set.weight}
                            onChange={(e) => onUpdateSet(set.id, 'weight', e.target.value)}
                            placeholder={lastWeight || "0"}
                            type="number"
                            inputMode="decimal"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1.5 block">Reps</label>
                        <input
                            className="glass-input w-full h-14"
                            value={set.reps}
                            onChange={(e) => onUpdateSet(set.id, 'reps', e.target.value)}
                            placeholder="0"
                            type="number"
                            inputMode="numeric"
                        />
                    </div>
                </div>

                {/* Log Set Button */}
                <button
                    onClick={() => onToggleSet(set.id)}
                    className="w-full bg-[var(--color-primary)] text-black font-bold py-3.5 rounded-xl shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.97] transition-all text-sm flex items-center justify-center gap-2"
                    aria-label={`Log set ${index + 1}`}
                >
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    Log Set
                </button>
            </div>
        </div>
    );
}

/* ── Upcoming Set Node ── */
function UpcomingSetNode({ index, targetReps }: {
    index: number;
    targetReps?: string;
}) {
    return (
        <div className="flex items-center gap-3 sm:gap-4 opacity-40">
            <div className="size-11 sm:size-14 shrink-0 rounded-full border-2 border-slate-700 flex items-center justify-center">
                <span className="text-slate-500 font-bold text-sm">{index + 1}</span>
            </div>
            <div className="py-2">
                <span className="text-sm text-slate-500 font-medium">Set {index + 1}</span>
                {targetReps && (
                    <span className="text-xs text-slate-600 ml-2">Target {targetReps} reps</span>
                )}
            </div>
        </div>
    );
}

export default WorkoutSetsLogger;
