
import React, { useState, useMemo } from 'react';
import type { CompletedWorkout, NutritionLog } from '../App';
import type { NutritionTargets } from '../hooks/useUserData';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import ProgressChart from './ProgressChart';

type ViewMode = 'workouts' | 'charts';

interface WorkoutHistoryProps {
    history: CompletedWorkout[];
    nutritionLogs: NutritionLog[];
    nutritionTargets: NutritionTargets;
    onBack: () => void;
}

const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ history, nutritionLogs, nutritionTargets, onBack }) => {
    const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(0);
    const [viewMode, setViewMode] = useState<ViewMode>('workouts');

    // Transform nutrition logs for charts (last 14 days, sorted by date)
    const calorieChartData = useMemo(() => {
        return nutritionLogs
            .slice(0, 14)
            .map(log => ({
                date: log.date,
                value: log.calories,
                target: nutritionTargets.calories
            }))
            .reverse();
    }, [nutritionLogs, nutritionTargets]);

    const proteinChartData = useMemo(() => {
        return nutritionLogs
            .slice(0, 14)
            .map(log => ({
                date: log.date,
                value: log.protein,
                target: nutritionTargets.protein
            }))
            .reverse();
    }, [nutritionLogs, nutritionTargets]);

    // Workout frequency (workouts per week) for last 4 weeks
    const workoutFrequencyData = useMemo(() => {
        const weeks: { [key: string]: number } = {};
        const now = new Date();

        // Initialize last 4 weeks
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (now.getDay() + (i * 7)));
            const weekKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            weeks[weekKey] = 0;
        }

        // Count workouts per week
        history.forEach(workout => {
            const workoutDate = new Date(workout.date);
            const weekStart = new Date(workoutDate);
            weekStart.setDate(workoutDate.getDate() - workoutDate.getDay());
            const weekKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (weeks[weekKey] !== undefined) {
                weeks[weekKey]++;
            }
        });

        return Object.entries(weeks).map(([date, value]) => ({ date, value }));
    }, [history]);

    const toggleLogDetails = (index: number) => {
        setSelectedLogIndex(prevIndex => (prevIndex === index ? null : index));
    };

    return (
        <div className="w-full animate-fade-in">
            {/* Header with back button */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-bold text-white">
                    {viewMode === 'workouts' ? 'History' : 'Progress'}
                </h2>
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-md text-white font-semibold hover:bg-gray-700 transition-colors">
                    <ArrowLeftIcon />
                    Back
                </button>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setViewMode('workouts')}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-colors ${
                        viewMode === 'workouts'
                            ? 'bg-[var(--color-primary)] text-black'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    Workouts
                </button>
                <button
                    onClick={() => setViewMode('charts')}
                    className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-colors ${
                        viewMode === 'charts'
                            ? 'bg-[var(--color-primary)] text-black'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    Charts
                </button>
            </div>

            {/* Workouts View */}
            {viewMode === 'workouts' && (
                <>
                    {history.length === 0 ? (
                        <div className="bg-gray-900 border border-gray-800 p-8 rounded-lg text-center">
                            <p className="text-gray-400">You haven't completed any workouts yet.</p>
                            <p className="text-gray-500 text-sm mt-2">Once you log a workout on the dashboard, it will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((workout, index) => (
                                <div key={index} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                                    <button
                                        className="w-full p-4 text-left flex justify-between items-center hover:bg-gray-800"
                                        onClick={() => toggleLogDetails(index)}
                                        aria-expanded={selectedLogIndex === index}
                                    >
                                        <div>
                                            <p className="font-bold text-white">{workout.title}</p>
                                            <p className="text-sm text-gray-400">{workout.date}</p>
                                        </div>
                                        <span className={`transform transition-transform duration-300 ${selectedLogIndex === index ? 'rotate-180' : ''}`}>
                                            ▼
                                        </span>
                                    </button>
                                    {selectedLogIndex === index && (
                                        <div className="p-4 border-t border-gray-800 animate-fade-in">
                                            <ul className="space-y-2 text-gray-300">
                                                {workout.log.map(ex => (
                                                    <li key={ex.id} className="p-3 bg-gray-800/50 rounded-md text-sm">
                                                        <span className="font-bold text-white">{ex.name}:</span>
                                                        <span className="ml-2">{ex.sets} sets</span>
                                                        <span className="mx-1">×</span>
                                                        <span>{ex.reps} reps</span>
                                                        {ex.weight && <span className="ml-2 text-gray-300">@ {ex.weight} lbs</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Charts View */}
            {viewMode === 'charts' && (
                <div className="space-y-6">
                    <ProgressChart
                        data={calorieChartData}
                        title="Daily Calories (Last 14 Days)"
                        color="#D4FF00"
                        unit=" kcal"
                        showTarget={true}
                        chartType="bar"
                    />
                    <ProgressChart
                        data={proteinChartData}
                        title="Daily Protein (Last 14 Days)"
                        color="#22C55E"
                        unit="g"
                        showTarget={true}
                        chartType="line"
                    />
                    <ProgressChart
                        data={workoutFrequencyData}
                        title="Workouts Per Week"
                        color="#3B82F6"
                        unit=" workouts"
                        chartType="bar"
                    />
                </div>
            )}
        </div>
    );
};

export default WorkoutHistory;
