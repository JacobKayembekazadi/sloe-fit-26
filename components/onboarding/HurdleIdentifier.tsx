import React from 'react';

export type Hurdle = 'CONSISTENCY' | 'DIET' | 'KNOWLEDGE' | 'TIME' | 'MOTIVATION';

interface HurdleIdentifierProps {
    selectedHurdle: Hurdle | null;
    onSelect: (hurdle: Hurdle) => void;
}

const HurdleIdentifier: React.FC<HurdleIdentifierProps> = ({ selectedHurdle, onSelect }) => {
    const hurdles: { id: Hurdle; label: string; icon: string }[] = [
        { id: 'CONSISTENCY', label: 'Consistency', icon: 'repeat' },
        { id: 'DIET', label: 'Nutrition / Diet', icon: 'restaurant' },
        { id: 'KNOWLEDGE', label: 'What to do', icon: 'school' },
        { id: 'TIME', label: 'No Time', icon: 'schedule' },
        { id: 'MOTIVATION', label: 'Motivation', icon: 'sentiment_dissatisfied' },
    ];

    return (
        <div className="w-full max-w-md mx-auto space-y-6 animate-fade-in-up">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                    The <span className="text-red-500">Barrier</span>
                </h2>
                <p className="text-gray-400">What has stopped you in the past?</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {hurdles.map((hurdle) => {
                    const isSelected = selectedHurdle === hurdle.id;
                    return (
                        <button
                            key={hurdle.id}
                            onClick={() => onSelect(hurdle.id)}
                            className={`
                relative w-full p-4 rounded-xl border-2 text-left transition-all duration-200
                flex items-center gap-4
                ${isSelected
                                    ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)] translate-x-2'
                                    : 'border-gray-800 bg-gray-900/40 hover:border-gray-600 hover:bg-gray-800'
                                }
              `}
                        >
                            <div
                                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${isSelected ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400'}
                `}
                            >
                                <span className="material-symbols-outlined">{hurdle.icon}</span>
                            </div>

                            <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                {hurdle.label}
                            </span>

                            {isSelected && (
                                <div className="ml-auto animate-fade-in">
                                    <span className="material-symbols-outlined text-red-500">check</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 text-center bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 animate-fade-in">
                <div className="flex items-start gap-3 text-left">
                    <span className="material-symbols-outlined text-blue-400 mt-0.5">info</span>
                    <p className="text-sm text-blue-200 leading-relaxed">
                        <span className="font-bold text-blue-400">Why we ask:</span> Identifying your primary hurdle allows our AI to build specific safeguards into your plan to prevent burnout.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HurdleIdentifier;
