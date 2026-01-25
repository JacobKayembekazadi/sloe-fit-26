import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoaderIcon from './icons/LoaderIcon';

interface OnboardingProps {
    onComplete: () => void;
}

interface GoalOption {
    id: string;
    title: string;
    description: string;
    emoji: string;
    details: string[];
}

const GOAL_OPTIONS: GoalOption[] = [
    {
        id: 'CUT',
        title: 'Cut',
        description: 'Lose fat while preserving muscle',
        emoji: '🔥',
        details: ['Lower calorie targets', 'High protein focus', 'HIIT-style workouts']
    },
    {
        id: 'BULK',
        title: 'Bulk',
        description: 'Build muscle and gain strength',
        emoji: '💪',
        details: ['Higher calorie surplus', 'Strength-focused training', 'Push/Pull/Legs split']
    },
    {
        id: 'RECOMP',
        title: 'Recomp',
        description: 'Build muscle and lose fat simultaneously',
        emoji: '⚖️',
        details: ['Moderate calories at maintenance', 'Balanced macros', 'Power + Hypertrophy training']
    }
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const { user } = useAuth();
    const [step, setStep] = useState<'welcome' | 'goal'>('welcome');
    const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Champion';

    const handleGoalSelect = async () => {
        if (!selectedGoal || !user) return;

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    goal: selectedGoal,
                    onboarding_complete: true
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

            onComplete();
        } catch (err: any) {
            setError(err.message || 'Failed to save your goal. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-primary)]/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-48 -mb-48 pointer-events-none"></div>

            <div className="w-full max-w-lg z-10">
                {step === 'welcome' ? (
                    <div className="text-center space-y-8 animate-slide-up">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-black text-white tracking-tight">
                                Welcome, <span className="text-[var(--color-primary)]">{userName}</span>
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Let's set up your personalized 30-day transformation program.
                            </p>
                        </div>

                        <div className="card p-8 space-y-6">
                            <div className="text-left space-y-4">
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl">🎯</span>
                                    <div>
                                        <h3 className="font-bold text-white">AI-Powered Coaching</h3>
                                        <p className="text-gray-400 text-sm">Personalized workouts and nutrition based on your goals</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl">📸</span>
                                    <div>
                                        <h3 className="font-bold text-white">Photo Analysis</h3>
                                        <p className="text-gray-400 text-sm">Track your body composition and meal nutrition with AI</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl">📈</span>
                                    <div>
                                        <h3 className="font-bold text-white">Progress Tracking</h3>
                                        <p className="text-gray-400 text-sm">Visual charts and metrics to monitor your transformation</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('goal')}
                                className="btn-primary w-full text-lg py-4"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-slide-up">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">
                                What's your goal?
                            </h2>
                            <p className="text-gray-400">
                                This will customize your workouts and nutrition targets.
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {GOAL_OPTIONS.map((goal) => (
                                <button
                                    key={goal.id}
                                    onClick={() => setSelectedGoal(goal.id)}
                                    className={`w-full p-5 rounded-xl text-left transition-all ${
                                        selectedGoal === goal.id
                                            ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]'
                                            : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <span className="text-3xl">{goal.emoji}</span>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-white text-lg">{goal.title}</h3>
                                            <p className="text-gray-400 text-sm mb-3">{goal.description}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {goal.details.map((detail, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300"
                                                    >
                                                        {detail}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {selectedGoal === goal.id && (
                                            <div className="text-[var(--color-primary)] text-xl">✓</div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setStep('welcome')}
                                className="btn-secondary flex-1"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleGoalSelect}
                                disabled={!selectedGoal || loading}
                                className="btn-primary flex-1 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : 'Start My Program'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
