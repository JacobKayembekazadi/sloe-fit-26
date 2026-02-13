import React, { useState, useCallback, useRef, memo } from 'react';
import { supabaseUpsert } from '../services/supabaseRawFetch';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import LoaderIcon from './icons/LoaderIcon';
import CheckIcon from './icons/CheckIcon';
import { getAllSupplements, type SupplementPreferences } from '../services/supplementService';

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

const ACTIVITY_OPTIONS = [
    { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise', emoji: '🪑' },
    { id: 'lightly_active', label: 'Lightly Active', desc: 'Exercise 1-3 days/week', emoji: '🚶' },
    { id: 'moderately_active', label: 'Moderately Active', desc: 'Exercise 3-5 days/week', emoji: '🏃' },
    { id: 'very_active', label: 'Very Active', desc: 'Exercise 6-7 days/week', emoji: '⚡' },
    { id: 'extremely_active', label: 'Extremely Active', desc: 'Intense daily exercise', emoji: '🔥' },
];

type Step = 'welcome' | 'goal' | 'stats' | 'activity' | 'experience' | 'equipment' | 'schedule' | 'supplements';

const STEPS: Step[] = ['welcome', 'goal', 'stats', 'activity', 'experience', 'equipment', 'schedule', 'supplements'];

type SupplementMode = 'not_interested' | 'using' | 'open_to_recommendations';

const SUPPLEMENT_MODE_OPTIONS = [
    { id: 'using', label: 'Yes, I take supplements', description: 'I already use fitness supplements', emoji: '💊' },
    { id: 'open_to_recommendations', label: 'Open to recommendations', description: 'Show me what might help my goals', emoji: '🤔' },
    { id: 'not_interested', label: 'No thanks', description: "I'll pass on supplements for now", emoji: '✋' },
] as const;

interface ProfileData {
    goal: string | null;
    gender: string | null;
    height_ft: string;
    height_in: string;
    weight_lbs: string;
    age: string;
    activity_level: string | null;
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
        gender: null,
        height_ft: '',
        height_in: '',
        weight_lbs: '',
        age: '',
        activity_level: null,
        training_experience: null,
        equipment_access: null,
        days_per_week: 4
    });

    // Supplement preferences state
    const [supplementMode, setSupplementMode] = useState<SupplementMode | null>(null);
    const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
    const allSupplements = getAllSupplements();

    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'Champion';

    const updateProfile = (field: keyof ProfileData, value: string | number | null) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        if (field === 'height_ft' || field === 'height_in') {
            setValidationErrors(prev => ({ ...prev, height: undefined }));
        } else if (field === 'weight_lbs') {
            setValidationErrors(prev => ({ ...prev, weight: undefined }));
        } else if (field === 'age') {
            setValidationErrors(prev => ({ ...prev, age: undefined }));
        }
        setError(null);
    };

    const validateStats = useCallback((): boolean => {
        const errors: ValidationErrors = {};
        let isValid = true;

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

        const weight = parseInt(profile.weight_lbs);
        if (!profile.weight_lbs) {
            errors.weight = 'Weight is required';
            isValid = false;
        } else if (weight < 80 || weight > 500) {
            errors.weight = 'Weight must be between 80-500 lbs';
            isValid = false;
        }

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

    const isSavingRef = useRef(false);

    const handleComplete = async () => {
        if (!user) {
            setError('You must be logged in to complete onboarding.');
            return;
        }

        if (isSavingRef.current) return;
        isSavingRef.current = true;

        setSaving(true);
        setError(null);

        try {
            const heightInches = (parseInt(profile.height_ft) || 0) * 12 + (parseInt(profile.height_in) || 0);

            // Build supplement preferences object
            const supplementPreferences: SupplementPreferences = {
                enabled: supplementMode !== 'not_interested',
                products: supplementMode === 'using' ? selectedSupplements : [],
                openToRecommendations: supplementMode === 'open_to_recommendations'
            };

            const { error: updateError } = await supabaseUpsert(
                'profiles',
                {
                    id: user.id,
                    goal: profile.goal,
                    gender: profile.gender,
                    height_inches: heightInches || null,
                    weight_lbs: parseInt(profile.weight_lbs) || null,
                    age: parseInt(profile.age) || null,
                    activity_level: profile.activity_level || 'moderately_active',
                    training_experience: profile.training_experience,
                    equipment_access: profile.equipment_access,
                    days_per_week: profile.days_per_week,
                    supplement_preferences: supplementPreferences,
                    onboarding_complete: true
                },
                'id'
            );

            if (updateError) {
                throw updateError;
            }

            isSavingRef.current = false;
            setSaving(false);
            onComplete();
        } catch (err: any) {
            if (err.message?.includes('network') || err.message?.includes('fetch') || err.message?.includes('timeout')) {
                setError('Network error. Please check your connection and try again.');
            } else if (err.code === '23505') {
                setError('Profile already exists. Refreshing...');
                setTimeout(() => onComplete(), 1000);
            } else {
                setError(err.message || 'Failed to save your profile. Please try again.');
            }
            showToast("Setup failed. Try again.", 'error');
            isSavingRef.current = false;
            setSaving(false);
        }
    };

    const nextStep = () => {
        if (step === 'stats' && !validateStats()) {
            return;
        }

        const currentIndex = STEPS.indexOf(step);
        if (currentIndex < STEPS.length - 1) {
            setTransitionDirection('forward');
            setLoading(true);
            setTimeout(() => {
                setStep(STEPS[currentIndex + 1]);
                setLoading(false);
            }, 150);
        }
    };

    const prevStep = () => {
        const currentIndex = STEPS.indexOf(step);
        if (currentIndex > 0) {
            setTransitionDirection('back');
            setError(null);
            setLoading(true);
            setTimeout(() => {
                setStep(STEPS[currentIndex - 1]);
                setLoading(false);
            }, 150);
        }
    };

    const getStepNumber = () => {
        return STEPS.indexOf(step);
    };

    const canProceed = (): boolean => {
        switch (step) {
            case 'welcome':
                return true;
            case 'goal':
                return !!profile.goal;
            case 'stats': {
                const w = parseInt(profile.weight_lbs);
                return !!profile.weight_lbs && w >= 80 && w <= 500;
            }
            case 'activity':
                return !!profile.activity_level;
            case 'experience':
                return !!profile.training_experience;
            case 'equipment':
                return !!profile.equipment_access;
            case 'schedule':
                return true;
            case 'supplements':
                // Must select a mode, and if "using" mode, must select at least one supplement
                if (!supplementMode) return false;
                if (supplementMode === 'using' && selectedSupplements.length === 0) return false;
                return true;
            default:
                return false;
        }
    };

    const renderProgressBar = () => {
        const totalSteps = STEPS.length - 1; // Excluding welcome
        const currentStep = getStepNumber();
        if (currentStep === 0) return null;

        const adjustedStep = currentStep - 1;

        return (
            <div className="flex gap-2 mb-6">
                {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            i < adjustedStep
                                ? 'bg-[var(--color-primary)]'
                                : i === adjustedStep
                                    ? 'bg-[var(--color-primary)]/50'
                                    : 'bg-gray-700'
                        }`}
                    />
                ))}
            </div>
        );
    };

    // Fixed bottom nav buttons — always visible
    const renderFixedNavButtons = (opts?: { isLast?: boolean }) => (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black via-black/95 to-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
            <div className="w-full max-w-lg mx-auto flex gap-3">
                <button onClick={prevStep} disabled={loading || saving} className="btn-secondary flex-1 active:scale-[0.98] transition-transform">
                    Back
                </button>
                {opts?.isLast ? (
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
                ) : (
                    <button
                        onClick={nextStep}
                        disabled={!canProceed() || loading}
                        className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                        {loading ? <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : 'Continue'}
                    </button>
                )}
            </div>
        </div>
    );

    const animationClass = loading
        ? 'opacity-0 scale-95'
        : `opacity-100 scale-100 ${transitionDirection === 'forward' ? 'animate-slide-up' : 'animate-slide-down'}`;

    return (
        <div className="h-[100dvh] bg-black flex flex-col relative">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--color-primary)]/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-48 -mb-48 pointer-events-none"></div>

            {/* Scrollable content area — bottom padding reserves space for fixed buttons */}
            <div className="flex-1 overflow-y-auto p-6 pb-28">
                <div className="w-full max-w-lg mx-auto relative z-10">
                    {renderProgressBar()}

                    <div className={`transition-all duration-200 ${animationClass}`}>
                        {/* ============================================================ */}
                        {/* STEP: Welcome                                                */}
                        {/* ============================================================ */}
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

                                <p className="text-gray-600 text-xs">Takes about 60 seconds</p>
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* STEP: Goal Selection (expand on tap)                         */}
                        {/* ============================================================ */}
                        {step === 'goal' && (
                            <div className="space-y-6">
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-black text-white">What's your goal?</h2>
                                    <p className="text-gray-400">This customizes your workouts and nutrition.</p>
                                </div>

                                <div className="space-y-3">
                                    {GOAL_OPTIONS.map((goal) => {
                                        const isSelected = profile.goal === goal.id;
                                        return (
                                            <button
                                                key={goal.id}
                                                onClick={() => updateProfile('goal', goal.id)}
                                                className={`w-full rounded-xl text-left transition-all duration-300 active:scale-[0.98] ${
                                                    isSelected
                                                        ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20 p-5'
                                                        : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700 hover:bg-gray-800/80 p-4'
                                                }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-3xl transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
                                                        {goal.emoji}
                                                    </span>
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-white text-lg">{goal.title}</h3>
                                                        <p className="text-gray-400 text-sm">{goal.description}</p>
                                                    </div>
                                                    <div className={`transition-all duration-200 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                                        <CheckIcon className="w-6 h-6 text-[var(--color-primary)]" />
                                                    </div>
                                                </div>
                                                {/* Expanded details — only visible when selected */}
                                                <div className={`overflow-hidden transition-all duration-300 ${isSelected ? 'max-h-32 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                                                    <div className="flex flex-wrap gap-2 pl-[3.25rem]">
                                                        {goal.details.map((detail, i) => (
                                                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                                                {detail}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Motivational nudge when goal is selected */}
                                {profile.goal && (
                                    <div className="text-center animate-slide-up">
                                        <p className="text-gray-500 text-sm">
                                            {profile.goal === 'CUT' && "Let's shred. Your AI coach will keep protein high and workouts intense."}
                                            {profile.goal === 'BULK' && "Time to grow. Extra calories and heavy compounds incoming."}
                                            {profile.goal === 'RECOMP' && "The best of both worlds. Precision nutrition meets smart training."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* STEP: Body Stats (gender, height, weight, age)               */}
                        {/* ============================================================ */}
                        {step === 'stats' && (
                            <div className="space-y-6">
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-black text-white">Your Body</h2>
                                    <p className="text-gray-400">For accurate calorie and macro targets.</p>
                                </div>

                                <div className="card p-6 space-y-5">
                                    {/* Gender */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-400 mb-2">Gender <span className="text-gray-600 font-normal">(for accurate calorie targets)</span></label>
                                        <div className="flex gap-3">
                                            {[
                                                { id: 'male', label: 'Male' },
                                                { id: 'female', label: 'Female' },
                                            ].map((g) => (
                                                <button
                                                    key={g.id}
                                                    onClick={() => updateProfile('gender', g.id)}
                                                    className={`flex-1 py-3 rounded-xl text-center font-bold transition-all duration-200 active:scale-[0.98] ${
                                                        profile.gender === g.id
                                                            ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] text-white'
                                                            : 'bg-gray-800 border-2 border-transparent text-gray-400 hover:border-gray-700'
                                                    }`}
                                                >
                                                    {g.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Height */}
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

                                    {/* Weight */}
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

                                    {/* Age */}
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
                                    Used to calculate your personalized calorie and macro targets.
                                </p>
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* STEP: Activity Level (own dedicated page)                    */}
                        {/* ============================================================ */}
                        {step === 'activity' && (
                            <div className="space-y-6">
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-black text-white">Activity Level</h2>
                                    <p className="text-gray-400">How active are you throughout the week?</p>
                                </div>

                                <div className="space-y-3">
                                    {ACTIVITY_OPTIONS.map((a) => {
                                        const isSelected = profile.activity_level === a.id;
                                        return (
                                            <button
                                                key={a.id}
                                                onClick={() => updateProfile('activity_level', a.id)}
                                                className={`w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center gap-4 active:scale-[0.98] ${
                                                    isSelected
                                                        ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                                        : 'bg-[var(--bg-card)] border-2 border-transparent hover:border-gray-700 hover:bg-gray-800/80'
                                                }`}
                                            >
                                                <span className={`text-2xl transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
                                                    {a.emoji}
                                                </span>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-white">{a.label}</h3>
                                                    <p className="text-gray-400 text-sm">{a.desc}</p>
                                                </div>
                                                <div className={`transition-all duration-200 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                                    <CheckIcon className="w-5 h-5 text-[var(--color-primary)]" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {profile.activity_level && (
                                    <div className="card p-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 animate-slide-up">
                                        <p className="text-sm text-gray-300">
                                            {profile.activity_level === 'sedentary' && "Your calorie targets will be set conservatively to match your lifestyle."}
                                            {profile.activity_level === 'lightly_active' && "A solid starting point. Your targets will account for light activity."}
                                            {profile.activity_level === 'moderately_active' && "Nice balance. Your targets will fuel your active lifestyle."}
                                            {profile.activity_level === 'very_active' && "High energy needs. Your calories will be set higher to keep you fueled."}
                                            {profile.activity_level === 'extremely_active' && "Beast mode. Maximum fuel for maximum output."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* STEP: Training Experience                                     */}
                        {/* ============================================================ */}
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

                                {profile.training_experience && (
                                    <div className="card p-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 animate-slide-up">
                                        <p className="text-sm text-gray-300">
                                            {profile.training_experience === 'beginner' && "Perfect. AI will start with foundational movements and build from there."}
                                            {profile.training_experience === 'intermediate' && "Great base. Expect progressive overload and periodization in your workouts."}
                                            {profile.training_experience === 'advanced' && "Let's push limits. Advanced techniques and higher volume programming ahead."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* STEP: Equipment Access                                        */}
                        {/* ============================================================ */}
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
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* STEP: Schedule + Summary + Start                              */}
                        {/* ============================================================ */}
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
                                            <>Perfect for <strong className="text-white">Full Body</strong> training - hitting each muscle 2-3x/week</>
                                        ) : profile.days_per_week <= 4 ? (
                                            <>Ideal for <strong className="text-white">Upper/Lower</strong> or <strong className="text-white">PHUL</strong> split</>
                                        ) : (
                                            <>Great for <strong className="text-white">Push/Pull/Legs</strong> with maximum frequency</>
                                        )}
                                    </p>
                                </div>

                                {/* Summary of selections */}
                                <div className="card p-4 space-y-2">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase">Your Program</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.goal && (
                                            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                                {GOAL_OPTIONS.find(g => g.id === profile.goal)?.emoji} {GOAL_OPTIONS.find(g => g.id === profile.goal)?.title}
                                            </span>
                                        )}
                                        {profile.gender && (
                                            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                                {profile.gender === 'male' ? '♂' : '♀'} {profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}
                                            </span>
                                        )}
                                        {profile.weight_lbs && (
                                            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                                {profile.weight_lbs} lbs
                                            </span>
                                        )}
                                        {profile.activity_level && (
                                            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                                {ACTIVITY_OPTIONS.find(a => a.id === profile.activity_level)?.emoji} {ACTIVITY_OPTIONS.find(a => a.id === profile.activity_level)?.label}
                                            </span>
                                        )}
                                        {profile.training_experience && (
                                            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                                {EXPERIENCE_OPTIONS.find(e => e.id === profile.training_experience)?.emoji} {EXPERIENCE_OPTIONS.find(e => e.id === profile.training_experience)?.label}
                                            </span>
                                        )}
                                        {profile.equipment_access && (
                                            <span className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300">
                                                {EQUIPMENT_OPTIONS.find(e => e.id === profile.equipment_access)?.emoji} {EQUIPMENT_OPTIONS.find(e => e.id === profile.equipment_access)?.label}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUPPLEMENTS STEP */}
                        {step === 'supplements' && (
                            <div className="space-y-6">
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-black text-white">Supplements</h2>
                                    <p className="text-gray-400">Are you currently taking any fitness supplements?</p>
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

                                {/* Mode Selection */}
                                <div className="space-y-3">
                                    {SUPPLEMENT_MODE_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => {
                                                setSupplementMode(option.id);
                                                if (option.id === 'not_interested') {
                                                    setSelectedSupplements([]);
                                                }
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                                                supplementMode === option.id
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="text-2xl">{option.emoji}</span>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-white">{option.label}</h4>
                                                    <p className="text-sm text-gray-400 mt-0.5">{option.description}</p>
                                                </div>
                                                {supplementMode === option.id && (
                                                    <CheckIcon className="w-5 h-5 text-[var(--color-primary)]" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* Supplement Selection (only if "using" mode) */}
                                {supplementMode === 'using' && (
                                    <div className="space-y-3 mt-6">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase">Select the supplements you use:</h4>
                                        {/* C7 FIX: Show fallback if catalog is empty */}
                                        {allSupplements.length === 0 ? (
                                            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4 text-center">
                                                <p className="text-yellow-400 text-sm">
                                                    Unable to load supplement list. Please try again later or select "Open to recommendations".
                                                </p>
                                            </div>
                                        ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            {allSupplements.map((supp) => (
                                                <button
                                                    key={supp.id}
                                                    onClick={() => {
                                                        setSelectedSupplements(prev =>
                                                            prev.includes(supp.id)
                                                                ? prev.filter(id => id !== supp.id)
                                                                : [...prev, supp.id]
                                                        );
                                                    }}
                                                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                                                        selectedSupplements.includes(supp.id)
                                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                                            : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="material-symbols-outlined text-xl text-gray-400">
                                                            {supp.icon}
                                                        </span>
                                                        <div className="flex-1">
                                                            <span className="font-medium text-white">{supp.name}</span>
                                                            <p className="text-xs text-gray-500">{supp.benefit}</p>
                                                        </div>
                                                        {selectedSupplements.includes(supp.id) && (
                                                            <CheckIcon className="w-5 h-5 text-[var(--color-primary)]" />
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        )}
                                        {/* Validation message */}
                                        {allSupplements.length > 0 && selectedSupplements.length === 0 && (
                                            <p className="text-sm text-yellow-400 flex items-center gap-2 mt-2">
                                                <span className="material-symbols-outlined text-lg">warning</span>
                                                Select at least one supplement to continue
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Info card for "open to recommendations" */}
                                {supplementMode === 'open_to_recommendations' && (
                                    <div className="card p-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 mt-4">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-[var(--color-primary)]">tips_and_updates</span>
                                            <p className="text-sm text-gray-300">
                                                We'll suggest supplements based on your <strong className="text-white">{profile.goal}</strong> goal.
                                                {profile.goal === 'CUT' && ' For cutting, fat burners and whey protein can help.'}
                                                {profile.goal === 'BULK' && ' For bulking, creatine, protein, and Alpha Male can maximize gains.'}
                                                {profile.goal === 'RECOMP' && ' For recomp, protein and creatine support both goals.'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Info card for "not interested" */}
                                {supplementMode === 'not_interested' && (
                                    <div className="card p-4 bg-gray-800/50 border border-gray-700 mt-4">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-gray-400">check_circle</span>
                                            <p className="text-sm text-gray-400">
                                                No problem! You can always change this later in Settings. Your workouts and nutrition
                                                recommendations won't include supplement suggestions.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed bottom nav buttons — ALWAYS visible on every step except welcome */}
            {step !== 'welcome' && renderFixedNavButtons({ isLast: step === 'supplements' })}
        </div>
    );
};

export default memo(Onboarding);
