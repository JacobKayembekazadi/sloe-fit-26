'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/supabaseClient';
import LoaderIcon from './icons/LoaderIcon';

interface JoinInviteProps {
    inviteCode?: string;
    onSuccess?: () => void;
    onClose?: () => void;
}

const JoinInvite: React.FC<JoinInviteProps> = ({ inviteCode: initialCode, onSuccess, onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [code, setCode] = useState(initialCode || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Check URL for invite code on mount
    useEffect(() => {
        const path = window.location.pathname;
        const match = path.match(/\/join\/([A-Z0-9-]+)/i);
        if (match && match[1]) {
            setCode(match[1]);
        }
    }, []);

    const handleJoin = async () => {
        if (!user || !code) return;
        setLoading(true);
        setError(null);

        try {
            // Call the atomic function to use the invite
            const { data, error: rpcError } = await supabase
                .rpc('use_trainer_invite', {
                    p_invite_code: code.toUpperCase(),
                    p_client_id: user.id
                });

            if (rpcError) {
                setError('Failed to join. Please try again.');
                return;
            }

            const result = data as { success: boolean; error?: string; trainer_id?: string };

            if (result.success) {
                setSuccess(true);
                showToast('Successfully joined trainer!', 'success');
                // Clear the URL path
                window.history.replaceState({}, '', '/');
                setTimeout(() => {
                    onSuccess?.();
                }, 1500);
            } else {
                setError(result.error || 'Invalid invite code');
            }
        } catch (err) {
            console.error('Error joining:', err);
            setError('Something went wrong. Please try again.');
            showToast('Failed to join trainer', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <div className="card max-w-md w-full text-center py-8">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">You're Connected!</h3>
                    <p className="text-gray-400">Your trainer can now view your progress.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="card max-w-md w-full">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Join a Trainer</h3>
                    {onClose && (
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <p className="text-gray-400 mb-6">
                    Enter the invite code from your trainer to connect and share your progress.
                </p>

                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="SLOE-XXXXXX"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center font-mono text-lg tracking-wider focus:border-[var(--color-primary)] focus:outline-none transition-colors mb-4"
                />

                {error && (
                    <p className="text-red-400 text-sm text-center mb-4">{error}</p>
                )}

                <button
                    onClick={handleJoin}
                    disabled={loading || !code}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <LoaderIcon className="w-5 h-5 animate-spin" />
                            Joining...
                        </>
                    ) : (
                        'Join Trainer'
                    )}
                </button>

                <p className="text-gray-500 text-xs text-center mt-4">
                    Your trainer will be able to see your workouts and nutrition progress.
                </p>
            </div>
        </div>
    );
};

export default JoinInvite;
