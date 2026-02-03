import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import LoaderIcon from './icons/LoaderIcon';

const LoginScreen: React.FC = () => {
    const { showToast } = useToast();
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
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            is_trainer: isTrainer,
                        },
                    },
                });
                if (error) throw error;

                // Check if email confirmation is required
                if (data.user && !data.session) {
                    // Email confirmation required
                    alert('Check your email to confirm your account, then sign in.');
                } else if (data.session) {
                    // Auto-signed in (email confirmation disabled)
                    // Session will be picked up by AuthContext
                    return;
                } else {
                    alert('Account created! You can now sign in.');
                }
                setIsSignUp(false); // Switch to login after signup
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            // Provide more helpful error messages
            let message = err.message || 'Authentication failed';
            if (message.includes('Email not confirmed')) {
                message = 'Please check your email and click the confirmation link before signing in.';
            } else if (message.includes('Invalid login credentials')) {
                message = 'Invalid email or password. If you just signed up, check your email for a confirmation link.';
            } else if (message.includes('User already registered')) {
                message = 'An account with this email already exists. Try signing in instead.';
            }
            setError(message);
            showToast(message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 animate-fade-in relative overflow-hidden">
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
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h2>

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
                            {loading ? <LoaderIcon className="w-5 h-5 animate-spin" /> : (isSignUp ? 'Sign Up' : 'Log In')}
                        </button>
                    </form>

                    <div className="text-center">
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                                setIsTrainer(false);
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

export default LoginScreen;
