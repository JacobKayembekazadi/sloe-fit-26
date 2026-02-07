import React, { useState, useMemo, memo, useCallback, useEffect } from 'react';
import type { CompletedWorkout, NutritionLog } from '../App';
import type { NutritionTargets, MealEntry } from '../hooks/useUserData';
import ProgressChart from './ProgressChart';
import WeeklyNutritionSummary from './WeeklyNutritionSummary';
import { calculateTotalVolume } from '../utils/workoutUtils';

// -- Interfaces --

type ViewMode = 'workouts' | 'charts' | 'meals';

interface WorkoutHistoryProps {
    history: CompletedWorkout[];
    nutritionLogs: NutritionLog[];
    nutritionTargets: NutritionTargets;
    onBack: () => void;
    goal?: string | null;
    mealEntries?: MealEntry[];
}

// Use shared utility for volume calculation
const calculateWorkoutVolume = (workout: CompletedWorkout): number => {
    return calculateTotalVolume(workout.log);
};

const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ history, nutritionLogs, nutritionTargets, onBack, goal, mealEntries = [] }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('workouts');
    const [selectedFilter, setSelectedFilter] = useState<'All' | 'Strength' | 'Cardio' | 'Mindset'>('All');
    const [showAllWorkouts, setShowAllWorkouts] = useState(false);
    const [selectedWorkout, setSelectedWorkout] = useState<CompletedWorkout | null>(null);
    const [selectedMealDate, setSelectedMealDate] = useState<string | null>(null);

    // Lock scroll on the actual scroll container when modal is open
    useEffect(() => {
        if (selectedWorkout) {
            const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement | null;
            if (scrollContainer) {
                scrollContainer.style.overflow = 'hidden';
                return () => { scrollContainer.style.overflow = ''; };
            }
        }
    }, [selectedWorkout]);

    // -- Derived Data (Memoized) --

    // Calculate monthly volume from actual history
    const monthlyVolume = useMemo(() => {
        if (history.length === 0) return 0;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        return history
            .filter(w => new Date(w.rawDate || w.date) >= monthStart)
            .reduce((total, workout) => total + calculateWorkoutVolume(workout), 0);
    }, [history]);

    // Calculate weekly volume data for chart - only recompute when history changes
    const weeklyVolumeData = useMemo(() => {
        const now = new Date();
        const weeks: { week: string; value: number; label: string; isCurrent: boolean }[] = [];

        // Get last 4 weeks
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);

            const weekVolume = history
                .filter(w => {
                    const d = new Date(w.rawDate || w.date);
                    return d >= weekStart && d < weekEnd;
                })
                .reduce((total, workout) => total + calculateWorkoutVolume(workout), 0);

            weeks.push({
                week: `W${4 - i}`,
                value: weekVolume,
                label: `W${4 - i}`,
                isCurrent: i === 0 // Current week is when i === 0
            });
        }

        // Normalize to percentages for chart display (0-100)
        const maxVolume = Math.max(...weeks.map(w => w.value), 1);
        return weeks.map(w => ({
            ...w,
            value: Math.round((w.value / maxVolume) * 100)
        }));
    }, [history]);

    // Filtered History - memoized with proper filter dependency
    const filteredHistory = useMemo(() => {
        // Filter based on workout title keywords (until proper tags are added)
        let filtered = history;
        if (selectedFilter !== 'All') {
            const filterLower = selectedFilter.toLowerCase();
            filtered = history.filter(w => {
                const titleLower = w.title.toLowerCase();
                // Match common workout type keywords
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
        }
        return filtered;
    }, [history, selectedFilter]);

    // Display history - show 5 recent or all based on state
    const displayedHistory = useMemo(() => {
        return showAllWorkouts ? filteredHistory : filteredHistory.slice(0, 5);
    }, [filteredHistory, showAllWorkouts]);

    // Memoize chart data to prevent recalculation on every render
    const chartData = useMemo(() =>
        nutritionLogs.slice(0, 14).map(l => ({
            date: l.date,
            value: l.calories,
            target: nutritionTargets.calories
        })).reverse(),
        [nutritionLogs, nutritionTargets.calories]
    );

    // Group meal entries by date for display - Bug #5 fix
    const mealsByDate = useMemo(() => {
        const grouped: { [date: string]: MealEntry[] } = {};
        for (const meal of mealEntries) {
            const date = meal.date;
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(meal);
        }
        // Sort dates descending and return as array
        return Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, meals]) => ({
                date,
                displayDate: new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                }),
                meals: meals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
                totalCalories: meals.reduce((sum, m) => sum + m.calories, 0),
                totalProtein: meals.reduce((sum, m) => sum + m.protein, 0)
            }));
    }, [mealEntries]);

    // Memoize callbacks to prevent child re-renders
    const cycleViewMode = useCallback(() => {
        setViewMode(prev => {
            if (prev === 'workouts') return 'meals';
            if (prev === 'meals') return 'charts';
            return 'workouts';
        });
    }, []);


    // -- Render --

    return (
        <div className="flex flex-col min-h-full bg-background-dark font-display text-white transition-colors duration-300">

            {/* Top Navigation Bar */}
            <header className="z-50 bg-background-dark/80 border-b border-white/5">
                <div className="flex items-center p-4 justify-between">
                    <button onClick={onBack} className="flex size-11 min-w-[44px] min-h-[44px] shrink-0 items-center justify-center cursor-pointer rounded-full hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-2xl">arrow_back_ios</span>
                    </button>
                    <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">
                        {viewMode === 'workouts' ? 'Training History' : viewMode === 'meals' ? 'Meal History' : 'Nutrition Charts'}
                    </h1>
                    <button
                        onClick={cycleViewMode}
                        className={`flex size-11 min-w-[44px] min-h-[44px] items-center justify-center cursor-pointer rounded-full transition-colors ${viewMode !== 'workouts' ? 'bg-[var(--color-primary)] text-black' : 'hover:bg-white/10'}`}
                        title={viewMode === 'workouts' ? 'View Meals' : viewMode === 'meals' ? 'View Charts' : 'View Workouts'}
                    >
                        <span className="material-symbols-outlined text-2xl">
                            {viewMode === 'workouts' ? 'restaurant' : viewMode === 'meals' ? 'insights' : 'fitness_center'}
                        </span>
                    </button>
                </div>
            </header>

            {/* Workout Detail Modal */}
            {selectedWorkout && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setSelectedWorkout(null); }}>
                    <div className="bg-background-dark w-full max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
                        {/* Modal Header */}
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

                        {/* Modal Stats */}
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

                        {/* Exercise List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Exercises</h3>
                            {selectedWorkout.log.map((exercise, idx) => (
                                <div key={idx} className="bg-[#1C1C1E] rounded-xl p-4 border border-white/5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-bold text-white">{exercise.name}</p>
                                            <div className="flex gap-4 mt-2 text-sm">
                                                <span className="text-gray-400">
                                                    <span className="text-white font-medium">{exercise.sets}</span> sets
                                                </span>
                                                <span className="text-gray-400">
                                                    <span className="text-white font-medium">{exercise.reps}</span> reps
                                                </span>
                                                {exercise.weight && (
                                                    <span className="text-gray-400">
                                                        <span className="text-[var(--color-primary)] font-medium">{exercise.weight}</span> lbs
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-gray-500">
                                            #{idx + 1}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
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

            <main className="flex-1">
                {viewMode === 'workouts' ? (
                    <>
                        {/* Monthly Volume Chart Section */}
                        <section className="px-4 py-6">
                            <div className="bg-[#1C1C1E] rounded-xl p-5 shadow-sm border border-white/5">
                                <div className="flex flex-col gap-1 mb-6">
                                    <p className="text-gray-400 text-sm font-medium">Monthly Volume</p>
                                    <div className="flex items-baseline gap-2">
                                        <h2 className="text-3xl font-bold tracking-tight">{monthlyVolume.toLocaleString()} <span className="text-lg font-medium opacity-70">lbs</span></h2>
                                    </div>
                                    <p className="text-gray-500 text-xs">
                                        {monthlyVolume > 0 ? 'This month' : 'Start training to track volume'}
                                    </p>
                                </div>

                                {/* Simple CSS Bar Chart */}
                                <div className="grid grid-cols-4 gap-4 items-end h-32 px-2">
                                    {weeklyVolumeData.map((item, i) => (
                                        <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group">
                                            <div
                                                className={`w-full rounded-t-lg border-t-2 transition-all duration-500 ${item.isCurrent
                                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] opacity-100'
                                                        : 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] opacity-60 group-hover:opacity-80'
                                                    }`}
                                                style={{ height: `${Math.max(item.value, 4)}%` }}
                                            ></div>
                                            <p className={`text-[10px] font-bold ${item.isCurrent ? 'text-[var(--color-primary)]' : 'text-gray-500'}`}>{item.label}</p>
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
                                        className={`flex h-11 min-h-[44px] shrink-0 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors ${selectedFilter === filter
                                                ? 'bg-[var(--color-primary)] text-black shadow-sm'
                                                : 'bg-[#223649] text-white border border-transparent'
                                            }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Recent Workouts List */}
                        <div className="flex items-center justify-between px-4 pb-2 pt-2">
                            <h3 className="text-lg font-bold tracking-tight text-white">
                                {showAllWorkouts ? 'All Sessions' : 'Recent Sessions'}
                            </h3>
                            {filteredHistory.length > 5 && (
                                <button
                                    onClick={() => setShowAllWorkouts(!showAllWorkouts)}
                                    className="text-[var(--color-primary)] text-sm font-medium hover:underline"
                                >
                                    {showAllWorkouts ? 'Show Less' : `View All (${filteredHistory.length})`}
                                </button>
                            )}
                        </div>

                        <div className="space-y-px">
                            {displayedHistory.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    {selectedFilter !== 'All'
                                        ? `No ${selectedFilter.toLowerCase()} workouts found.`
                                        : 'No completed workouts yet. Start training!'}
                                </div>
                            ) : (
                                displayedHistory.map((workout, index) => (
                                    <button
                                        key={`${workout.rawDate || workout.date}-${workout.title}-${index}`}
                                        onClick={() => setSelectedWorkout(workout)}
                                        className="flex gap-4 px-4 py-4 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5 w-full text-left"
                                    >
                                        <div className="flex items-start gap-4 flex-1">
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
                                                    {workout.log.reduce((acc, ex) => acc + (parseInt(ex.sets) || 0), 0)} Sets • {workout.log.length} Exercises
                                                </p>
                                                <p className="text-gray-500 text-[12px] mt-1 font-normal">{workout.date}</p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center">
                                            <span className="material-symbols-outlined text-gray-600">chevron_right</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </>
                ) : viewMode === 'meals' ? (
                    /* Meal History View - Bug #5 fix */
                    <div className="px-4 py-6 space-y-4">
                        {mealsByDate.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <span className="text-4xl mb-4 block">🍽️</span>
                                <p>No meals logged yet.</p>
                                <p className="text-sm mt-1">Start tracking your nutrition!</p>
                            </div>
                        ) : (
                            mealsByDate.map(({ date, displayDate, meals, totalCalories, totalProtein }) => (
                                <div key={date} className="bg-[#1C1C1E] rounded-xl overflow-hidden border border-white/5">
                                    {/* Date Header */}
                                    <button
                                        onClick={() => setSelectedMealDate(selectedMealDate === date ? null : date)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 shrink-0 size-10">
                                                <span className="material-symbols-outlined text-xl">restaurant</span>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-white">{displayDate}</p>
                                                <p className="text-gray-500 text-sm">{meals.length} meal{meals.length !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-[var(--color-primary)] font-bold">{totalCalories} cal</p>
                                                <p className="text-blue-400 text-sm">{totalProtein}g protein</p>
                                            </div>
                                            <span className={`material-symbols-outlined text-gray-500 transition-transform ${selectedMealDate === date ? 'rotate-180' : ''}`}>
                                                expand_more
                                            </span>
                                        </div>
                                    </button>

                                    {/* Expanded Meals */}
                                    {selectedMealDate === date && (
                                        <div className="border-t border-white/5">
                                            {meals.map((meal) => (
                                                <div key={meal.id} className="px-4 py-3 border-b border-white/5 last:border-b-0">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-medium text-white">{meal.description || 'Meal'}</p>
                                                            <p className="text-gray-500 text-xs mt-1">
                                                                {new Date(meal.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                                {meal.meal_type && ` • ${meal.meal_type}`}
                                                                {meal.input_method && ` • ${meal.input_method.replace('_', ' ')}`}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[var(--color-primary)] font-medium">{meal.calories} cal</p>
                                                            <p className="text-xs text-gray-500">
                                                                P:{meal.protein}g C:{meal.carbs}g F:{meal.fats}g
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    /* Charts View */
                    <div className="space-y-6 px-4 py-6">
                        <WeeklyNutritionSummary
                            nutritionLogs={nutritionLogs}
                            targets={nutritionTargets}
                            goal={goal || null}
                        />
                        <div className="space-y-4">
                            <ProgressChart
                                data={chartData}
                                title="Daily Calories"
                                color="#D4FF00"
                                unit=" kcal"
                                showTarget={true}
                                chartType="bar"
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default memo(WorkoutHistory);
