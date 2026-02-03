import React from 'react';

export type FitnessGoal = 'CUT' | 'BULK' | 'RECOMP';

interface GoalSelectorProps {
    selectedGoal: FitnessGoal | null;
    onSelect: (goal: FitnessGoal) => void;
}

const GoalSelector: React.FC<GoalSelectorProps> = ({ selectedGoal, onSelect }) => {
    const goals: { id: FitnessGoal; title: string; subtitle: string; icon: string; color: string }[] = [
        {
            id: 'CUT',
            title: 'Shred',
            subtitle: 'Maximize definition, lose fat',
            icon: 'local_fire_department',
            color: '#ef4444' // red-500
        },
        {
            id: 'BULK',
            title: 'Size',
            subtitle: 'Build raw muscle mass',
            icon: 'fitness_center',
            color: '#3b82f6' // blue-500
        },
        {
            id: 'RECOMP',
            title: 'Tone',
            subtitle: 'Build muscle & burn fat',
            icon: 'bolt',
            color: '#d4ff00' // neon volt
        }
    ];

    return (
        <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in-up">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                    What is your <span className="text-[var(--color-primary)]">Focus</span>?
                </h2>
                <p className="text-gray-400">Select your primary objective.</p>
            </div>

            <div className="grid gap-4">
                {goals.map((goal) => {
                    const isSelected = selectedGoal === goal.id;
                    return (
                        <button
                            key={goal.id}
                            onClick={() => onSelect(goal.id)}
                            className={`
                group relative w-full p-4 rounded-xl border-2 transition-all duration-300 ease-out text-left overflow-hidden
                ${isSelected
                                    ? 'border-transparent bg-gray-800 scale-[1.02] shadow-[0_0_20px_rgba(0,0,0,0.5)]'
                                    : 'border-gray-800 bg-black/40 hover:border-gray-700 hover:bg-gray-900'
                                }
              `}
                            style={{
                                borderColor: isSelected ? goal.color : undefined,
                                boxShadow: isSelected ? `0 0 20px ${goal.color}40` : undefined
                            }}
                        >
                            {/* Background gradient shine effect */}
                            {isSelected && (
                                <div
                                    className="absolute inset-0 opacity-10 bg-gradient-to-r from-transparent via-white to-transparent"
                                    style={{ backgroundColor: goal.color }}
                                ></div>
                            )}

                            <div className="flex items-center gap-4 relative z-10">
                                <div
                                    className={`
                    w-12 h-12 rounded-lg flex items-center justify-center transition-colors
                    ${isSelected ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'}
                  `}
                                    style={{
                                        backgroundColor: isSelected ? goal.color : undefined,
                                        color: isSelected ? '#000' : undefined
                                    }}
                                >
                                    <span className="material-symbols-outlined text-2xl">{goal.icon}</span>
                                </div>
                                <div>
                                    <h3 className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                        {goal.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {goal.subtitle}
                                    </p>
                                </div>

                                {isSelected && (
                                    <div className="ml-auto">
                                        <span
                                            className="material-symbols-outlined text-2xl animate-bounce"
                                            style={{ color: goal.color }}
                                        >
                                            check_circle
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default GoalSelector;
