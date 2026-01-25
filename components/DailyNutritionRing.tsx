import React from 'react';

interface DailyNutritionRingProps {
    consumed: number;
    target: number;
    size?: number;
    strokeWidth?: number;
    showMacros?: boolean;
    protein?: { consumed: number; target: number };
    carbs?: { consumed: number; target: number };
    fats?: { consumed: number; target: number };
}

const DailyNutritionRing: React.FC<DailyNutritionRingProps> = ({
    consumed,
    target,
    size = 160,
    strokeWidth = 12,
    showMacros = false,
    protein,
    carbs,
    fats
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min((consumed / target) * 100, 100);
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Determine color based on percentage
    const getColor = () => {
        if (percentage > 100) return '#ef4444'; // red - over
        if (percentage > 80) return '#eab308'; // yellow - close
        return '#D4FF00'; // primary green - on track
    };

    const remaining = Math.max(target - consumed, 0);

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background ring */}
                <svg
                    className="transform -rotate-90"
                    width={size}
                    height={size}
                >
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="transparent"
                        stroke="#2C2C2E"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress ring */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="transparent"
                        stroke={getColor()}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500 ease-out"
                    />
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white">{consumed.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">/ {target.toLocaleString()} cal</span>
                    <span className="text-xs text-gray-500 mt-1">{remaining > 0 ? `${remaining} left` : 'Goal reached!'}</span>
                </div>
            </div>

            {/* Macro breakdown */}
            {showMacros && protein && carbs && fats && (
                <div className="flex justify-center gap-6 mt-4">
                    <div className="text-center">
                        <div className="text-sm font-bold text-white">{protein.consumed}g</div>
                        <div className="text-xs text-gray-500">Protein</div>
                        <div className="w-12 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-blue-400 rounded-full transition-all"
                                style={{ width: `${Math.min((protein.consumed / protein.target) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-bold text-white">{carbs.consumed}g</div>
                        <div className="text-xs text-gray-500">Carbs</div>
                        <div className="w-12 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-yellow-400 rounded-full transition-all"
                                style={{ width: `${Math.min((carbs.consumed / carbs.target) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm font-bold text-white">{fats.consumed}g</div>
                        <div className="text-xs text-gray-500">Fats</div>
                        <div className="w-12 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-pink-400 rounded-full transition-all"
                                style={{ width: `${Math.min((fats.consumed / fats.target) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyNutritionRing;
