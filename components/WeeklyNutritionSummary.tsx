import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import type { NutritionLog } from '../App';
import { useToast } from '../contexts/ToastContext';
import LoaderIcon from './icons/LoaderIcon';
import Skeleton from './ui/Skeleton';
import { analyzeWeeklyNutrition, WeeklyNutritionInsights } from '../services/aiService';

interface WeeklyNutritionSummaryProps {
    nutritionLogs: NutritionLog[];
    targets: { calories: number; protein: number; carbs: number; fats: number };
    goal: string | null;
}

interface AIInsights {
    adherence_score: number;
    summary: string;
    wins: string[];
    focus_area: string;
    tip: string;
}

// Day labels for the week - defined outside component to prevent recreation
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Helper functions outside component to prevent recreation
const getAdherenceColor = (adherence: number) => {
    if (adherence >= 90) return 'text-green-400';
    if (adherence >= 70) return 'text-yellow-400';
    return 'text-red-400';
};

const getAdherenceBg = (adherence: number) => {
    if (adherence >= 90) return 'bg-green-500';
    if (adherence >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
};

const WeeklyNutritionSummary: React.FC<WeeklyNutritionSummaryProps> = ({
    nutritionLogs,
    targets,
    goal
}) => {
    const { showToast } = useToast();
    const [showDetails, setShowDetails] = useState(false);
    const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<'calories' | 'protein' | 'carbs' | 'fats'>('calories');

    // Get last 7 days with proper date alignment
    const weekData = useMemo(() => {
        const today = new Date();
        const days: { date: string; dayOfWeek: number; log: NutritionLog | null }[] = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();

            // Find matching log (handle different date formats)
            const log = nutritionLogs.find(l => {
                const logDate = l.date.includes('T') ? l.date.split('T')[0] : l.date;
                // Direct YYYY-MM-DD match (most common path)
                if (logDate === dateStr) return true;
                // Fallback: parse formatted dates like "February 2, 2026"
                try {
                    const parsed = new Date(l.date);
                    if (isNaN(parsed.getTime())) {
                        console.warn('[WeeklyNutritionSummary] Unparseable date in nutrition log:', l.date);
                        return false;
                    }
                    return parsed.toISOString().split('T')[0] === dateStr;
                } catch {
                    console.warn('[WeeklyNutritionSummary] Failed to parse date:', l.date);
                    return false;
                }
            }) || null;

            days.push({ date: dateStr, dayOfWeek, log });
        }

        return days;
    }, [nutritionLogs]);

    // Calculate statistics
    const stats = useMemo(() => {
        const logsWithData = weekData.filter(d => d.log !== null).map(d => d.log!);
        const daysTracked = logsWithData.length;

        if (daysTracked === 0) {
            return {
                daysTracked: 0,
                avgCalories: 0,
                avgProtein: 0,
                avgCarbs: 0,
                avgFats: 0,
                totalCalories: 0,
                totalProtein: 0,
                calorieAdherence: 0,
                proteinAdherence: 0,
                carbsAdherence: 0,
                fatsAdherence: 0,
                overallAdherence: 0,
                daysOnTarget: 0,
                streak: 0
            };
        }

        const totalCalories = logsWithData.reduce((sum, l) => sum + l.calories, 0);
        const totalProtein = logsWithData.reduce((sum, l) => sum + l.protein, 0);
        const totalCarbs = logsWithData.reduce((sum, l) => sum + l.carbs, 0);
        const totalFats = logsWithData.reduce((sum, l) => sum + l.fats, 0);

        const avgCalories = Math.round(totalCalories / daysTracked);
        const avgProtein = Math.round(totalProtein / daysTracked);
        const avgCarbs = Math.round(totalCarbs / daysTracked);
        const avgFats = Math.round(totalFats / daysTracked);

        const calorieAdherence = targets.calories > 0 ? Math.min(100, Math.round((avgCalories / targets.calories) * 100)) : 0;
        const proteinAdherence = targets.protein > 0 ? Math.min(100, Math.round((avgProtein / targets.protein) * 100)) : 0;
        const carbsAdherence = targets.carbs > 0 ? Math.min(100, Math.round((avgCarbs / targets.carbs) * 100)) : 0;
        const fatsAdherence = targets.fats > 0 ? Math.min(100, Math.round((avgFats / targets.fats) * 100)) : 0;
        const overallAdherence = Math.round((calorieAdherence + proteinAdherence) / 2);

        // Days where calories are within 85-115% of target
        const daysOnTarget = targets.calories > 0 ? logsWithData.filter(l => {
            const ratio = l.calories / targets.calories;
            return ratio >= 0.85 && ratio <= 1.15;
        }).length : 0;

        // Calculate current streak (consecutive days with data from today backwards)
        let streak = 0;
        for (let i = weekData.length - 1; i >= 0; i--) {
            if (weekData[i].log) streak++;
            else break;
        }

        return {
            daysTracked,
            avgCalories,
            avgProtein,
            avgCarbs,
            avgFats,
            totalCalories,
            totalProtein,
            calorieAdherence,
            proteinAdherence,
            carbsAdherence,
            fatsAdherence,
            overallAdherence,
            daysOnTarget,
            streak
        };
    }, [weekData, targets]);

    // Generate local insights (fallback when AI not available)
    const localInsights = useMemo((): AIInsights => {
        const wins: string[] = [];
        let focusArea = '';
        let tip = '';
        let summary = '';

        // Generate wins
        if (stats.proteinAdherence >= 90) {
            wins.push('Protein target consistently hit');
        }
        if (stats.daysTracked >= 5) {
            wins.push('Tracked 5+ days this week');
        }
        if (stats.streak >= 3) {
            wins.push(`${stats.streak}-day tracking streak`);
        }
        if (stats.daysOnTarget >= 4) {
            wins.push('Stayed on target most days');
        }
        if (wins.length === 0) {
            wins.push('Started tracking - great first step!');
        }

        // Generate focus area and tip based on data
        if (stats.proteinAdherence < 80) {
            focusArea = 'Increase protein intake to support your goals';
            tip = 'Add a protein shake or extra chicken breast to hit your daily target.';
        } else if (goal === 'CUT' && stats.calorieAdherence > 105) {
            focusArea = 'Slight calorie reduction needed for optimal cutting';
            tip = 'Try swapping one snack for vegetables or reducing portion sizes by 10%.';
        } else if (goal === 'BULK' && stats.calorieAdherence < 90) {
            focusArea = 'Need more calories to support muscle growth';
            tip = 'Add calorie-dense foods like nuts, olive oil, or an extra meal.';
        } else if (stats.daysTracked < 5) {
            focusArea = 'Improve tracking consistency';
            tip = 'Set a daily reminder to log your meals - consistency is key!';
        } else {
            focusArea = 'Maintain current momentum';
            tip = 'Keep doing what you\'re doing - consistency beats perfection.';
        }

        // Generate summary
        if (stats.overallAdherence >= 90) {
            summary = `Excellent week! You hit ${stats.daysOnTarget} of 7 days on target with ${stats.avgCalories} avg calories.`;
        } else if (stats.overallAdherence >= 70) {
            summary = `Good progress this week. ${stats.daysTracked} days tracked with ${stats.avgProtein}g avg protein.`;
        } else {
            summary = `Room to improve - focus on consistency. You tracked ${stats.daysTracked} days this week.`;
        }

        return {
            adherence_score: stats.overallAdherence,
            summary,
            wins,
            focus_area: focusArea,
            tip
        };
    }, [stats, goal]);

    // Fetch AI insights when data is available
    const fetchAiInsights = useCallback(async () => {
        if (stats.daysTracked < 2) {
            setAiInsights(localInsights);
            return;
        }

        setLoadingInsights(true);
        try {
            const logsForAI = weekData
                .filter(d => d.log !== null)
                .map(d => ({
                    date: d.date,
                    calories: d.log!.calories,
                    protein: d.log!.protein,
                    carbs: d.log!.carbs,
                    fats: d.log!.fats
                }));

            const insights = await analyzeWeeklyNutrition({
                logs: logsForAI,
                targets,
                goal
            });

            if (insights) {
                setAiInsights(insights);
            } else {
                setAiInsights(localInsights);
                showToast('Using local analysis — AI unavailable', 'info');
            }
        } catch (error) {
            setAiInsights(localInsights);
            showToast('Using local analysis — AI unavailable', 'info');
        } finally {
            setLoadingInsights(false);
        }
    }, [weekData, targets, goal, stats.daysTracked, localInsights]);

    // Use local insights by default, fetch AI insights on demand
    useEffect(() => {
        setAiInsights(localInsights);
    }, [localInsights]);

    // Auto-fetch AI insights when sufficient data is available
    const [hasFetchedAI, setHasFetchedAI] = useState(false);
    const fetchAiInsightsRef = useRef(fetchAiInsights);
    fetchAiInsightsRef.current = fetchAiInsights;

    useEffect(() => {
        if (stats.daysTracked >= 3 && !hasFetchedAI && !loadingInsights) {
            setHasFetchedAI(true);
            fetchAiInsightsRef.current();
        }
    }, [stats.daysTracked, hasFetchedAI, loadingInsights]);

    // Get bar height for chart (relative to target)
    const getBarHeight = (value: number, target: number) => {
        if (target === 0) return 0;
        const ratio = value / target;
        // Cap at 120% for visual purposes
        return Math.min(ratio * 100, 120);
    };

    // Get value for selected metric
    const getMetricValue = (log: NutritionLog | null) => {
        if (!log) return 0;
        return log[selectedMetric];
    };

    const getMetricTarget = () => {
        return targets[selectedMetric];
    };

    const getMetricUnit = () => {
        return selectedMetric === 'calories' ? 'kcal' : 'g';
    };

    // Empty state
    if (stats.daysTracked === 0) {
        return (
            <div className="card">
                <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <span className="text-3xl">📊</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No Data Yet</h3>
                    <p className="text-gray-400 text-sm">Log your meals to see weekly insights and trends.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card space-y-5">
            {/* Header with Score */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-white">Weekly Summary</h3>
                    <p className="text-gray-500 text-xs">
                        {stats.daysTracked} of 7 days tracked
                        {stats.streak > 1 && <span className="text-[var(--color-primary)]"> · {stats.streak} day streak 🔥</span>}
                    </p>
                </div>
                <div className="text-right">
                    <div className={`text-3xl font-black ${getAdherenceColor(stats.overallAdherence)}`}>
                        {stats.overallAdherence}%
                    </div>
                    <div className="text-xs text-gray-500">adherence</div>
                </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="bg-black/30 rounded-xl p-4">
                {/* Metric Selector */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {(['calories', 'protein', 'carbs', 'fats'] as const).map((metric) => (
                        <button
                            key={metric}
                            onClick={() => setSelectedMetric(metric)}
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                selectedMetric === metric
                                    ? 'bg-[var(--color-primary)] text-black'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            {metric.charAt(0).toUpperCase() + metric.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Chart */}
                <div className="flex items-end justify-between gap-1 h-32 relative">
                    {/* Target line */}
                    <div
                        className="absolute left-0 right-0 border-t-2 border-dashed border-[var(--color-primary)]/50"
                        style={{ bottom: '83.33%' }} // 100/120 * 100 = 83.33%
                    />

                    {weekData.map((day, idx) => {
                        const value = getMetricValue(day.log);
                        const target = getMetricTarget();
                        const height = getBarHeight(value, target);
                        const isToday = idx === weekData.length - 1;
                        const onTarget = day.log && value >= target * 0.85 && value <= target * 1.15;

                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                {/* Bar */}
                                <div className="w-full h-24 flex items-end justify-center">
                                    <div
                                        className={`w-full max-w-[32px] rounded-t transition-all duration-500 ${
                                            !day.log
                                                ? 'bg-gray-800'
                                                : onTarget
                                                    ? 'bg-gradient-to-t from-green-600 to-green-400'
                                                    : value > target
                                                        ? 'bg-gradient-to-t from-yellow-600 to-yellow-400'
                                                        : 'bg-gradient-to-t from-red-600 to-red-400'
                                        } ${isToday ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
                                        style={{ height: `${Math.max(height, 4)}%` }}
                                        title={day.log ? `${value} ${getMetricUnit()}` : 'No data'}
                                    />
                                </div>

                                {/* Day label */}
                                <span className={`text-xs font-bold ${
                                    isToday ? 'text-[var(--color-primary)]' : day.log ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                    {DAY_LABELS_SHORT[day.dayOfWeek]}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                    <span>Target: {getMetricTarget().toLocaleString()} {getMetricUnit()}</span>
                    <span>Avg: {stats[`avg${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}` as keyof typeof stats]?.toLocaleString()} {getMetricUnit()}</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                    { label: 'Calories', value: stats.avgCalories, unit: '', adherence: stats.calorieAdherence },
                    { label: 'Protein', value: stats.avgProtein, unit: 'g', adherence: stats.proteinAdherence },
                    { label: 'Carbs', value: stats.avgCarbs, unit: 'g', adherence: stats.carbsAdherence },
                    { label: 'Fats', value: stats.avgFats, unit: 'g', adherence: stats.fatsAdherence },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-black/30 rounded-lg p-2 sm:p-2 text-center">
                        <div className="text-[10px] text-gray-500 uppercase">{stat.label}</div>
                        <div className="text-base sm:text-lg font-bold text-white">{stat.value.toLocaleString()}{stat.unit}</div>
                        <div className={`text-[10px] ${getAdherenceColor(stat.adherence)}`}>
                            {stat.adherence}%
                        </div>
                    </div>
                ))}
            </div>

            {/* AI Insights Card */}
            {aiInsights && (
                <div className="space-y-3">
                    {/* Summary */}
                    <div className="bg-gradient-to-r from-[var(--color-primary)]/10 to-transparent border border-[var(--color-primary)]/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center flex-shrink-0">
                                {loadingInsights ? (
                                    <LoaderIcon className="w-5 h-5 text-[var(--color-primary)] animate-spin motion-reduce:animate-none" />
                                ) : (
                                    <span className="text-lg">🤖</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-xs text-[var(--color-primary)] uppercase font-bold">AI Analysis</div>
                                    {stats.daysTracked >= 2 && (
                                        <button
                                            onClick={() => fetchAiInsights()}
                                            disabled={loadingInsights}
                                            className="text-xs text-gray-500 hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
                                        >
                                            {loadingInsights ? 'Analyzing...' : 'Refresh'}
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-gray-200">{aiInsights.summary}</p>
                            </div>
                        </div>
                    </div>

                    {/* Expandable Details */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
                    >
                        <span className="text-sm text-gray-400">
                            {showDetails ? 'Hide details' : 'Show wins & tips'}
                        </span>
                        <span className={`text-gray-400 transition-transform ${showDetails ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </button>

                    {loadingInsights && (
                        <div className="space-y-3">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 space-y-2">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-3 w-4/5" />
                                <Skeleton className="h-3 w-3/5" />
                            </div>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 space-y-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        </div>
                    )}

                    {showDetails && !loadingInsights && (
                        <div className="space-y-3 animate-slide-up">
                            {/* Wins */}
                            {aiInsights.wins.length > 0 && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                    <div className="text-xs text-green-400 uppercase font-bold mb-2">🏆 This Week's Wins</div>
                                    <ul className="space-y-1">
                                        {aiInsights.wins.map((win, idx) => (
                                            <li key={idx} className="text-sm text-gray-300 flex items-center gap-2">
                                                <span className="text-green-400">✓</span> {win}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Focus Area */}
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                <div className="text-xs text-yellow-400 uppercase font-bold mb-1">🎯 Focus Area</div>
                                <p className="text-sm text-gray-300">{aiInsights.focus_area}</p>
                            </div>

                            {/* Tip */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                <div className="text-xs text-blue-400 uppercase font-bold mb-1">💡 Pro Tip</div>
                                <p className="text-sm text-gray-300">{aiInsights.tip}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Week at a Glance - Mini Calendar */}
            <div className="pt-2 border-t border-white/5">
                <div className="text-xs text-gray-500 uppercase mb-2">Week at a Glance</div>
                <div className="flex justify-between gap-1">
                    {weekData.map((day, idx) => {
                        const isToday = idx === weekData.length - 1;
                        const hasData = !!day.log;
                        const onTarget = hasData && day.log!.calories >= targets.calories * 0.85 && day.log!.calories <= targets.calories * 1.15;
                        const overTarget = hasData && day.log!.calories > targets.calories * 1.15;

                        return (
                            <div
                                key={idx}
                                className={`flex-1 py-2 rounded text-center transition-all ${
                                    isToday ? 'ring-2 ring-[var(--color-primary)]' : ''
                                } ${
                                    hasData
                                        ? onTarget
                                            ? 'bg-green-500/20 text-green-400'
                                            : overTarget
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : 'bg-red-500/20 text-red-400'
                                        : 'bg-gray-800 text-gray-600'
                                }`}
                                title={hasData ? `${day.log!.calories} kcal` : 'No data'}
                            >
                                <div className="text-xs font-bold">{DAY_LABELS_SHORT[day.dayOfWeek]}</div>
                                {hasData && (
                                    <div className="text-[10px] mt-0.5">
                                        {onTarget ? '✓' : overTarget ? '↑' : '↓'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default memo(WeeklyNutritionSummary);
