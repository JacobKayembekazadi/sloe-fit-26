import React from 'react';
import type { NutritionLog } from '../App';

interface WeeklyNutritionSummaryProps {
    nutritionLogs: NutritionLog[];
    targets: { calories: number; protein: number; carbs: number; fats: number };
    goal: string | null;
}

const WeeklyNutritionSummary: React.FC<WeeklyNutritionSummaryProps> = ({
    nutritionLogs,
    targets,
    goal
}) => {
    // Get last 7 days of logs
    const last7Days = nutritionLogs.slice(0, 7);

    if (last7Days.length === 0) {
        return (
            <div className="card text-center py-8">
                <p className="text-gray-400">Log your meals to see weekly insights.</p>
            </div>
        );
    }

    // Calculate averages
    const avgCalories = Math.round(last7Days.reduce((sum, l) => sum + l.calories, 0) / last7Days.length);
    const avgProtein = Math.round(last7Days.reduce((sum, l) => sum + l.protein, 0) / last7Days.length);

    // Calculate adherence
    const calorieAdherence = Math.min(100, Math.round((avgCalories / targets.calories) * 100));
    const proteinAdherence = Math.min(100, Math.round((avgProtein / targets.protein) * 100));
    const overallAdherence = Math.round((calorieAdherence + proteinAdherence) / 2);

    // Determine status
    const getStatusColor = (adherence: number) => {
        if (adherence >= 90) return 'text-green-400';
        if (adherence >= 70) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getStatusEmoji = (adherence: number) => {
        if (adherence >= 90) return '🔥';
        if (adherence >= 70) return '💪';
        return '📈';
    };

    // Generate simple insights
    const getInsight = () => {
        if (proteinAdherence < 80) {
            return "Focus on hitting your protein target - try adding a protein shake or extra chicken to meals.";
        }
        if (goal === 'CUT' && calorieAdherence > 100) {
            return "You're slightly over your calorie target. Try smaller portions or swapping snacks.";
        }
        if (goal === 'BULK' && calorieAdherence < 90) {
            return "You're under your calorie target. Add calorie-dense foods like nuts, olive oil, or an extra meal.";
        }
        return "Great consistency! Keep hitting your targets and trust the process.";
    };

    return (
        <div className="card space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-white">Weekly Summary</h3>
                    <p className="text-gray-500 text-xs">{last7Days.length} days tracked</p>
                </div>
                <div className={`text-3xl font-black ${getStatusColor(overallAdherence)}`}>
                    {getStatusEmoji(overallAdherence)} {overallAdherence}%
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase">Avg Calories</div>
                    <div className="text-xl font-bold text-white">{avgCalories.toLocaleString()}</div>
                    <div className={`text-xs ${getStatusColor(calorieAdherence)}`}>
                        {calorieAdherence}% of target
                    </div>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                    <div className="text-xs text-gray-500 uppercase">Avg Protein</div>
                    <div className="text-xl font-bold text-white">{avgProtein}g</div>
                    <div className={`text-xs ${getStatusColor(proteinAdherence)}`}>
                        {proteinAdherence}% of target
                    </div>
                </div>
            </div>

            {/* Insight */}
            <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-lg p-3">
                <div className="text-xs text-[var(--color-primary)] uppercase font-bold mb-1">AI Insight</div>
                <p className="text-sm text-gray-300">{getInsight()}</p>
            </div>

            {/* Days Breakdown */}
            <div className="flex justify-between gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                    const dayLog = last7Days[6 - idx]; // Reverse order for display
                    const hasData = !!dayLog;
                    const hitTarget = dayLog && dayLog.calories >= targets.calories * 0.85;

                    return (
                        <div
                            key={idx}
                            className={`flex-1 py-2 rounded text-center text-xs font-bold ${
                                hasData
                                    ? hitTarget
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-gray-800 text-gray-600'
                            }`}
                        >
                            {day}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WeeklyNutritionSummary;
