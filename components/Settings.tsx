'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabaseClient';
import LoaderIcon from './icons/LoaderIcon';

interface SettingsProps {
    onBack: () => void;
}

interface ProfileData {
    full_name: string;
    goal: string | null;
    height_inches: number | null;
    weight_lbs: number | null;
    age: number | null;
    training_experience: string | null;
    equipment_access: string | null;
    days_per_week: number | null;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { user, signOut } = useAuth();
    const [profile, setProfile] = useState<ProfileData>({
        full_name: '',
        goal: null,
        height_inches: null,
        weight_lbs: null,
        age: null,
        training_experience: null,
        equipment_access: null,
        days_per_week: null
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, goal, height_inches, weight_lbs, age, training_experience, equipment_access, days_per_week')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile({
                    full_name: data.full_name || '',
                    goal: data.goal,
                    height_inches: data.height_inches,
                    weight_lbs: data.weight_lbs,
                    age: data.age,
                    training_experience: data.training_experience,
                    equipment_access: data.equipment_access,
                    days_per_week: data.days_per_week
                });
            }
            setLoading(false);
        };

        fetchProfile();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: profile.full_name,
                goal: profile.goal,
                height_inches: profile.height_inches,
                weight_lbs: profile.weight_lbs,
                age: profile.age,
                training_experience: profile.training_experience,
                equipment_access: profile.equipment_access,
                days_per_week: profile.days_per_week
            })
            .eq('id', user.id);

        setSaving(false);
        if (!error) {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    const handleSignOut = async () => {
        if (confirm('Are you sure you want to sign out?')) {
            await signOut();
        }
    };

    const getInitials = () => {
        if (profile.full_name) {
            return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        return user?.email?.[0]?.toUpperCase() || 'U';
    };

    if (loading) {
        return (
            <div className="w-full py-20 text-center">
                <LoaderIcon className="w-12 h-12 text-[var(--color-primary)] animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading settings...</p>
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
                    <h2 className="text-2xl font-black text-white">SETTINGS</h2>
                    <p className="text-gray-400 text-sm">Manage your profile</p>
                </div>
            </header>

            {/* Profile Avatar */}
            <div className="flex flex-col items-center py-6">
                <div className="w-24 h-24 bg-gradient-to-br from-[var(--color-primary)] to-purple-600 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl font-bold text-white">{getInitials()}</span>
                </div>
                <p className="text-white font-bold text-lg">{profile.full_name || 'Set your name'}</p>
                <p className="text-gray-400 text-sm">{user?.email}</p>
            </div>

            {/* Profile Form */}
            <div className="card space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">Profile Info</h3>

                <div>
                    <label className="block text-gray-400 text-sm mb-2">Full Name</label>
                    <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                        placeholder="Your name"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Age</label>
                        <input
                            type="number"
                            value={profile.age || ''}
                            onChange={(e) => setProfile({ ...profile, age: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                            placeholder="Age"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Weight (lbs)</label>
                        <input
                            type="number"
                            value={profile.weight_lbs || ''}
                            onChange={(e) => setProfile({ ...profile, weight_lbs: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                            placeholder="Weight"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-gray-400 text-sm mb-2">Height</label>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            value={profile.height_inches ? Math.floor(profile.height_inches / 12) : ''}
                            onChange={(e) => {
                                const feet = parseInt(e.target.value) || 0;
                                const inches = (profile.height_inches || 0) % 12;
                                setProfile({ ...profile, height_inches: feet * 12 + inches });
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                            placeholder="Feet"
                        />
                        <input
                            type="number"
                            value={profile.height_inches ? profile.height_inches % 12 : ''}
                            onChange={(e) => {
                                const feet = Math.floor((profile.height_inches || 0) / 12);
                                const inches = parseInt(e.target.value) || 0;
                                setProfile({ ...profile, height_inches: feet * 12 + inches });
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                            placeholder="Inches"
                        />
                    </div>
                </div>
            </div>

            {/* Training Preferences */}
            <div className="card space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">Training Preferences</h3>

                <div>
                    <label className="block text-gray-400 text-sm mb-2">Goal</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['CUT', 'RECOMP', 'BULK'].map((g) => (
                            <button
                                key={g}
                                onClick={() => setProfile({ ...profile, goal: g })}
                                className={`py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                                    profile.goal === g
                                        ? 'bg-[var(--color-primary)] text-black'
                                        : 'bg-gray-800 text-gray-400 hover:text-white'
                                }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-gray-400 text-sm mb-2">Experience Level</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['beginner', 'intermediate', 'advanced'].map((exp) => (
                            <button
                                key={exp}
                                onClick={() => setProfile({ ...profile, training_experience: exp })}
                                className={`py-3 px-4 rounded-xl font-bold text-sm capitalize transition-all ${
                                    profile.training_experience === exp
                                        ? 'bg-[var(--color-primary)] text-black'
                                        : 'bg-gray-800 text-gray-400 hover:text-white'
                                }`}
                            >
                                {exp}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-gray-400 text-sm mb-2">Equipment Access</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['gym', 'home', 'minimal'].map((eq) => (
                            <button
                                key={eq}
                                onClick={() => setProfile({ ...profile, equipment_access: eq })}
                                className={`py-3 px-4 rounded-xl font-bold text-sm capitalize transition-all ${
                                    profile.equipment_access === eq
                                        ? 'bg-[var(--color-primary)] text-black'
                                        : 'bg-gray-800 text-gray-400 hover:text-white'
                                }`}
                            >
                                {eq}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-gray-400 text-sm mb-2">Days Per Week</label>
                    <div className="grid grid-cols-5 gap-2">
                        {[2, 3, 4, 5, 6].map((days) => (
                            <button
                                key={days}
                                onClick={() => setProfile({ ...profile, days_per_week: days })}
                                className={`py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                                    profile.days_per_week === days
                                        ? 'bg-[var(--color-primary)] text-black'
                                        : 'bg-gray-800 text-gray-400 hover:text-white'
                                }`}
                            >
                                {days}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                        Saving...
                    </>
                ) : saved ? (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Saved!
                    </>
                ) : (
                    'Save Changes'
                )}
            </button>

            {/* Sign Out */}
            <button
                onClick={handleSignOut}
                className="w-full py-4 text-red-400 hover:text-red-300 font-bold transition-colors"
            >
                Sign Out
            </button>

            {/* App Info */}
            <div className="text-center text-gray-500 text-sm pt-4">
                <p>SLOE FIT AI v1.0</p>
            </div>
        </div>
    );
};

export default Settings;
