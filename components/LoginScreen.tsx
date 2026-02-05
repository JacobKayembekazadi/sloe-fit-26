import React, { useState, memo } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import LoaderIcon from './icons/LoaderIcon';
import WelcomeScreen from './WelcomeScreen';
import OnboardingQuiz, { OnboardingData } from './onboarding/OnboardingQuiz';

const LoginScreen: React.FC = () => {
    const { showToast } = useToast();
    const [view, setView] = useState<'welcome' | 'quiz' | 'auth'>('welcome');
    // Store onboarding data to save on signup
    const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState(''); // For Signup
    const [isTrainer, setIsTrainer] = useState(false); // For trainer signup
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

    // Validate email format
    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Validate password strength (min 6 chars for Supabase)
    const validatePassword = (password: string): string | null => {
        if (password.length < 6) {
            return 'Password must be at least 6 characters';
        }
        return null;
    };

    // Validate all fields
    const validateForm = (): boolean => {
        const errors: { email?: string; password?: string; fullName?: string } = {};

        if (!isValidEmail(email)) {
            errors.email = 'Please enter a valid email address';
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            errors.password = passwordError;
        }

        if (isSignUp && fullName.trim().length < 2) {
            errors.fullName = 'Please enter your name';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            if (isSignUp) {
                // Combine standard metadata with onboarding data (if available)
                const metadata = {
                    full_name: fullName,
                    is_trainer: isTrainer,
                    ...(onboardingData || {}) // Spread onboarding quiz answers
                };

                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: metadata,
                    },
                });
                if (error) throw error;

                // Check if email confirmation is required
                if (data.user && !data.session) {
                    alert('Check your email to confirm your account, then sign in.');
                } else if (data.session) {
                    return;
                } else {
                    alert('Account created! You can now sign in.');
                }
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            let message = err.message || 'Authentication failed';
            if (message.includes('Email not confirmed')) {
                message = 'Please check your email and click the confirmation link before signing in.';
            } else if (message.includes('Invalid login credentials')) {
                message = 'Invalid email or password.';
            } else if (message.includes('User already registered')) {
                message = 'An account with this email already exists.';
            }
            setError(message);
            showToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (view === 'welcome') {
        return (
            <WelcomeScreen
                onGetStarted={() => {
                    setView('quiz'); // Go to quiz first
                }}
                onLogin={() => {
                    setView('auth');
                    setIsSignUp(false);
                }}
            />
        );
    }

    if (view === 'quiz') {
        return (
            <OnboardingQuiz
                onComplete={(data) => {
                    setOnboardingData(data); // Save data
                    setView('auth');
                    setIsSignUp(true); // Go to signup
                }}
                onBack={() => setView('welcome')}
            />
        );
    }

    return (
        <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-fade-in relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

            <div className="w-full max-w-md space-y-8 z-10">
                <div className="text-center">
                    <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
                        SLOE FIT <span className="text-[var(--color-primary)]">AI</span>
                    </h1>
                    <p className="text-gray-400">Join the elite.</p>
                </div>

                <div className="card space-y-6">
                    <h2 className="text-2xl font-bold text-white text-center">
                        {isSignUp ? 'Save Your Plan' : 'Welcome Back'}
                    </h2>

                    {/* Show summary of plan if signing up from quiz */}
                    {isSignUp && onboardingData && (
                        <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-center border border-gray-700">
                            <span className="text-gray-400">Target:</span> <span className="text-[var(--color-primary)] font-bold">{onboardingData.goal}</span>
                            <span className="mx-2 text-gray-600">|</span>
                            <span className="text-gray-400">Focus:</span> <span className="text-white font-bold">{onboardingData.hurdle}</span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                        {isSignUp && (
                            <div>
                                <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => {
                                        setFullName(e.target.value);
                                        if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: undefined }));
                                    }}
                                    className={`input-field w-full ${fieldErrors.fullName ? 'border-red-500' : ''}`}
                                    placeholder="King Kay"
                                />
                                {fieldErrors.fullName && (
                                    <p className="text-red-400 text-xs mt-1">{fieldErrors.fullName}</p>
                                )}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                                }}
                                className={`input-field w-full ${fieldErrors.email ? 'border-red-500' : ''}`}
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                            {fieldErrors.email && (
                                <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                                }}
                                className={`input-field w-full ${fieldErrors.password ? 'border-red-500' : ''}`}
                                placeholder="••••••••"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                            />
                            {fieldErrors.password && (
                                <p className="text-red-400 text-xs mt-1">{fieldErrors.password}</p>
                            )}
                            {isSignUp && !fieldErrors.password && (
                                <p className="text-gray-500 text-xs mt-1">Minimum 6 characters</p>
                            )}
                        </div>

                        {isSignUp && (
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={isTrainer}
                                        onChange={(e) => setIsTrainer(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-5 h-5 border-2 border-gray-600 rounded bg-gray-800 peer-checked:bg-[var(--color-primary)] peer-checked:border-[var(--color-primary)] transition-all flex items-center justify-center">
                                        {isTrainer && (
                                            <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <span className="text-gray-400 text-sm group-hover:text-white transition-colors">
                                    I'm a fitness trainer
                                </span>
                            </label>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex justify-center items-center min-h-[48px]"
                        >
                            {loading ? <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : (isSignUp ? 'Complete Registration' : 'Log In')}
                        </button>
                    </form>

                    <div className="text-center">
                        {/* Back to quiz option if in signup mode from quiz */}
                        {isSignUp && onboardingData && (
                            <button
                                onClick={() => setView('quiz')}
                                className="text-gray-500 text-sm hover:text-white transition-colors mb-4 block w-full"
                            >
                                ← Modify Plan
                            </button>
                        )}

                        <button
                            onClick={() => {
                                const newIsSignUp = !isSignUp;
                                setIsSignUp(newIsSignUp);
                                setError(null);
                                setIsTrainer(false);
                                setOnboardingData(null); // Clear data if switching to login manually or toggling
                            }}
                            className="text-gray-500 text-sm hover:text-white transition-colors"
                        >
                            {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(LoginScreen);
