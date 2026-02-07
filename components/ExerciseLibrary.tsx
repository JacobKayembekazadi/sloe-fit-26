import React, { useState, useMemo, memo } from 'react';
import { EXERCISES, MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/exercises';
import type { Exercise } from '../data/exercises';

interface ExerciseLibraryProps {
  onBack: () => void;
  onSelectExercise?: (exercise: Exercise) => void;
  mode?: 'browse' | 'builder';
}

const ExerciseLibrary: React.FC<ExerciseLibraryProps> = ({ onBack, onSelectExercise, mode = 'browse' }) => {
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = EXERCISES;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.primaryMuscles.some(m => m.includes(q)) ||
        e.equipment.includes(q)
      );
    }

    if (muscleFilter) {
      result = result.filter(e =>
        e.primaryMuscles.includes(muscleFilter) || e.secondaryMuscles.includes(muscleFilter)
      );
    }

    if (equipmentFilter) {
      result = result.filter(e => e.equipment === equipmentFilter);
    }

    if (difficultyFilter) {
      result = result.filter(e => e.difficulty === difficultyFilter);
    }

    return result;
  }, [search, muscleFilter, equipmentFilter, difficultyFilter]);

  // Group by primary muscle
  const grouped = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    for (const ex of filtered) {
      const muscle = ex.primaryMuscles[0] || 'other';
      if (!groups[muscle]) groups[muscle] = [];
      groups[muscle].push(ex);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const activeFilterCount = [muscleFilter, equipmentFilter, difficultyFilter].filter(Boolean).length;

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
          <h1 className="text-lg font-bold flex-1">Exercise Library</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex size-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl transition-colors ${showFilters ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'hover:bg-white/10'}`}
          >
            <span className="material-symbols-outlined text-xl">tune</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[var(--color-primary)] text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="px-3 sm:px-4 pb-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
            <input
              type="text"
              placeholder="Search exercises..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#223649] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none border border-transparent focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-3 sm:px-4 pb-3 space-y-2 border-t border-slate-800 pt-3">
            {/* Muscle */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Muscle Group</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setMuscleFilter(null)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${!muscleFilter ? 'bg-[var(--color-primary)] text-black' : 'bg-[#223649] text-slate-400'}`}
                >
                  All
                </button>
                {MUSCLE_GROUPS.map(m => (
                  <button
                    key={m}
                    onClick={() => setMuscleFilter(muscleFilter === m ? null : m)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${muscleFilter === m ? 'bg-[var(--color-primary)] text-black' : 'bg-[#223649] text-slate-400'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Equipment</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setEquipmentFilter(null)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${!equipmentFilter ? 'bg-[var(--color-primary)] text-black' : 'bg-[#223649] text-slate-400'}`}
                >
                  All
                </button>
                {EQUIPMENT_TYPES.map(e => (
                  <button
                    key={e}
                    onClick={() => setEquipmentFilter(equipmentFilter === e ? null : e)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${equipmentFilter === e ? 'bg-[var(--color-primary)] text-black' : 'bg-[#223649] text-slate-400'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">Difficulty</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setDifficultyFilter(null)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${!difficultyFilter ? 'bg-[var(--color-primary)] text-black' : 'bg-[#223649] text-slate-400'}`}
                >
                  All
                </button>
                {['beginner', 'intermediate', 'advanced'].map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficultyFilter(difficultyFilter === d ? null : d)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${difficultyFilter === d ? 'bg-[var(--color-primary)] text-black' : 'bg-[#223649] text-slate-400'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exercise List */}
      <div className="flex-1 overflow-y-auto pb-8">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
            <p className="text-sm">No exercises found</p>
          </div>
        ) : (
          grouped.map(([muscle, exercises]) => (
            <div key={muscle} className="mt-4">
              <div className="flex items-center gap-2 px-4 mb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider capitalize">{muscle}</h3>
                <span className="text-[10px] text-slate-600">({exercises.length})</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <div className="space-y-1.5 px-3">
                {exercises.map(ex => {
                  const isExpanded = expandedId === ex.id;

                  return (
                    <div key={ex.id} className="bg-[#182634] rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                        className="flex items-center gap-3 px-3 py-3 w-full text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white line-clamp-1">{ex.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 capitalize">{ex.category}</span>
                            <span className="text-[10px] text-slate-600">·</span>
                            <span className="text-[10px] text-slate-500 capitalize">{ex.equipment}</span>
                            <span className="text-[10px] text-slate-600">·</span>
                            <span className={`text-[10px] capitalize ${
                              ex.difficulty === 'beginner' ? 'text-green-500' :
                              ex.difficulty === 'intermediate' ? 'text-yellow-500' : 'text-red-500'
                            }`}>{ex.difficulty}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {[...ex.primaryMuscles, ...ex.secondaryMuscles].map((m, i) => (
                              <span key={i} className="text-[9px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded-full capitalize">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-600 text-lg shrink-0">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-white/5">
                          <div className="mt-2">
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Form Cues</p>
                            <ul className="space-y-1">
                              {ex.formCues.map((cue, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                  <span className="text-[var(--color-primary)] mt-0.5 shrink-0">•</span>
                                  {cue}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span>{ex.defaultSets} sets × {ex.defaultReps} reps</span>
                            <span>Rest: {ex.defaultRest}s</span>
                          </div>

                          {mode === 'builder' && onSelectExercise && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectExercise(ex);
                              }}
                              className="mt-3 w-full py-2.5 bg-[var(--color-primary)] text-black font-bold rounded-xl text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-sm">add</span>
                              Add to Workout
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default memo(ExerciseLibrary);
