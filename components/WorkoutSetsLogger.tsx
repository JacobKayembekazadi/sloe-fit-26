import React from 'react';

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
}

const WorkoutSetsLogger: React.FC<WorkoutSetsLoggerProps> = ({
    exerciseName,
    sets,
    onUpdateSet,
    onToggleSet,
    onAddSet,
    targetReps
}) => {
    const completedSets = sets.filter(s => s.completed).length;

    return (
        <div className="relative flex h-full w-full flex-col bg-background-dark overflow-y-auto pb-20 font-display transition-colors duration-300">
            {/* Exercise Header */}
            <div className="px-4 pt-2 pb-3 shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-white">{exerciseName}</h2>
                <p className="text-xs sm:text-sm text-slate-400">
                    {completedSets} of {sets.length} sets completed {targetReps && `• Target: ${targetReps} reps`}
                </p>
            </div>

            {/* Sets List */}
            <div className="flex flex-col gap-2 mt-4 px-3 sm:px-4">
                {/* Labels */}
                <div className="flex items-center px-1 sm:px-2 py-1 text-[#90adcb] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                    <div className="w-8 sm:w-10">Set</div>
                    <div className="flex-1 px-1 sm:px-2 hidden sm:block">Previous</div>
                    <div className="w-[4.5rem] sm:w-20 text-center">Weight</div>
                    <div className="w-[4.5rem] sm:w-20 text-center">Reps</div>
                    <div className="w-9 sm:w-10 text-right">Done</div>
                </div>

                {sets.map((set, index) => (
                    <div
                        key={set.id}
                        className={`flex items-center gap-1 sm:gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-transparent transition-all ${set.completed
                                ? 'bg-[#182634] opacity-80'
                                : 'bg-[#182634] border-2 border-[var(--color-primary)]/30 shadow-sm'
                            }`}
                    >
                        <div className={`w-8 sm:w-10 font-bold text-xs sm:text-sm ${set.completed ? 'text-[#90adcb]' : 'text-[var(--color-primary)]'}`}>
                            {index + 1}
                        </div>
                        <div className="flex-1 px-1 sm:px-2 text-[10px] sm:text-xs text-slate-500 hidden sm:block">
                            {set.previous || '-'}
                        </div>
                        <div className="w-[4.5rem] sm:w-20">
                            <input
                                className={`w-full rounded-lg h-11 sm:h-12 text-center text-sm font-bold outline-none border focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors ${set.completed
                                        ? 'bg-[#223649]/50 text-slate-500 border-none'
                                        : 'bg-[#223649] text-white border-slate-700'
                                    }`}
                                value={set.weight}
                                onChange={(e) => onUpdateSet(set.id, 'weight', e.target.value)}
                                placeholder="-"
                                type="number"
                                inputMode="decimal"
                            />
                        </div>
                        <div className="w-[4.5rem] sm:w-20">
                            <input
                                className={`w-full rounded-lg h-11 sm:h-12 text-center text-sm font-bold outline-none border focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors ${set.completed
                                        ? 'bg-[#223649]/50 text-slate-500 border-none'
                                        : 'bg-[#223649] text-white border-slate-700'
                                    }`}
                                value={set.reps}
                                onChange={(e) => onUpdateSet(set.id, 'reps', e.target.value)}
                                placeholder="-"
                                type="number"
                                inputMode="numeric"
                            />
                        </div>
                        <div className="w-12 flex justify-end">
                            <button
                                onClick={() => onToggleSet(set.id)}
                                aria-label={set.completed ? `Unmark set ${index + 1}` : `Mark set ${index + 1} complete`}
                                className={`size-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border-2 transition-colors ${set.completed
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : 'bg-transparent border-[#314d68] text-transparent hover:border-[var(--color-primary)]'
                                    }`}
                            >
                                {set.completed && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Set Button */}
                <button
                    onClick={onAddSet}
                    className="mt-2 flex items-center justify-center gap-1 sm:gap-2 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-dashed border-[#314d68] text-[#90adcb] hover:bg-[#223649] transition-colors font-bold text-xs sm:text-sm"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Add Set
                </button>
            </div>

            {/* Footer Actions (Spacer for fixed footer) */}
            <div className="h-24"></div>
        </div>
    );
};

export default WorkoutSetsLogger;
