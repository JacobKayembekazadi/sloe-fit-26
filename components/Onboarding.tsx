import React, { useState, useCallback, memo } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LoaderIcon from './icons/LoaderIcon';
import CheckIcon from './icons/CheckIcon';

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

interface ValidationErrors {
    height?: string;
    weight?: string;
    age?: string;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [step, setStep] = useState<Step>('welcome');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [transitionDirection, setTransitionDirection] = useState<'forward' | 'back'>('forward');

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
        // Clear validation error for this field
        if (field === 'height_ft' || field === 'height_in') {
            setValidationErrors(prev => ({ ...prev, height: undefined }));
        } else if (field === 'weight_lbs') {
            setValidationErrors(prev => ({ ...prev, weight: undefined }));
        } else if (field === 'age') {
            setValidationErrors(prev => ({ ...prev, age: undefined }));
        }
        // Clear general error when user makes changes
        setError(null);
    };

    const validateStats = useCallback((): boolean => {
        const errors: ValidationErrors = {};
        let isValid = true;

        // Height validation (optional but if entered, must be valid)
        const heightFt = parseInt(profile.height_ft);
        const heightIn = parseInt(profile.height_in);
        if (profile.height_ft || profile.height_in) {
            if (profile.height_ft && (heightFt < 3 || heightFt > 8)) {
                errors.height = 'Height must be between 3-8 feet';
                isValid = false;
            }
            if (profile.height_in && (heightIn < 0 || heightIn > 11)) {
                errors.height = 'Inches must be 0-11';
                isValid = false;
            }
        }

        // Weight validation (required)
        const weight = parseInt(profile.weight_lbs);
        if (!profile.weight_lbs) {
            errors.weight = 'Weight is required';
            isValid = false;
        } else if (weight < 80 || weight > 500) {
            errors.weight = 'Weight must be between 80-500 lbs';
            isValid = false;
        }

        // Age validation (optional but if entered, must be valid)
        if (profile.age) {
            const age = parseInt(profile.age);
            if (age < 13 || age > 100) {
                errors.age = 'Age must be between 13-100';
                isValid = false;
            }
        }

        setValidationErrors(errors);
        return isValid;
    }, [profile.height_ft, profile.height_in, profile.weight_lbs, profile.age]);

    const handleComplete = async () => {
        if (!user) {
            setError('You must be logged in to complete onboarding.');
            return;
        }

        setSaving(true);
        setError(null);

        // Timeout safeguard - don't hang forever
        const timeout = setTimeout(() => {
            setSaving(false);
            setError('Request timed out. Please check your connection and try again.');
        }, 15000);

        try {
            // Convert height to inches
            const heightInches = (parseInt(profile.height_ft) || 0) * 12 + (parseInt(profile.height_in) || 0);

            // Use upsert to handle both new profiles and existing ones
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

            if (updateError) {
                throw updateError;
            }

            // Success! Complete onboarding
            onComplete();
        } catch (err: any) {
            clearTimeout(timeout);

            // Provide helpful error messages
            if (err.message?.includes('network') || err.message?.includes('fetch')) {
                setError('Network error. Please check your connection and try again.');
            } else if (err.code === '23505') {
                setError('Profile already exists. Refreshing...');
                // Try to complete anyway since profile exists
                setTimeout(() => onComplete(), 1000);
            } else {
                setError(err.message || 'Failed to save your profile. Please try again.');
            }
            showToast('Failed to complete setup', 'error');
            setSaving(false);
        }
    };

    const nextStep = () => {
        // Validate current step before proceeding
        if (step === 'stats' && !validateStats()) {
            return;
        }

        const steps: Step[] = ['welcome', 'goal', 'stats', 'experience', 'equipment', 'schedule'];
        const currentIndex = steps.indexOf(step);
        if (currentIndex < steps.length - 1) {
            setTransitionDirection('forward');
            setLoading(true);
            // Small delay for visual transition
            setTimeout(() => {
                setStep(steps[currentIndex + 1]);
                setLoading(false);
            }, 150);
        }
    };

    const prevStep = () => {
        const steps: Step[] = ['welcome', 'goal', 'stats', 'experience', 'equipment', 'schedule'];
        const currentIndex = steps.indexOf(step);
        if (currentIndex > 0) {
            setTransitionDirection('back');
            setError(null); // Clear errors when going back
            setLoading(true);
            setTimeout(() => {
                setStep(steps[currentIndex - 1]);
                setLoading(false);
            }, 150);
        }
    };

    const getStepNumber = () => {
        const steps: Step[] = ['welcome', 'goal', 'stats', 'experience', 'equipment', 'schedule'];
        return steps.indexOf(step);
    };

    const canProceed = (): boolean => {
        switch (step) {
            case 'welcome':
                return true;
            case 'goal':
                return !!profile.goal;
            case 'stats':
                return !!profile.weight_lbs && parseInt(profile.weight_lbs) >= 80;
            case 'experience':
                return !!profile.training_experience;
            case 'equipment':
                return !!profile.equipment_access;
            case 'schedule':
                return true;
            default:
                return false;
        }
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
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            i < currentStep
                                ? 'bg-[var(--color-primary)]'
                                : i === currentStep
                                    ? 'bg-[var(--color-primary)]/50'
                                    : 'bg-gray-700'
                        }`}
                    />
                ))}
            </div>
        );
    };

    const animationClass = loading
        ? 'opacity-0 scale-95'
        : `opacity-100 scale-100 ${transitionDirection === 'forward' ? 'animate-slide-up' : 'animate-slide-down'}`;

    return (
        <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-primary)]/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-48 -mb-48 pointer-events-none"></div>

            <div className="w-full max-w-lg z-10">
                {renderProgressBar()}

                <div className={`transition-all duration-200 ${animationClass}`}>
                    {step === 'welcome' && (
                        <div className="text-center space-y-8">
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
                                    <div className="flex items-start gap-4 group">
                                        <span className="text-2xl group-hover:scale-110 transition-transform">🤖</span>
                                        <div>
                                            <h3 className="font-bold text-white">AI Workout Generator</h3>
                                            <p className="text-gray-400 text-sm">Personalized workouts that adapt to your recovery</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 group">
                                        <span className="text-2xl group-hover:scale-110 transition-transform">🍽️</span>
                                        <div>
                                            <h3 className="font-bold text-white">Smart Meal Tracking</h3>
                                            <p className="text-gray-400 text-sm">Photo or text - AI estimates your macros instantly</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 group">
                                        <span className="text-2xl group-hover:scale-110 transition-transform">📊</span>
                                        <div>
                                            <h3 className="font-bold text-white">Personalized Targets</h3>
                                            <p className="text-gray-400 text-sm">Calories and macros calculated for your body</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={nextStep}
                                    disabled={loading}
                                    className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                >
                                    {loading ? (
                                        <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" />
                                    ) : (
                                        <>
                                            Get Started
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'goal' && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black text-white">What's your goal?</h2>
                                <p className="text-gray-400">This customizes your workouts and nutrition.</p>
                            </div>

                            <div className="space-y-4">
                                {GOAL_OPTIONS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => updateProfile('goal', goal.id)}
                                        className={`w-full p-5 rounded-xl text-left transition-all duration-200 active:scale-[0.98] ${
                                            profile.goal === goal.id
                                                ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                                : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700 hover:bg-gray-800/80'
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <span className={`text-3xl transition-transform duration-200 ${profile.goal === goal.id ? 'scale-110' : ''}`}>
                                                {goal.emoji}
                                            </span>
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
                                            <div className={`transition-all duration-200 ${profile.goal === goal.id ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                                <CheckIcon className="w-6 h-6 text-[var(--color-primary)]" />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={prevStep} disabled={loading} className="btn-secondary flex-1 active:scale-[0.98] transition-transform">
                                    Back
                                </button>
                                <button
                                    onClick={nextStep}
                                    disabled={!canProceed() || loading}
                                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                >
                                    {loading ? <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : 'Continue'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'stats' && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black text-white">Your Stats</h2>
                                <p className="text-gray-400">For accurate calorie and macro calculations.</p>
                            </div>

                            <div className="card p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2">
                                        Height <span className="text-gray-600">(optional)</span>
                                    </label>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                value={profile.height_ft}
                                                onChange={(e) => updateProfile('height_ft', e.target.value)}
                                                className={`input-field w-full ${validationErrors.height ? 'border-red-500' : ''}`}
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
                                                className={`input-field w-full ${validationErrors.height ? 'border-red-500' : ''}`}
                                                placeholder="10"
                                                min="0"
                                                max="11"
                                            />
                                            <span className="text-gray-500 text-xs mt-1 block text-center">inches</span>
                                        </div>
                                    </div>
                                    {validationErrors.height && (
                                        <p className="text-red-400 text-xs mt-1">{validationErrors.height}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2">
                                        Weight (lbs) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={profile.weight_lbs}
                                        onChange={(e) => updateProfile('weight_lbs', e.target.value)}
                                        className={`input-field w-full ${validationErrors.weight ? 'border-red-500' : ''}`}
                                        placeholder="180"
                                        min="80"
                                        max="500"
                                    />
                                    {validationErrors.weight && (
                                        <p className="text-red-400 text-xs mt-1">{validationErrors.weight}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-2">
                                        Age <span className="text-gray-600">(optional)</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={profile.age}
                                        onChange={(e) => updateProfile('age', e.target.value)}
                                        className={`input-field w-full ${validationErrors.age ? 'border-red-500' : ''}`}
                                        placeholder="25"
                                        min="13"
                                        max="100"
                                    />
                                    {validationErrors.age && (
                                        <p className="text-red-400 text-xs mt-1">{validationErrors.age}</p>
                                    )}
                                </div>
                            </div>

                            <p className="text-center text-gray-500 text-sm">
                                💡 This helps calculate your personalized calorie targets.
                            </p>

                            <div className="flex gap-3 pt-4">
                                <button onClick={prevStep} disabled={loading} className="btn-secondary flex-1 active:scale-[0.98] transition-transform">
                                    Back
                                </button>
                                <button
                                    onClick={nextStep}
                                    disabled={!canProceed() || loading}
                                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                >
                                    {loading ? <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : 'Continue'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'experience' && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black text-white">Training Experience</h2>
                                <p className="text-gray-400">AI adjusts workout complexity for you.</p>
                            </div>

                            <div className="space-y-3">
                                {EXPERIENCE_OPTIONS.map((exp) => (
                                    <button
                                        key={exp.id}
                                        onClick={() => updateProfile('training_experience', exp.id)}
                                        className={`w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-4 active:scale-[0.98] ${
                                            profile.training_experience === exp.id
                                                ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                                : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700 hover:bg-gray-800/80'
                                        }`}
                                    >
                                        <span className={`text-2xl transition-transform duration-200 ${profile.training_experience === exp.id ? 'scale-110' : ''}`}>
                                            {exp.emoji}
                                        </span>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-white">{exp.label}</h3>
                                            <p className="text-gray-400 text-sm">{exp.description}</p>
                                        </div>
                                        <div className={`transition-all duration-200 ${profile.training_experience === exp.id ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                            <CheckIcon className="w-5 h-5 text-[var(--color-primary)]" />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={prevStep} disabled={loading} className="btn-secondary flex-1 active:scale-[0.98] transition-transform">
                                    Back
                                </button>
                                <button
                                    onClick={nextStep}
                                    disabled={!canProceed() || loading}
                                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                >
                                    {loading ? <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : 'Continue'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'equipment' && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black text-white">Equipment Access</h2>
                                <p className="text-gray-400">AI picks exercises you can actually do.</p>
                            </div>

                            <div className="space-y-3">
                                {EQUIPMENT_OPTIONS.map((eq) => (
                                    <button
                                        key={eq.id}
                                        onClick={() => updateProfile('equipment_access', eq.id)}
                                        className={`w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-4 active:scale-[0.98] ${
                                            profile.equipment_access === eq.id
                                                ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                                : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700 hover:bg-gray-800/80'
                                        }`}
                                    >
                                        <span className={`text-2xl transition-transform duration-200 ${profile.equipment_access === eq.id ? 'scale-110' : ''}`}>
                                            {eq.emoji}
                                        </span>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-white">{eq.label}</h3>
                                            <p className="text-gray-400 text-sm">{eq.description}</p>
                                        </div>
                                        <div className={`transition-all duration-200 ${profile.equipment_access === eq.id ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                            <CheckIcon className="w-5 h-5 text-[var(--color-primary)]" />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={prevStep} disabled={loading} className="btn-secondary flex-1 active:scale-[0.98] transition-transform">
                                    Back
                                </button>
                                <button
                                    onClick={nextStep}
                                    disabled={!canProceed() || loading}
                                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                                >
                                    {loading ? <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : 'Continue'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'schedule' && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <h2 className="text-3xl font-black text-white">Workout Schedule</h2>
                                <p className="text-gray-400">How many days can you train per week?</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="text-red-400 text-sm">{error}</p>
                                            <button
                                                onClick={handleComplete}
                                                className="text-xs mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition-colors"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    </div>
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

                            <div className="card p-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30">
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

                            {/* Summary of selections */}
                            <div className="card p-4 space-y-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase">Your Setup</h4>
                                <div className="flex flex-wrap gap-2">
                                    <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                        {GOAL_OPTIONS.find(g => g.id === profile.goal)?.emoji} {profile.goal}
                                    </span>
                                    <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                        {profile.weight_lbs} lbs
                                    </span>
                                    <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                        {EXPERIENCE_OPTIONS.find(e => e.id === profile.training_experience)?.label}
                                    </span>
                                    <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                        {EQUIPMENT_OPTIONS.find(e => e.id === profile.equipment_access)?.label}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={prevStep}
                                    disabled={saving}
                                    className="btn-secondary flex-1 active:scale-[0.98] transition-transform"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleComplete}
                                    disabled={saving}
                                    className="btn-primary flex-1 flex justify-center items-center gap-2 active:scale-[0.98] transition-transform"
                                >
                                    {saving ? (
                                        <>
                                            <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Start Training</span>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(Onboarding);
