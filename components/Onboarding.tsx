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

const EXPERIENCE_OPTIONS = [
    { id: 'beginner', label: 'Beginner', description: 'New to lifting or less than 1 year', emoji: '🌱' },
    { id: 'intermediate', label: 'Intermediate', description: '1-3 years consistent training', emoji: '💪' },
    { id: 'advanced', label: 'Advanced', description: '3+ years lifting experience', emoji: '🏆' }
];

const EQUIPMENT_OPTIONS = [
    { id: 'gym', label: 'Full Gym', description: 'Access to barbells, machines, cables', emoji: '🏋️' },
    { id: 'home', label: 'Home Gym', description: 'Dumbbells, bench, pull-up bar', emoji: '🏠' },
    { id: 'minimal', label: 'Minimal', description: 'Bodyweight and resistance bands', emoji: '🎯' }
];

type Step = 'welcome' | 'goal' | 'stats' | 'experience' | 'equipment' | 'schedule';

interface ProfileData {
    goal: string | null;
    height_ft: string;
    height_in: string;
    weight_lbs: string;
    age: string;
    training_experience: string | null;
    equipment_access: string | null;
    days_per_week: number;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const { user } = useAuth();
    const [step, setStep] = useState<Step>('welcome');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [profile, setProfile] = useState<ProfileData>({
        goal: null,
        height_ft: '',
        height_in: '',
        weight_lbs: '',
        age: '',
        training_experience: null,
        equipment_access: null,
        days_per_week: 4
    });

    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Champion';

    const updateProfile = (field: keyof ProfileData, value: string | number | null) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleComplete = async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        // Timeout safeguard - don't hang forever
        const timeout = setTimeout(() => {
            setLoading(false);
            setError('Request timed out. Please try again.');
        }, 10000);

