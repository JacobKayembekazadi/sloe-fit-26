import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FitnessGoal } from './GoalSelector';

interface TrajectoryGraphProps {
    currentWeight: number;
    goal: FitnessGoal;
    projectedDate: string; // e.g. "June 12"
}

const TrajectoryGraph: React.FC<TrajectoryGraphProps> = ({ currentWeight, goal, projectedDate }) => {
    // Generate dummy data based on goal
    const generateData = () => {
        const data = [];
        const months = ['Now', 'Month 1', 'Month 2', 'Month 3'];
        let weight = currentWeight;

        for (let i = 0; i < 4; i++) {
            data.push({
                name: months[i],
                weight: Math.round(weight * 10) / 10
            });

            // Simple linear projection logic
            if (goal === 'CUT') weight -= 4; // Lose 4 lbs/month
            else if (goal === 'BULK') weight += 2; // Gain 2 lbs/month
            else weight -= 1; // Small drop for recomp
        }
        return data;
    };

    const data = generateData();
    const targetWeight = data[data.length - 1].weight;

    // Dynamic color based on goal
    const color = goal === 'CUT' ? '#ef4444' : (goal === 'BULK' ? '#3b82f6' : '#d4ff00');

    return (
        <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in-up">
            <div className="text-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                    The <span style={{ color }}>Result</span>
                </h2>
                <p className="text-gray-400 text-lg">
                    Based on your inputs, you could reach <br />
                    <span className="text-white font-bold">{targetWeight} lbs</span> by <span className="text-white font-bold">{projectedDate}</span>.
                </p>
            </div>

            <div className="h-64 w-full bg-gray-900/50 rounded-2xl border border-gray-800 p-4 relative overflow-hidden">
                {/* Chart */}
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#666"
                            tick={{ fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                        />
                        <YAxis
                            hide={true}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="weight"
                            stroke={color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorWeight)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h4 className="text-sm font-bold text-gray-300 uppercase mb-2">Your AI Plan Includes:</h4>
                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">check_circle</span>
                        Hyper-personalized workout split
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">check_circle</span>
                        Macro-nutrient cycling for {goal.toLowerCase()}ing
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">check_circle</span>
                        Daily accountability check-ins
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default TrajectoryGraph;
