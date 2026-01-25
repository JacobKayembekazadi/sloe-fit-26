import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    ReferenceLine
} from 'recharts';

interface ChartDataPoint {
    date: string;
    value: number;
    target?: number;
}

interface ProgressChartProps {
    data: ChartDataPoint[];
    title: string;
    color?: string;
    unit?: string;
    showTarget?: boolean;
    chartType?: 'line' | 'bar';
}

const ProgressChart: React.FC<ProgressChartProps> = ({
    data,
    title,
    color = '#D4FF00',
    unit = '',
    showTarget = false,
    chartType = 'line'
}) => {
    // Format date for display (e.g., "Jan 15")
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#2C2C2E] border border-white/10 rounded-lg p-3 shadow-lg">
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    <p className="text-white font-bold">
                        {payload[0].value}{unit}
                    </p>
                    {showTarget && payload[0].payload.target && (
                        <p className="text-gray-500 text-xs mt-1">
                            Target: {payload[0].payload.target}{unit}
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    const formattedData = data.map(d => ({
        ...d,
        formattedDate: formatDate(d.date)
    }));

    const targetValue = showTarget && data.length > 0 ? data[0].target : undefined;

    if (data.length === 0) {
        return (
            <div className="card">
                <h4 className="text-sm font-bold text-white mb-4">{title}</h4>
                <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
                    No data yet. Start logging to see your progress!
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <h4 className="text-sm font-bold text-white mb-4">{title}</h4>
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'line' ? (
                        <LineChart data={formattedData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="formattedDate"
                                tick={{ fill: '#6B7280', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#6B7280', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            {showTarget && targetValue && (
                                <ReferenceLine
                                    y={targetValue}
                                    stroke="#6B7280"
                                    strokeDasharray="5 5"
                                    label={{ value: 'Target', fill: '#6B7280', fontSize: 10, position: 'insideTopRight' }}
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={2}
                                dot={{ fill: color, strokeWidth: 0, r: 3 }}
                                activeDot={{ r: 5, fill: color }}
                            />
                        </LineChart>
                    ) : (
                        <BarChart data={formattedData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="formattedDate"
                                tick={{ fill: '#6B7280', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#6B7280', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            {showTarget && targetValue && (
                                <ReferenceLine
                                    y={targetValue}
                                    stroke="#6B7280"
                                    strokeDasharray="5 5"
                                />
                            )}
                            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ProgressChart;
