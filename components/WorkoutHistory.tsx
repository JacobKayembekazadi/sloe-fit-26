import React, { useState, useMemo } from 'react';
import type { CompletedWorkout, NutritionLog } from '../App';
import type { NutritionTargets } from '../hooks/useUserData';
import ProgressChart from './ProgressChart';
import WeeklyNutritionSummary from './WeeklyNutritionSummary';

// -- Interfaces --

type ViewMode = 'workouts' | 'charts';

interface WorkoutHistoryProps {
    history: CompletedWorkout[];
    nutritionLogs: NutritionLog[];
    nutritionTargets: NutritionTargets;
    onBack: () => void;
    goal?: string | null;
}

const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ history, nutritionLogs, nutritionTargets, onBack, goal }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('workouts');
    const [selectedFilter, setSelectedFilter] = useState<'All' | 'Strength' | 'Cardio' | 'Mindset'>('All');

    // -- Derived Data --

    // Calculate workout volume (sets * reps * weight)
    const calculateWorkoutVolume = (workout: CompletedWorkout): number => {
        return workout.log.reduce((vol, ex) => {
            const sets = parseInt(ex.sets) || 0;
            // Handle comma-separated reps (e.g., "8, 8, 6") - take first value
            const reps = parseInt(ex.reps?.split(',')[0]) || 0;
            const weight = parseFloat(ex.weight) || 0;
            return vol + (sets * reps * weight);
        }, 0);
    };

    // Calculate monthly volume from actual history
    const monthlyVolume = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        return history
            .filter(w => new Date(w.date) >= monthStart)
            .reduce((total, workout) => total + calculateWorkoutVolume(workout), 0);
    }, [history]);

    // Calculate weekly volume data for chart
    const weeklyVolumeData = useMemo(() => {
        const now = new Date();
        const weeks: { week: string; value: number; label: string }[] = [];

        // Get last 4 weeks
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);

            const weekVolume = history
                .filter(w => {
                    const d = new Date(w.date);
                    return d >= weekStart && d < weekEnd;
                })
                .reduce((total, workout) => total + calculateWorkoutVolume(workout), 0);

            weeks.push({
                week: `W${4 - i}`,
                value: weekVolume,
                label: `W${4 - i}`
            });
        }

        // Normalize to percentages for chart display (0-100)
        const maxVolume = Math.max(...weeks.map(w => w.value), 1);
        return weeks.map(w => ({
            ...w,
            value: Math.round((w.value / maxVolume) * 100)
        }));
    }, [history]);

    // Filtered History
    const filteredHistory = useMemo(() => {
        // Filter logic could be added here based on workout type tags
        return history;
    }, [history, selectedFilter]);


    // -- Render --

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white overflow-hidden transition-colors duration-300">

            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center p-4 justify-between">
                    <button onClick={onBack} className="flex size-10 shrink-0 items-center justify-center cursor-pointer rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-2xl">arrow_back_ios</span>
                    </button>
                    <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">Training History</h1>
                    <button
                        onClick={() => setViewMode(viewMode === 'workouts' ? 'charts' : 'workouts')}
                        className={`flex size-10 items-center justify-center cursor-pointer rounded-full transition-colors ${viewMode === 'charts' ? 'bg-[var(--color-primary)] text-black' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                    >
                        <span className="material-symbols-outlined text-2xl">insights</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-24">
                {viewMode === 'workouts' ? (
                    <>
                        {/* Monthly Volume Chart Section */}
                        <section className="px-4 py-6">
                            <div className="bg-white dark:bg-[#1C1C1E] rounded-xl p-5 shadow-sm border border-slate-200 dark:border-white/5">
                                <div className="flex flex-col gap-1 mb-6">
                                    <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Monthly Volume</p>
                                    <div className="flex items-baseline gap-2">
                                        <h2 className="text-3xl font-bold tracking-tight">{monthlyVolume.toLocaleString()} <span className="text-lg font-medium opacity-70">lbs</span></h2>
                                    </div>
                                    <p className="text-slate-400 dark:text-gray-500 text-xs">
                                        {monthlyVolume > 0 ? 'This month' : 'Start training to track volume'}
                                    </p>
                                </div>

                                {/* Simple CSS Bar Chart */}
                                <div className="grid grid-cols-4 gap-4 items-end h-32 px-2">
                                    {weeklyVolumeData.map((item, i) => (
                                        <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group">
                                            <div
                                                className={`w-full rounded-t-lg border-t-2 transition-all duration-500 ${i === 1 // Highlight current week or max week
                                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] opacity-100'
                                                        : 'bg-[var(--color-primary)]/20 dark:bg-[var(--color-primary)]/10 border-[var(--color-primary)] opacity-60 group-hover:opacity-80'
                                                    }`}
                                                style={{ height: `${item.value}%` }}
                                            ></div>
                                            <p className={`text-[10px] font-bold ${i === 1 ? 'text-[var(--color-primary)]' : 'text-slate-400 text-gray-500'}`}>{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Filters Section */}
                        <section className="px-4 overflow-x-auto pb-4 scrollbar-hide">
                            <div className="flex gap-2">
                                {['All', 'Strength', 'Cardio', 'Mindset'].map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => setSelectedFilter(filter as any)}
                                        className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors ${selectedFilter === filter
                                                ? 'bg-[var(--color-primary)] text-black shadow-sm'
                                                : 'bg-white dark:bg-[#223649] text-slate-600 dark:text-white border border-slate-200 dark:border-transparent'
                                            }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Recent Workouts List */}
                        <div className="flex items-center justify-between px-4 pb-2 pt-2">
                            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Recent Sessions</h3>
                            <span className="text-[var(--color-primary)] text-sm font-medium">View All</span>
                        </div>

                        <div className="space-y-px">
                            {filteredHistory.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No completed workouts yet. Start training!
                                </div>
                            ) : (
                                filteredHistory.map((workout, index) => (
                                    <div key={index} className="flex gap-4 px-4 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-slate-100 dark:border-white/5">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="flex items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] shrink-0 size-12 shadow-sm">
                                                <span className="material-symbols-outlined">fitness_center</span>
                                            </div>
                                            <div className="flex flex-1 flex-col justify-center">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-base font-bold text-slate-900 dark:text-white">{workout.title}</p>
                                                    {index === 0 && <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">New</span>}
                                                </div>
                                                <p className="text-slate-500 dark:text-[#90adcb] text-sm font-medium mt-0.5">
                                                    {workout.log.reduce((acc, ex) => acc + parseInt(ex.sets), 0)} Sets • {workout.log.length} Exercises
                                                </p>
                                                <p className="text-slate-400 dark:text-gray-500 text-[12px] mt-1 font-normal">{workout.date}</p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center">
                                            <span className="material-symbols-outlined text-slate-300 dark:text-gray-600">chevron_right</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    /* Charts View (Existing Logic + New Styling) */
                    <div className="space-y-6 px-4 py-6">
                        <WeeklyNutritionSummary
                            nutritionLogs={nutritionLogs}
                            targets={nutritionTargets}
                            goal={goal || null}
                        />
                        <div className="space-y-4">
                            <ProgressChart
                                data={nutritionLogs.slice(0, 14).map(l => ({ date: l.date, value: l.calories, target: nutritionTargets.calories })).reverse()}
                                title="Daily Calories"
                                color="#D4FF00"
                                unit=" kcal"
                                showTarget={true}
                                chartType="bar"
                            />
                            {/* Can add more charts here */}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WorkoutHistory;
