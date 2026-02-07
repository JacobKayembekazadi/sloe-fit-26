import React, { useState, useMemo, memo, useCallback } from 'react';
import type { CompletedWorkout, ExerciseLog } from '../App';
import type { WorkoutDraft } from './WorkoutSession';

const DRAFT_STORAGE_KEY = 'sloefit_workout_draft';

// Reuse from WorkoutHistory
const calculateWorkoutVolume = (workout: CompletedWorkout): number => {
    return workout.log.reduce((vol, ex) => {
        const sets = parseInt(ex.sets) || 0;
        const reps = parseInt(ex.reps?.split(',')[0]) || 0;
        const weight = parseFloat(ex.weight) || 0;
        return vol + (sets * reps * weight);
    }, 0);
};

const formatTimeAgo = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
};

interface TrainTabProps {
    workoutHistory: CompletedWorkout[];
    onStartWorkout: () => void;
    recoveryDraft: WorkoutDraft | null;
    onResumeDraft: () => void;
    onDiscardDraft: () => void;
}

const TrainTab: React.FC<TrainTabProps> = ({
    workoutHistory,
    onStartWorkout,
    recoveryDraft,
    onResumeDraft,
    onDiscardDraft,
}) => {
    const [selectedFilter, setSelectedFilter] = useState<'All' | 'Strength' | 'Cardio' | 'Mindset'>('All');
    const [showAllWorkouts, setShowAllWorkouts] = useState(false);
    const [selectedWorkout, setSelectedWorkout] = useState<CompletedWorkout | null>(null);

    // Week-at-a-glance
    const weekData = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const dayStatuses = days.map((label, i) => {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(startOfWeek.getDate() + i);
            const isToday = dayDate.toDateString() === now.toDateString();
            const isFuture = dayDate > now;
            const hasWorkout = workoutHistory.some(w => {
                const d = new Date(w.rawDate || w.date);
                return d.toDateString() === dayDate.toDateString();
            });
            return { label, isToday, isFuture, hasWorkout };
        });

        const completedCount = dayStatuses.filter(d => d.hasWorkout).length;
        return { days: dayStatuses, completedCount };
    }, [workoutHistory]);

    // Monthly volume chart data
    const weeklyVolumeData = useMemo(() => {
        const now = new Date();
        const weeks: { week: string; value: number; label: string; isCurrent: boolean }[] = [];

        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);

            const weekVolume = workoutHistory
                .filter(w => {
                    const d = new Date(w.rawDate || w.date);
                    return d >= weekStart && d < weekEnd;
                })
                .reduce((total, workout) => total + calculateWorkoutVolume(workout), 0);

            weeks.push({ week: `W${4 - i}`, value: weekVolume, label: `W${4 - i}`, isCurrent: i === 0 });
        }

        const maxVolume = Math.max(...weeks.map(w => w.value), 1);
        return weeks.map(w => ({ ...w, value: Math.round((w.value / maxVolume) * 100) }));
    }, [workoutHistory]);

    const monthlyVolume = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return workoutHistory
            .filter(w => new Date(w.rawDate || w.date) >= monthStart)
            .reduce((total, workout) => total + calculateWorkoutVolume(workout), 0);
    }, [workoutHistory]);

    // Filtered History
    const filteredHistory = useMemo(() => {
        if (selectedFilter === 'All') return workoutHistory;
        const filterLower = selectedFilter.toLowerCase();
        return workoutHistory.filter(w => {
            const titleLower = w.title.toLowerCase();
            if (filterLower === 'strength') {
                return titleLower.includes('strength') || titleLower.includes('push') ||
                    titleLower.includes('pull') || titleLower.includes('legs') ||
                    titleLower.includes('upper') || titleLower.includes('lower') ||
                    titleLower.includes('chest') || titleLower.includes('back');
            }
            if (filterLower === 'cardio') {
                return titleLower.includes('cardio') || titleLower.includes('hiit') ||
                    titleLower.includes('run') || titleLower.includes('cycling');
            }
            if (filterLower === 'mindset') {
                return titleLower.includes('yoga') || titleLower.includes('stretch') ||
                    titleLower.includes('mobility') || titleLower.includes('recovery');
            }
            return true;
        });
    }, [workoutHistory, selectedFilter]);

    const displayedHistory = useMemo(() => {
        return showAllWorkouts ? filteredHistory : filteredHistory.slice(0, 5);
    }, [filteredHistory, showAllWorkouts]);

    // Streak calculation
    const streak = useMemo(() => {
        if (workoutHistory.length === 0) return 0;
        let count = 0;
        const now = new Date();
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(now.getDate() - i);
            const dateStr = checkDate.toDateString();
            const hasWorkout = workoutHistory.some(w =>
                new Date(w.rawDate || w.date).toDateString() === dateStr
            );
            if (hasWorkout) {
                count++;
            } else if (i > 0) {
                break;
            }
        }
        return count;
    }, [workoutHistory]);

    return (
        <div className="w-full space-y-6 pb-8">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter">TRAIN</h2>
                    <p className="text-gray-400 text-sm font-medium">Your workout hub</p>
                </div>
                {streak > 0 && (
                    <div className="text-right">
                        <span className="text-[var(--color-primary)] font-bold text-xl">{streak}</span>
                        <span className="text-white/50 text-xs block">day streak</span>
                    </div>
                )}
            </header>

            {/* Draft Recovery Card */}
            {recoveryDraft && (
                <div className="card border-yellow-500/30 bg-yellow-500/5">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl">💪</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-white">Resume: {recoveryDraft.workoutTitle}</h3>
                            <p className="text-gray-400 text-sm">
                                {recoveryDraft.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)} sets completed · {formatTimeAgo(recoveryDraft.savedAt)}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onDiscardDraft}
                            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium transition-colors"
                        >
                            Discard
                        </button>
                        <button
                            onClick={onResumeDraft}
                            className="flex-1 py-3 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-black font-bold transition-opacity"
                        >
                            Resume
                        </button>
                    </div>
                </div>
            )}

            {/* Start Workout CTA */}
            {!recoveryDraft && (
                <div className="card bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border-[var(--color-primary)]/20">
                    <div className="py-4 text-center">
                        <div className="w-16 h-16 mx-auto bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center mb-4">
                            <span className="text-3xl">💪</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Start Today's Workout</h3>
                        <p className="text-gray-400 text-sm mb-6">AI-powered · personalized to your recovery</p>
                        <button
                            onClick={onStartWorkout}
                            className="btn-primary w-full"
                        >
                            START WORKOUT
                        </button>
                    </div>
                </div>
            )}

            {/* Week-at-a-Glance */}
            <div className="card">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">This Week</h3>
                    <span className="text-[var(--color-primary)] font-bold text-sm">{weekData.completedCount}/7 days</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {weekData.days.map((day, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                            <span className={`text-[10px] font-bold ${day.isToday ? 'text-[var(--color-primary)]' : 'text-gray-500'}`}>
                                {day.label}
                            </span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                day.hasWorkout
                                    ? 'bg-[var(--color-primary)] text-black'
                                    : day.isToday
                                        ? 'border-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                                        : day.isFuture
                                            ? 'bg-gray-800/50 text-gray-600'
                                            : 'bg-gray-800 text-gray-500'
                            }`}>
                                {day.hasWorkout ? '✓' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Monthly Volume */}
            <div className="card">
                <div className="flex flex-col gap-1 mb-4">
                    <p className="text-gray-400 text-sm font-medium">Monthly Volume</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-2xl font-bold tracking-tight text-white">{monthlyVolume.toLocaleString()} <span className="text-base font-medium opacity-70">lbs</span></h2>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-4 items-end h-24 px-2">
                    {weeklyVolumeData.map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group">
                            <div
                                className={`w-full rounded-t-lg border-t-2 transition-all duration-500 ${item.isCurrent
                                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] opacity-100'
                                    : 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] opacity-60 group-hover:opacity-80'
                                }`}
                                style={{ height: `${Math.max(item.value, 4)}%` }}
                            />
                            <p className={`text-[10px] font-bold ${item.isCurrent ? 'text-[var(--color-primary)]' : 'text-gray-500'}`}>{item.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-2">
                    {(['All', 'Strength', 'Cardio', 'Mindset'] as const).map(filter => (
                        <button
                            key={filter}
                            onClick={() => setSelectedFilter(filter)}
                            className={`flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors ${selectedFilter === filter
                                ? 'bg-[var(--color-primary)] text-black shadow-sm'
                                : 'bg-[#223649] text-white border border-transparent'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Recent Sessions */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold tracking-tight text-white">
                        {showAllWorkouts ? 'All Sessions' : 'Recent Sessions'}
                    </h3>
                    {filteredHistory.length > 5 && (
                        <button
                            onClick={() => setShowAllWorkouts(!showAllWorkouts)}
                            className="text-[var(--color-primary)] text-sm font-medium hover:underline"
                        >
                            {showAllWorkouts ? 'Show Less' : `All (${filteredHistory.length})`}
                        </button>
                    )}
                </div>

                <div className="space-y-2">
                    {displayedHistory.length === 0 ? (
                        <div className="card p-8 text-center text-gray-500">
                            {selectedFilter !== 'All'
                                ? `No ${selectedFilter.toLowerCase()} workouts found.`
                                : 'No completed workouts yet. Start training!'}
                        </div>
                    ) : (
                        displayedHistory.map((workout, index) => (
                            <button
                                key={`${workout.rawDate || workout.date}-${workout.title}-${index}`}
                                onClick={() => setSelectedWorkout(workout)}
                                className="card flex gap-4 p-4 hover:border-white/20 transition-colors cursor-pointer w-full text-left"
                            >
                                <div className="flex items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] shrink-0 size-12 shadow-sm">
                                    <span className="material-symbols-outlined">fitness_center</span>
                                </div>
                                <div className="flex flex-1 flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-bold text-white">{workout.title}</p>
                                        {index === 0 && !showAllWorkouts && (
                                            <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">New</span>
                                        )}
                                    </div>
                                    <p className="text-[#90adcb] text-sm font-medium mt-0.5">
                                        {workout.log.reduce((acc, ex) => acc + (parseInt(ex.sets) || 0), 0)} Sets · {workout.log.length} Exercises
                                    </p>
                                    <p className="text-gray-500 text-[12px] mt-1 font-normal">{workout.date}</p>
                                </div>
                                <div className="shrink-0 flex items-center">
                                    <span className="material-symbols-outlined text-gray-600">chevron_right</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Workout Detail Modal */}
            {selectedWorkout && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setSelectedWorkout(null); }}>
                    <div className="bg-[var(--bg-card)] w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <div>
                                <h2 className="text-lg font-bold text-white">{selectedWorkout.title}</h2>
                                <p className="text-gray-500 text-sm">{selectedWorkout.date}</p>
                            </div>
                            <button
                                onClick={() => setSelectedWorkout(null)}
                                className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 p-4 border-b border-white/10">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-[var(--color-primary)]">{selectedWorkout.log.length}</p>
                                <p className="text-xs text-gray-500">Exercises</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-white">
                                    {selectedWorkout.log.reduce((acc, ex) => acc + (parseInt(ex.sets) || 0), 0)}
                                </p>
                                <p className="text-xs text-gray-500">Total Sets</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-white">
                                    {calculateWorkoutVolume(selectedWorkout).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500">Volume (lbs)</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Exercises</h3>
                            {selectedWorkout.log.map((exercise, idx) => (
                                <div key={idx} className="bg-[#1C1C1E] rounded-xl p-4 border border-white/5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-bold text-white">{exercise.name}</p>
                                            <div className="flex gap-4 mt-2 text-sm">
                                                <span className="text-gray-400"><span className="text-white font-medium">{exercise.sets}</span> sets</span>
                                                <span className="text-gray-400"><span className="text-white font-medium">{exercise.reps}</span> reps</span>
                                                {exercise.weight && (
                                                    <span className="text-gray-400"><span className="text-[var(--color-primary)] font-medium">{exercise.weight}</span> lbs</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-gray-500">#{idx + 1}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-white/10">
                            <button
                                onClick={() => setSelectedWorkout(null)}
                                className="w-full py-3 bg-[var(--color-primary)] text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(TrainTab);
