import React, { useState, useEffect, useRef } from 'react';
import GoalSelector, { FitnessGoal } from './GoalSelector';
import PhysiqueEstimator from './PhysiqueEstimator';
import HurdleIdentifier, { Hurdle } from './HurdleIdentifier';
import TrajectoryGraph from './TrajectoryGraph';

interface OnboardingQuizProps {
    onComplete: (data: OnboardingData) => void;
    onBack: () => void;
}

export interface OnboardingData {
    goal: FitnessGoal;
    weight: number;
    bodyFat: number;
    hurdle: Hurdle;
}

// H3 FIX: localStorage key for quiz progress persistence
const QUIZ_PROGRESS_KEY = 'sloe_fit_quiz_progress';

interface QuizProgress {
    step: number;
    data: OnboardingData;
    timestamp: number;
}

// H3 FIX: Load saved quiz progress from localStorage
const loadQuizProgress = (): QuizProgress | null => {
    try {
        const saved = localStorage.getItem(QUIZ_PROGRESS_KEY);
        if (!saved) return null;

        const progress: QuizProgress = JSON.parse(saved);

        // Expire after 24 hours to prevent stale data
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - progress.timestamp > ONE_DAY) {
            localStorage.removeItem(QUIZ_PROGRESS_KEY);
            return null;
        }

        return progress;
    } catch {
        localStorage.removeItem(QUIZ_PROGRESS_KEY);
        return null;
    }
};

// H3 FIX: Save quiz progress to localStorage
const saveQuizProgress = (step: number, data: OnboardingData): void => {
    try {
        const progress: QuizProgress = {
            step,
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(QUIZ_PROGRESS_KEY, JSON.stringify(progress));
    } catch {
        // Silently fail if storage is full
    }
};

// H3 FIX: Clear quiz progress on completion
const clearQuizProgress = (): void => {
    try {
        localStorage.removeItem(QUIZ_PROGRESS_KEY);
    } catch {
        // Ignore
    }
};

const OnboardingQuiz: React.FC<OnboardingQuizProps> = ({ onComplete, onBack }) => {
    // H3 FIX: Load saved progress on mount
    const savedProgress = useRef(loadQuizProgress());

    const [step, setStep] = useState<number>(savedProgress.current?.step || 1);
    const [data, setData] = useState<OnboardingData>(savedProgress.current?.data || {
        goal: 'CUT', // Default
        weight: 180,
        bodyFat: 20,
        hurdle: 'CONSISTENCY'
    });

    // H3 FIX: Save progress whenever step or data changes
    useEffect(() => {
        saveQuizProgress(step, data);
    }, [step, data]);

    const totalSteps = 4;

    const nextStep = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            // H3 FIX: Clear saved progress on completion
            clearQuizProgress();
            onComplete(data);
        }
    };

    const prevStep = () => {
        if (step > 1) {
            setStep(step - 1);
        } else {
            onBack();
        }
    };

    const updateData = (updates: Partial<OnboardingData>) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <GoalSelector
                        selectedGoal={data.goal}
                        onSelect={(goal) => {
                            updateData({ goal });
                            // Small delay for effect
                            setTimeout(nextStep, 300);
                        }}
                    />
                );
            case 2:
                return (
                    <PhysiqueEstimator
                        weight={data.weight}
                        bodyFatInfo={{ percentage: data.bodyFat, visualLabel: 'Average' }}
                        onUpdate={(updates) => updateData(updates as any)}
                    />
                );
            case 3:
                return (
                    <HurdleIdentifier
                        selectedHurdle={data.hurdle}
                        onSelect={(hurdle) => {
                            updateData({ hurdle });
                            setTimeout(nextStep, 300);
                        }}
                    />
                );
            case 4:
                // Calculate a dummy projected date 3 months from now
                const date = new Date();
                date.setMonth(date.getMonth() + 3);
                const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

                return <TrajectoryGraph currentWeight={data.weight} goal={data.goal} projectedDate={dateStr} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-[100dvh] bg-black text-white flex flex-col font-['Lexend']">
            {/* Header / Progress */}
            <div className="px-6 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] flex items-center justify-between">
                <button
                    onClick={prevStep}
                    className="p-2.5 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>

                {/* Progress Bar */}
                <div className="flex gap-2">
                    {[1, 2, 3, 4].map(i => (
                        <div
                            key={i}
                            className={`h-1.5 w-8 rounded-full transition-all duration-300 ${i <= step ? 'bg-[var(--color-primary)]' : 'bg-gray-800'}`}
                        />
                    ))}
                </div>

                <div className="w-10"></div> {/* Spacer for symmetry */}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 overflow-y-auto">
                {renderStep()}
            </div>

            {/* Sticky Bottom Actions (Only for non-auto-advancing steps like sliders or final graph) */}
            {(step === 2 || step === 4) && (
                <div className="fixed bottom-0 left-0 right-0 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black to-transparent z-20">
                    <button
                        onClick={nextStep}
                        className="w-full btn-primary h-14 text-lg font-bold shadow-lg shadow-[var(--color-primary)]/20 uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        {step === 4 ? 'Save Your Plan' : 'Continue'}
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default OnboardingQuiz;
