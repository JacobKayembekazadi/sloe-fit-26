'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabaseClient';
import LoaderIcon from './icons/LoaderIcon';

interface TrainerDashboardProps {
    onBack: () => void;
}

interface Client {
    id: string;
    full_name: string | null;
    email: string;
    goal: string | null;
    created_at: string;
    last_workout?: string;
}

interface Invite {
    id: string;
    invite_code: string;
    max_uses: number | null;
    uses_count: number;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
}

const TrainerDashboard: React.FC<TrainerDashboardProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [invites, setInvites] = useState<Invite[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingInvite, setCreatingInvite] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'clients' | 'invites'>('clients');

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Fetch clients (profiles where trainer_id = current user)
            const { data: clientData } = await supabase
                .from('profiles')
                .select('id, full_name, goal, created_at')
                .eq('trainer_id', user.id);

            if (clientData) {
                // Get emails from auth (we can only see our own)
                const clientsWithEmail = clientData.map(c => ({
                    ...c,
                    email: 'Client'
                }));
                setClients(clientsWithEmail);
            }

            // Fetch invites
            const { data: inviteData } = await supabase
                .from('trainer_invites')
                .select('*')
                .eq('trainer_id', user.id)
                .order('created_at', { ascending: false });

            if (inviteData) {
                setInvites(inviteData);
            }
        } catch (err) {
            console.error('Error fetching trainer data:', err);
        } finally {
            setLoading(false);
        }
    };

    const createInvite = async () => {
        if (!user) return;
        setCreatingInvite(true);

        try {
            // Generate a random invite code
            const code = `SLOE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const { error } = await supabase
                .from('trainer_invites')
                .insert({
                    trainer_id: user.id,
                    invite_code: code,
                    max_uses: 10,
                    is_active: true
                });

            if (!error) {
                await fetchData();
            }
        } catch (err) {
            console.error('Error creating invite:', err);
        } finally {
            setCreatingInvite(false);
        }
    };

    const copyInviteLink = (code: string) => {
        const link = `${window.location.origin}/join/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const deactivateInvite = async (inviteId: string) => {
        await supabase
            .from('trainer_invites')
            .update({ is_active: false })
            .eq('id', inviteId);
        await fetchData();
    };

    if (loading) {
        return (
            <div className="w-full py-20 text-center">
                <LoaderIcon className="w-12 h-12 text-[var(--color-primary)] animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading trainer dashboard...</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 pb-8">
            {/* Header */}
            <header className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h2 className="text-2xl font-black text-white">TRAINER DASHBOARD</h2>
                    <p className="text-gray-400 text-sm">Manage your clients</p>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="card text-center">
                    <p className="text-3xl font-black text-[var(--color-primary)]">{clients.length}</p>
                    <p className="text-gray-400 text-sm">Active Clients</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-black text-[var(--color-primary)]">{invites.filter(i => i.is_active).length}</p>
                    <p className="text-gray-400 text-sm">Active Invites</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('clients')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                        activeTab === 'clients'
                            ? 'bg-[var(--color-primary)] text-black'
                            : 'bg-gray-800 text-gray-400'
                    }`}
                >
                    Clients
                </button>
                <button
                    onClick={() => setActiveTab('invites')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                        activeTab === 'invites'
                            ? 'bg-[var(--color-primary)] text-black'
                            : 'bg-gray-800 text-gray-400'
                    }`}
                >
                    Invites
                </button>
            </div>

            {/* Clients Tab */}
            {activeTab === 'clients' && (
                <div className="space-y-4">
                    {clients.length === 0 ? (
                        <div className="card text-center py-8">
                            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-gray-400 mb-2">No clients yet</p>
                            <p className="text-gray-500 text-sm">Create an invite link and share it with your clients</p>
                        </div>
                    ) : (
                        clients.map(client => (
                            <div key={client.id} className="card">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-primary)] to-purple-600 rounded-full flex items-center justify-center">
                                        <span className="text-lg font-bold text-white">
                                            {client.full_name?.[0]?.toUpperCase() || '?'}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-white">{client.full_name || 'Unnamed Client'}</p>
                                        <p className="text-gray-400 text-sm">Goal: {client.goal || 'Not set'}</p>
                                    </div>
                                    <button className="p-2 text-gray-400 hover:text-white">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Invites Tab */}
            {activeTab === 'invites' && (
                <div className="space-y-4">
                    <button
                        onClick={createInvite}
                        disabled={creatingInvite}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {creatingInvite ? (
                            <>
                                <LoaderIcon className="w-5 h-5 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create New Invite
                            </>
                        )}
                    </button>

                    {invites.length === 0 ? (
                        <div className="card text-center py-8">
                            <p className="text-gray-400">No invites yet</p>
                            <p className="text-gray-500 text-sm">Create an invite to get started</p>
                        </div>
                    ) : (
                        invites.map(invite => (
                            <div key={invite.id} className={`card ${!invite.is_active ? 'opacity-50' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <code className="text-[var(--color-primary)] font-mono text-lg">{invite.invite_code}</code>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        invite.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {invite.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
                                    <span>Uses: {invite.uses_count}/{invite.max_uses || '∞'}</span>
                                    <span>{new Date(invite.created_at).toLocaleDateString()}</span>
                                </div>
                                {invite.is_active && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => copyInviteLink(invite.invite_code)}
                                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {copiedCode === invite.invite_code ? 'Copied!' : 'Copy Link'}
                                        </button>
                                        <button
                                            onClick={() => deactivateInvite(invite.id)}
                                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Deactivate
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default TrainerDashboard;
