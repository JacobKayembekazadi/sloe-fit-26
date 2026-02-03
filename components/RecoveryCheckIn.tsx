import React, { useState } from 'react';
import LoaderIcon from './icons/LoaderIcon';

export interface RecoveryState {
    lastWorkoutRating: number;
    energyLevel: number;
    sorenessAreas: string[];
    sleepHours: number;
}

interface RecoveryCheckInProps {
    onComplete: (recovery: RecoveryState) => void;
    onSkip?: () => void;
    isLoading?: boolean;
}

const SORENESS_AREAS = [
    { id: 'chest', label: 'Chest', emoji: '' },
    { id: 'back', label: 'Back', emoji: '' },
    { id: 'shoulders', label: 'Shoulders', emoji: '' },
    { id: 'arms', label: 'Arms', emoji: '' },
    { id: 'legs', label: 'Legs', emoji: '' },
    { id: 'core', label: 'Core', emoji: '' }
];

const RecoveryCheckIn: React.FC<RecoveryCheckInProps> = ({ onComplete, isLoading }) => {
    const [step, setStep] = useState<'energy' | 'soreness' | 'sleep'>('energy');
    const [recovery, setRecovery] = useState<RecoveryState>({
        lastWorkoutRating: 3,
        energyLevel: 3,
        sorenessAreas: [],
        sleepHours: 7
    });

    const updateRecovery = (field: keyof RecoveryState, value: number | string[]) => {
        setRecovery(prev => ({ ...prev, [field]: value }));
    };

    const toggleSoreness = (area: string) => {
        setRecovery(prev => ({
            ...prev,
            sorenessAreas: prev.sorenessAreas.includes(area)
                ? prev.sorenessAreas.filter(a => a !== area)
                : [...prev.sorenessAreas, area]
        }));
    };

    const handleNext = () => {
        if (step === 'energy') setStep('soreness');
        else if (step === 'soreness') setStep('sleep');
        else onComplete(recovery);
    };

    const handleBack = () => {
        if (step === 'soreness') setStep('energy');
        else if (step === 'sleep') setStep('soreness');
    };

    const renderEnergyLevel = (level: number, selected: boolean) => {
        const labels = ['Exhausted', 'Tired', 'Okay', 'Good', 'Great'];
        const colors = [
            'bg-red-500/20 border-red-500 text-red-400',
            'bg-orange-500/20 border-orange-500 text-orange-400',
            'bg-yellow-500/20 border-yellow-500 text-yellow-400',
            'bg-green-500/20 border-green-500 text-green-400',
            'bg-[var(--color-primary)]/20 border-[var(--color-primary)] text-[var(--color-primary)]'
        ];

        return (
            <button
                key={level}
                onClick={() => updateRecovery('energyLevel', level)}
                className={`flex-1 py-3 sm:py-4 rounded-xl border-2 transition-all ${
                    selected ? colors[level - 1] : 'bg-gray-800/50 border-gray-700 text-gray-400'
                }`}
            >
                <div className="text-xl sm:text-2xl font-black">{level}</div>
                <div className="text-[10px] sm:text-xs mt-1">{labels[level - 1]}</div>
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-md">
                {/* Progress indicator */}
                <div className="flex gap-2 mb-6">
                    {['energy', 'soreness', 'sleep'].map((s, i) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                                ['energy', 'soreness', 'sleep'].indexOf(step) >= i
                                    ? 'bg-[var(--color-primary)]'
                                    : 'bg-gray-700'
                            }`}
                        />
                    ))}
                </div>

                <div className="card p-6 space-y-6">
                    {step === 'energy' && (
                        <div className="animate-slide-up">
                            <h2 className="text-2xl font-black text-white text-center mb-2">
                                How's your energy today?
                            </h2>
                            <p className="text-gray-400 text-center text-sm mb-6">
                                AI will adjust workout intensity based on this
                            </p>

                            <div className="flex gap-1.5 sm:gap-2">
                                {[1, 2, 3, 4, 5].map(level =>
                                    renderEnergyLevel(level, recovery.energyLevel === level)
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'soreness' && (
                        <div className="animate-slide-up">
                            <h2 className="text-2xl font-black text-white text-center mb-2">
                                Any sore areas?
                            </h2>
                            <p className="text-gray-400 text-center text-sm mb-6">
                                We'll avoid these muscle groups
                            </p>

                            <div className="grid grid-cols-3 gap-3">
                                {SORENESS_AREAS.map(area => (
                                    <button
                                        key={area.id}
                                        onClick={() => toggleSoreness(area.id)}
                                        className={`p-4 rounded-xl border-2 transition-all ${
                                            recovery.sorenessAreas.includes(area.id)
                                                ? 'bg-red-500/20 border-red-500 text-red-400'
                                                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="font-bold text-sm">{area.label}</div>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => updateRecovery('sorenessAreas', [])}
                                className={`w-full mt-4 p-3 rounded-xl border-2 transition-all ${
                                    recovery.sorenessAreas.length === 0
                                        ? 'bg-green-500/20 border-green-500 text-green-400'
                                        : 'bg-gray-800/50 border-gray-700 text-gray-400'
                                }`}
                            >
                                No soreness - feeling fresh
                            </button>
                        </div>
                    )}

                    {step === 'sleep' && (
                        <div className="animate-slide-up">
                            <h2 className="text-2xl font-black text-white text-center mb-2">
                                Hours of sleep last night?
                            </h2>
                            <p className="text-gray-400 text-center text-sm mb-6">
                                Recovery affects performance
                            </p>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Sleep duration</span>
                                    <span className="text-3xl font-black text-[var(--color-primary)]">
                                        {recovery.sleepHours}h
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="3"
                                    max="10"
                                    step="0.5"
                                    value={recovery.sleepHours}
                                    onChange={(e) => updateRecovery('sleepHours', parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>3h</span>
                                    <span>6h</span>
                                    <span>8h</span>
                                    <span>10h</span>
                                </div>
                            </div>

                            {recovery.sleepHours < 6 && (
                                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                                    Low sleep detected - workout will focus on lighter intensity
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        {step !== 'energy' && (
                            <button onClick={handleBack} className="btn-secondary flex-1">
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            disabled={isLoading}
                            className="btn-primary flex-1 flex justify-center items-center"
                        >
                            {isLoading ? (
                                <LoaderIcon className="w-5 h-5 animate-spin" />
                            ) : step === 'sleep' ? (
                                'Generate Workout'
                            ) : (
                                'Continue'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecoveryCheckIn;