        try {
            // Convert height to inches
            const heightInches = (parseInt(profile.height_ft) || 0) * 12 + (parseInt(profile.height_in) || 0);

            // Use upsert to handle both new profiles and existing ones
            // This fixes the issue where update() succeeds but updates 0 rows if profile doesn't exist
            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    goal: profile.goal,
                    height_inches: heightInches || null,
                    weight_lbs: parseInt(profile.weight_lbs) || null,
                    age: parseInt(profile.age) || null,
                    training_experience: profile.training_experience,
                    equipment_access: profile.equipment_access,
                    days_per_week: profile.days_per_week,
                    onboarding_complete: true
                });

            clearTimeout(timeout);

            if (updateError) throw updateError;

            onComplete();
        } catch (err: any) {
            clearTimeout(timeout);
            console.error('Onboarding error:', err);
            setError(err.message || 'Failed to save your profile. Please try again.');
            setLoading(false);
        }
    };

    const nextStep = () => {
        const steps: Step[] = ['welcome', 'goal', 'stats', 'experience', 'equipment', 'schedule'];
        const currentIndex = steps.indexOf(step);
        if (currentIndex < steps.length - 1) {
            setStep(steps[currentIndex + 1]);
        }
    };

    const prevStep = () => {
        const steps: Step[] = ['welcome', 'goal', 'stats', 'experience', 'equipment', 'schedule'];
        const currentIndex = steps.indexOf(step);
        if (currentIndex > 0) {
            setStep(steps[currentIndex - 1]);
        }
    };

    const getStepNumber = () => {
        const steps: Step[] = ['welcome', 'goal', 'stats', 'experience', 'equipment', 'schedule'];
        return steps.indexOf(step);
    };

    const renderProgressBar = () => {
        const totalSteps = 5; // Excluding welcome
        const currentStep = getStepNumber();
        if (currentStep === 0) return null;

        return (
            <div className="flex gap-2 mb-6">
                {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                            i < currentStep ? 'bg-[var(--color-primary)]' : 'bg-gray-700'
                        }`}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-primary)]/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-48 -mb-48 pointer-events-none"></div>

            <div className="w-full max-w-lg z-10">
                {renderProgressBar()}

                {step === 'welcome' && (
                    <div className="text-center space-y-8 animate-slide-up">
                        <div className="space-y-4">
                            <h1 className="text-4xl font-black text-white tracking-tight">
                                Welcome, <span className="text-[var(--color-primary)]">{userName}</span>
                            </h1>
                            <p className="text-gray-400 text-lg">
                                Let's set up your personalized AI fitness program.
                            </p>
                        </div>

                        <div className="card p-8 space-y-6">
                            <div className="text-left space-y-4">
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl">🤖</span>
                                    <div>
                                        <h3 className="font-bold text-white">AI Workout Generator</h3>
                                        <p className="text-gray-400 text-sm">Personalized workouts that adapt to your recovery</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl">🍽️</span>
                                    <div>
                                        <h3 className="font-bold text-white">Smart Meal Tracking</h3>
                                        <p className="text-gray-400 text-sm">Photo or text - AI estimates your macros instantly</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <span className="text-2xl">📊</span>
                                    <div>
                                        <h3 className="font-bold text-white">Personalized Targets</h3>
                                        <p className="text-gray-400 text-sm">Calories and macros calculated for your body</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={nextStep}
                                className="btn-primary w-full text-lg py-4"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                )}

                {step === 'goal' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">What's your goal?</h2>
                            <p className="text-gray-400">This customizes your workouts and nutrition.</p>
                        </div>

                        <div className="space-y-4">
                            {GOAL_OPTIONS.map((goal) => (
                                <button
                                    key={goal.id}
                                    onClick={() => updateProfile('goal', goal.id)}
                                    className={`w-full p-5 rounded-xl text-left transition-all ${
                                        profile.goal === goal.id
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
                                                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">
                                                        {detail}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {profile.goal === goal.id && (
                                            <div className="text-[var(--color-primary)] text-xl">✓</div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="btn-secondary flex-1">Back</button>
                            <button
                                onClick={nextStep}
                                disabled={!profile.goal}
                                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {step === 'stats' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">Your Stats</h2>
                            <p className="text-gray-400">For accurate calorie and macro calculations.</p>
                        </div>

                        <div className="card p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Height</label>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            value={profile.height_ft}
                                            onChange={(e) => updateProfile('height_ft', e.target.value)}
                                            className="input-field w-full"
                                            placeholder="5"
                                            min="3"
                                            max="8"
                                        />
                                        <span className="text-gray-500 text-xs mt-1 block text-center">feet</span>
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            value={profile.height_in}
                                            onChange={(e) => updateProfile('height_in', e.target.value)}
                                            className="input-field w-full"
                                            placeholder="10"
                                            min="0"
                                            max="11"
                                        />
                                        <span className="text-gray-500 text-xs mt-1 block text-center">inches</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Weight (lbs)</label>
                                <input
                                    type="number"
                                    value={profile.weight_lbs}
                                    onChange={(e) => updateProfile('weight_lbs', e.target.value)}
                                    className="input-field w-full"
                                    placeholder="180"
                                    min="80"
                                    max="500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Age</label>
                                <input
                                    type="number"
                                    value={profile.age}
                                    onChange={(e) => updateProfile('age', e.target.value)}
                                    className="input-field w-full"
                                    placeholder="25"
                                    min="13"
                                    max="100"
                                />
                            </div>
                        </div>

                        <p className="text-center text-gray-500 text-sm">
                            This helps calculate your personalized calorie targets.
                        </p>

                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="btn-secondary flex-1">Back</button>
                            <button
                                onClick={nextStep}
                                disabled={!profile.weight_lbs}
                                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {step === 'experience' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">Training Experience</h2>
                            <p className="text-gray-400">AI adjusts workout complexity for you.</p>
                        </div>

                        <div className="space-y-3">
                            {EXPERIENCE_OPTIONS.map((exp) => (
                                <button
                                    key={exp.id}
                                    onClick={() => updateProfile('training_experience', exp.id)}
                                    className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-4 ${
                                        profile.training_experience === exp.id
                                            ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]'
                                            : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700'
                                    }`}
                                >
                                    <span className="text-2xl">{exp.emoji}</span>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white">{exp.label}</h3>
                                        <p className="text-gray-400 text-sm">{exp.description}</p>
                                    </div>
                                    {profile.training_experience === exp.id && (
                                        <div className="text-[var(--color-primary)]">✓</div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="btn-secondary flex-1">Back</button>
                            <button
                                onClick={nextStep}
                                disabled={!profile.training_experience}
                                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {step === 'equipment' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">Equipment Access</h2>
                            <p className="text-gray-400">AI picks exercises you can actually do.</p>
                        </div>

                        <div className="space-y-3">
                            {EQUIPMENT_OPTIONS.map((eq) => (
                                <button
                                    key={eq.id}
                                    onClick={() => updateProfile('equipment_access', eq.id)}
                                    className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-4 ${
                                        profile.equipment_access === eq.id
                                            ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)]'
                                            : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700'
                                    }`}
                                >
                                    <span className="text-2xl">{eq.emoji}</span>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white">{eq.label}</h3>
                                        <p className="text-gray-400 text-sm">{eq.description}</p>
                                    </div>
                                    {profile.equipment_access === eq.id && (
                                        <div className="text-[var(--color-primary)]">✓</div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="btn-secondary flex-1">Back</button>
                            <button
                                onClick={nextStep}
                                disabled={!profile.equipment_access}
                                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                )}

                {step === 'schedule' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">Workout Schedule</h2>
                            <p className="text-gray-400">How many days can you train per week?</p>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div className="card p-6">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-gray-400">Days per week</span>
                                <span className="text-4xl font-black text-[var(--color-primary)]">{profile.days_per_week}</span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="6"
                                value={profile.days_per_week}
                                onChange={(e) => updateProfile('days_per_week', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
                            />
                            <div className="flex justify-between mt-2 text-xs text-gray-500">
                                <span>2</span>
                                <span>3</span>
                                <span>4</span>
                                <span>5</span>
                                <span>6</span>
                            </div>
                        </div>

                        <div className="card p-4 bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30">
                            <p className="text-sm text-gray-300">
                                {profile.days_per_week <= 3 ? (
                                    <>💡 Perfect for <strong className="text-white">Full Body</strong> training - hitting each muscle 2-3x/week</>
                                ) : profile.days_per_week <= 4 ? (
                                    <>💡 Ideal for <strong className="text-white">Upper/Lower</strong> or <strong className="text-white">PHUL</strong> split</>
                                ) : (
                                    <>💡 Great for <strong className="text-white">Push/Pull/Legs</strong> with maximum frequency</>
                                )}
                            </p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button onClick={prevStep} className="btn-secondary flex-1">Back</button>
                            <button
                                onClick={handleComplete}
                                disabled={loading}
                                className="btn-primary flex-1 flex justify-center items-center"
                            >
                                {loading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : 'Start Training'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
