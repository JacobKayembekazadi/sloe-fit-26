import React from 'react';

interface PhysiqueEstimatorProps {
    weight: number;
    bodyFatInfo: { percentage: number; visualLabel: string };
    onUpdate: (data: { weight?: number; bodyFat?: number }) => void;
    units?: 'lbs' | 'kg';
}

const PhysiqueEstimator: React.FC<PhysiqueEstimatorProps> = ({
    weight,
    bodyFatInfo,
    onUpdate,
    units = 'lbs'
}) => {
    // Helper to determine visual label based on body fat
    const getVisualLabel = (fat: number) => {
        if (fat < 10) return 'Shredded';
        if (fat < 15) return 'Lean / Athletic';
        if (fat < 20) return 'Average';
        if (fat < 25) return 'Soft';
        return 'Overweight';
    };

    const handleFatChange = (val: number) => {
        onUpdate({
            bodyFat: val,
            // Pass the computed label back up if needed, or let parent handle it. 
            // For simplicity here, we just pass the raw numbers.
        });
    };

    return (
        <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in-up">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                    Current <span className="text-[var(--color-primary)]">Stats</span>
                </h2>
                <p className="text-gray-400">Where are you starting from?</p>
            </div>

            {/* Weight Slider */}
            <div className="space-y-4 p-5 bg-gray-900/50 rounded-xl border border-gray-800">
                <div className="flex justify-between items-end">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Weight</label>
                    <div className="text-2xl font-black text-white">
                        {weight} <span className="text-sm text-[var(--color-primary)] font-medium">{units}</span>
                    </div>
                </div>
                <input
                    type="range"
                    min={units === 'lbs' ? 90 : 40}
                    max={units === 'lbs' ? 350 : 160}
                    step={1}
                    value={weight}
                    onChange={(e) => onUpdate({ weight: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)] hover:accent-[var(--color-primary)]/80 transition-all"
                />
                <div className="flex justify-between text-xs text-gray-600 font-mono">
                    <span>{units === 'lbs' ? '90' : '40'}</span>
                    <span>{units === 'lbs' ? '350+' : '160+'}</span>
                </div>
            </div>

            {/* Body Fat Slider */}
            <div className="space-y-4 p-5 bg-gray-900/50 rounded-xl border border-gray-800">
                <div className="flex justify-between items-end">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Est. Body Fat</label>
                    <div className="text-right">
                        <div className="text-2xl font-black text-white">
                            {bodyFatInfo.percentage}%
                        </div>
                        <div className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wide">
                            {getVisualLabel(bodyFatInfo.percentage)}
                        </div>
                    </div>
                </div>

                {/* Visual Bar Gradient */}
                <div className="relative h-3 w-full rounded-full overflow-hidden bg-gray-700">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 opacity-30"></div>
                    {/* Marker */}
                    <div
                        className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_10px_white] transition-all duration-75 ease-out"
                        style={{ left: `${Math.min(Math.max((bodyFatInfo.percentage - 5) / 35 * 100, 0), 100)}%` }}
                    ></div>
                </div>

                <input
                    type="range"
                    min={5}
                    max={40}
                    step={1}
                    value={bodyFatInfo.percentage}
                    onChange={(e) => handleFatChange(Number(e.target.value))}
                    className="w-full h-10 -mt-8 opacity-0 cursor-pointer absolute z-10" // Invisible overlay for better touch target over generated bar if custom
                />
                {/* Fallback standard range input if visible bar is just visual */}
                <input
                    type="range"
                    min={5}
                    max={40}
                    step={0.5}
                    value={bodyFatInfo.percentage}
                    onChange={(e) => handleFatChange(Number(e.target.value))}
                    className="w-full h-2 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:mt-[-8px] [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent"
                />

                <div className="flex justify-between text-xs text-gray-600 font-mono">
                    <span>5% (Shredded)</span>
                    <span>40% (Overweight)</span>
                </div>
            </div>
        </div>
    );
};

export default PhysiqueEstimator;
