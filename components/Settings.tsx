import React, { useState, useEffect, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/contexts/ToastContext';
import { supabaseGetSingle, supabaseUpdate } from '@/services/supabaseRawFetch';
import { supabase } from '@/supabaseClient';
import LoaderIcon from './icons/LoaderIcon';
import Skeleton from './ui/Skeleton';
import { getAllSupplements, type SupplementPreferences } from '@/services/supplementService';

// Settings loading skeleton
const SettingsSkeleton = () => (
    <div className="w-full space-y-6 pb-8">
        {/* Header */}
        <header className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded" />
            <div className="space-y-2">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-36" />
            </div>
        </header>

        {/* Profile Avatar */}
        <div className="flex flex-col items-center py-6">
            <Skeleton className="w-24 h-24 rounded-full mb-4" />
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
        </div>

        {/* Profile Form skeleton */}
        <div className="card space-y-4">
            <Skeleton className="h-5 w-24 mb-4" />
            <div className="space-y-4">
                <div>
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Skeleton className="h-4 w-12 mb-2" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                    <div>
                        <Skeleton className="h-4 w-20 mb-2" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        </div>

        {/* Training Preferences skeleton */}
        <div className="card space-y-4">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="space-y-4">
                <div>
                    <Skeleton className="h-4 w-12 mb-2" />
                    <div className="grid grid-cols-3 gap-2">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-12 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>

        {/* Save button skeleton */}
        <Skeleton className="h-12 w-full rounded-xl" />
    </div>
);

interface SettingsProps {
    onBack: () => void;
    // FIX 26: Accept saved profile data for optimistic update (avoids stale read replica race)
    onProfileSaved?: (savedData?: Record<string, unknown>) => void;
    // GDPR: Navigation to legal pages
    onPrivacy?: () => void;
    onTerms?: () => void;
}

interface ProfileData {
    full_name: string;
    goal: string | null;
    height_inches: number | null;
    weight_lbs: number | null;
    age: number | null;
    gender: string | null;
    activity_level: string | null;
    training_experience: string | null;
    equipment_access: string | null;
    days_per_week: number | null;
    role: string | null;
    // FIX 3.1: Subscription status
    subscription_status: 'trial' | 'active' | 'expired' | 'none' | null;
    trial_started_at: string | null;
    // Supplement preferences
    supplement_preferences: SupplementPreferences | null;
}

type SupplementMode = 'not_interested' | 'using' | 'open_to_recommendations';

const SUPPLEMENT_MODE_OPTIONS = [
    { id: 'using', label: 'Yes, I take supplements', description: 'Select which supplements you use', emoji: '💊' },
    { id: 'open_to_recommendations', label: 'Open to recommendations', description: 'Let AI suggest supplements for my goals', emoji: '🤔' },
    { id: 'not_interested', label: 'No thanks', description: "Don't show supplement recommendations", emoji: '✋' },
] as const;

const Settings: React.FC<SettingsProps> = ({ onBack, onProfileSaved, onPrivacy, onTerms }) => {
    const { user, signOut } = useAuth();
    const { permission, requestPermission, sendLocalNotification } = useNotifications();
    const { showToast } = useToast();

    const [profile, setProfile] = useState<ProfileData>({
        full_name: '',
        goal: null,
        height_inches: null,
        weight_lbs: null,
        age: null,
        gender: null,
        activity_level: null,
        training_experience: null,
        equipment_access: null,
        days_per_week: null,
        role: null,
        subscription_status: 'trial',
        trial_started_at: null,
        supplement_preferences: null
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Supplement management state
    const [supplementMode, setSupplementMode] = useState<SupplementMode | null>(null);
    const [selectedSupplements, setSelectedSupplements] = useState<string[]>([]);
    const [savingSupplements, setSavingSupplements] = useState(false);
    const allSupplements = getAllSupplements();

    // GDPR: Account deletion state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    // GDPR: Data export state
    const [exporting, setExporting] = useState(false);

    // RALPH LOOP 30: Track fetch errors for retry UI
    const [fetchError, setFetchError] = useState(false);

    // RALPH LOOP 30: Extract fetchProfile for retry capability
    const fetchProfile = React.useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setFetchError(false);

        try {
            const { data, error } = await supabaseGetSingle<any>(
                `profiles?id=eq.${user.id}&select=full_name,goal,height_inches,weight_lbs,age,gender,activity_level,training_experience,equipment_access,days_per_week,role,subscription_status,trial_started_at,supplement_preferences`
            );

            if (error) {
                showToast("Couldn't load profile. Try again.", 'error');
                setFetchError(true);
            } else if (data) {
                setProfile({
                    full_name: data.full_name || '',
                    goal: data.goal,
                    height_inches: data.height_inches,
                    weight_lbs: data.weight_lbs,
                    age: data.age,
                    gender: data.gender || null,
                    activity_level: data.activity_level || null,
                    training_experience: data.training_experience,
                    equipment_access: data.equipment_access,
                    days_per_week: data.days_per_week,
                    role: data.role,
                    subscription_status: data.subscription_status || 'trial',
                    trial_started_at: data.trial_started_at || null,
                    supplement_preferences: data.supplement_preferences || null
                });

                // Initialize supplement state from fetched data
                const prefs = data.supplement_preferences as SupplementPreferences | null;
                if (prefs) {
                    if (!prefs.enabled) {
                        setSupplementMode('not_interested');
                    } else if (prefs.openToRecommendations) {
                        setSupplementMode('open_to_recommendations');
                    } else {
                        setSupplementMode('using');
                    }
                    setSelectedSupplements(prefs.products || []);
                }
                setFetchError(false);
            }
        } catch {
            showToast("Couldn't load profile. Try again.", 'error');
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        try {
            const { error } = await supabaseUpdate(`profiles?id=eq.${user.id}`, {
                full_name: profile.full_name,
                goal: profile.goal,
                height_inches: profile.height_inches,
                weight_lbs: profile.weight_lbs,
                age: profile.age,
                gender: profile.gender,
                activity_level: profile.activity_level,
                training_experience: profile.training_experience,
                equipment_access: profile.equipment_access,
                days_per_week: profile.days_per_week
            });

            if (error) {
                showToast("Didn't save. Try again.", 'error');
            } else {
                setSaved(true);
                showToast('Saved.', 'success');
                setTimeout(() => setSaved(false), 2000);
                // FIX 3.4 + FIX 26: Pass saved values for optimistic update (avoids stale replica)
                onProfileSaved?.({
                    goal: profile.goal,
                    height_inches: profile.height_inches,
                    weight_lbs: profile.weight_lbs,
                    age: profile.age,
                    gender: profile.gender,
                    activity_level: profile.activity_level,
                    training_experience: profile.training_experience,
                    equipment_access: profile.equipment_access,
                    days_per_week: profile.days_per_week,
                    full_name: profile.full_name,
                });
            }
        } catch {
            showToast("Didn't save. Try again.", 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        if (confirm('Are you sure you want to sign out?')) {
            await signOut();
        }
    };

    const handleBecomeTrainer = async () => {
        showToast('Trainer access needs admin approval.', 'info');
    };

    // GDPR: Handle data export
    const handleExportData = async () => {
        if (!user) return;
        setExporting(true);

        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) {
                showToast('Sign in again to export.', 'error');
                return;
            }

            const response = await fetch('/api/account/export', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            // Trigger download
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sloefit-data-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Data exported.', 'success');
        } catch {
            showToast("Export failed. Try again.", 'error');
        } finally {
            setExporting(false);
        }
    };

    // GDPR: Handle account deletion
    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') return;
        if (!user) return;

        setDeleting(true);

        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) {
                showToast('Sign in again to delete.', 'error');
                return;
            }

            const response = await fetch('/api/account/delete', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Deletion failed');
            }

            // Clear localStorage
            localStorage.clear();

            // Sign out
            await signOut();

            showToast('Account deleted.', 'success');
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't delete account.", 'error');
        } finally {
            setDeleting(false);
            setShowDeleteModal(false);
            setDeleteConfirmText('');
        }
    };

    const getInitials = () => {
        if (profile.full_name) {
            return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        return user?.email?.[0]?.toUpperCase() || 'U';
    };

    if (loading) {
        return <SettingsSkeleton />;
    }

    // RALPH LOOP 30: Show retry UI when profile fetch fails
    if (fetchError) {
        return (
            <div className="w-full space-y-6 pb-8">
                <header className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        aria-label="Go back"
                        className="p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-lg"
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

                <div className="card p-8 text-center">
                    <span className="material-symbols-outlined text-5xl text-red-400 mb-4" aria-hidden="true">
                        cloud_off
                    </span>
                    <h3 className="text-lg font-bold text-white mb-2">Unable to Load Profile</h3>
                    <p className="text-gray-400 mb-6">
                        We couldn't load your settings. Please check your connection and try again.
                    </p>
                    <button
                        onClick={fetchProfile}
                        className="btn-primary px-6 py-3 min-h-[44px] flex items-center justify-center gap-2 mx-auto"
                    >
                        <span className="material-symbols-outlined text-xl" aria-hidden="true">refresh</span>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 pb-8">
            {/* Header */}
            <header className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    aria-label="Go back"
                    className="p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-lg"
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

            {/* Body Profile */}
            <div className="card space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">Body Profile</h3>

                <div>
                    <label className="block text-gray-400 text-sm mb-2">Gender</label>
                    <div className="grid grid-cols-2 gap-2">
                        {(['male', 'female'] as const).map((g) => (
                            <button
                                key={g}
                                onClick={() => setProfile({ ...profile, gender: g })}
                                className={`py-3 px-4 min-h-[44px] rounded-xl font-bold text-sm capitalize transition-all ${profile.gender === g
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
                    <label className="block text-gray-400 text-sm mb-2">Activity Level</label>
                    <div className="grid grid-cols-1 gap-2">
                        {([
                            { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
                            { value: 'lightly_active', label: 'Lightly Active', desc: 'Exercise 1-3 days/week' },
                            { value: 'moderately_active', label: 'Moderately Active', desc: 'Exercise 3-5 days/week' },
                            { value: 'very_active', label: 'Very Active', desc: 'Exercise 6-7 days/week' },
                            { value: 'extremely_active', label: 'Extremely Active', desc: 'Intense daily exercise' },
                        ] as const).map((level) => (
                            <button
                                key={level.value}
                                onClick={() => setProfile({ ...profile, activity_level: level.value })}
                                className={`py-3 px-4 min-h-[44px] rounded-xl text-left transition-all ${profile.activity_level === level.value
                                    ? 'bg-[var(--color-primary)] text-black'
                                    : 'bg-gray-800 text-gray-400 hover:text-white'
                                    }`}
                            >
                                <span className="font-bold text-sm">{level.label}</span>
                                <span className="text-xs ml-2 opacity-70">{level.desc}</span>
                            </button>
                        ))}
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
                                className={`py-3 px-4 min-h-[44px] rounded-xl font-bold text-sm transition-all ${profile.goal === g
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
                                className={`py-3 px-4 min-h-[44px] rounded-xl font-bold text-sm capitalize transition-all ${profile.training_experience === exp
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
                                className={`py-3 px-4 min-h-[44px] rounded-xl font-bold text-sm capitalize transition-all ${profile.equipment_access === eq
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
                    <div className="flex flex-wrap gap-2">
                        {[2, 3, 4, 5, 6].map((days) => (
                            <button
                                key={days}
                                onClick={() => setProfile({ ...profile, days_per_week: days })}
                                className={`flex-1 min-w-[44px] min-h-[44px] py-3 px-3 rounded-xl font-bold text-sm transition-all ${profile.days_per_week === days
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

            {/* Supplement Preferences */}
            <div className="card space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">Supplement Preferences</h3>
                <p className="text-gray-400 text-sm mb-4">
                    Choose how you want supplement recommendations to appear in the app.
                </p>

                {/* Mode Selection - RALPH LOOP 15: Added radio semantics, RALPH LOOP 27: Added focus ring */}
                <div className="space-y-2" role="radiogroup" aria-label="Supplement preference mode">
                    {SUPPLEMENT_MODE_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => {
                                setSupplementMode(option.id);
                                // Clear selections when switching away from "using"
                                if (option.id !== 'using') {
                                    setSelectedSupplements([]);
                                }
                            }}
                            role="radio"
                            aria-checked={supplementMode === option.id}
                            disabled={savingSupplements}
                            className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 ${
                                supplementMode === option.id
                                    ? 'bg-[var(--color-primary)] text-black'
                                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            <span className="text-2xl" aria-hidden="true">{option.emoji}</span>
                            <div>
                                <p className="font-bold text-sm">{option.label}</p>
                                <p className={`text-xs ${supplementMode === option.id ? 'text-black/70' : 'text-gray-500'}`}>
                                    {option.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Supplement Selection (only when mode is "using") */}
                {/* RALPH LOOP 15: Added checkbox semantics, RALPH LOOP 23: Disabled during save, RALPH LOOP 26: Tablet responsive grid */}
                {supplementMode === 'using' && (
                    <div className="pt-4 border-t border-gray-700">
                        <label id="supplement-selection-label" className="block text-gray-400 text-sm mb-3">Select your supplements:</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2" role="group" aria-labelledby="supplement-selection-label">
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
                                    role="checkbox"
                                    aria-checked={selectedSupplements.includes(supp.id)}
                                    aria-label={`${supp.name} - ${supp.dosage}, ${supp.timing}`}
                                    disabled={savingSupplements}
                                    className={`p-3 rounded-xl text-left transition-all flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 ${
                                        selectedSupplements.includes(supp.id)
                                            ? 'bg-[var(--color-primary)]/20 border-2 border-[var(--color-primary)] text-white'
                                            : 'bg-gray-800 border-2 border-transparent text-gray-400 hover:text-white'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                                        {selectedSupplements.includes(supp.id) ? 'check_circle' : supp.icon}
                                    </span>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm">{supp.name}</p>
                                        <p className="text-xs text-gray-500">{supp.dosage} • {supp.timing}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Save Supplements Button - RALPH LOOP 16: Triggers parent refetch */}
                <button
                    onClick={async () => {
                        if (!supplementMode) return;
                        setSavingSupplements(true);

                        const newPrefs: SupplementPreferences = {
                            enabled: supplementMode !== 'not_interested',
                            products: supplementMode === 'using' ? selectedSupplements : [],
                            openToRecommendations: supplementMode === 'open_to_recommendations'
                        };

                        try {
                            const { error } = await supabaseUpdate(`profiles?id=eq.${user?.id}`, {
                                supplement_preferences: newPrefs
                            });

                            if (error) {
                                showToast("Supplements didn't save. Try again.", 'error');
                            } else {
                                setProfile(prev => ({ ...prev, supplement_preferences: newPrefs }));
                                showToast('Supplements updated.', 'success');
                                // RALPH LOOP 16: Trigger parent refetch to sync MealTracker and other components
                                onProfileSaved?.({ supplement_preferences: newPrefs });
                            }
                        } catch {
                            showToast("Supplements didn't save. Try again.", 'error');
                        } finally {
                            setSavingSupplements(false);
                        }
                    }}
                    disabled={savingSupplements || !supplementMode}
                    className="w-full py-3 px-4 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                    {savingSupplements ? (
                        <>
                            <LoaderIcon className="w-5 h-5 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined text-lg" aria-hidden="true">save</span>
                            Save Supplement Preferences
                        </>
                    )}
                </button>
            </div>

            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" />
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

            {/* Become a Trainer */}
            {profile.role !== 'trainer' && (
                <div className="card space-y-4">
                    <h3 className="text-lg font-bold text-white">Trainer Account</h3>
                    <p className="text-gray-400 text-sm">
                        Are you a fitness trainer? Contact us to upgrade your account and gain access to client management features.
                    </p>
                    <button
                        onClick={handleBecomeTrainer}
                        className="w-full py-3 px-4 bg-gray-700 text-gray-300 font-bold rounded-xl hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Request Trainer Access
                    </button>
                </div>
            )}

            {/* Show trainer badge if already a trainer */}
            {profile.role === 'trainer' && (
                <div className="card bg-gradient-to-r from-purple-900/30 to-[var(--color-primary)]/10 border-purple-500/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-bold">Trainer Account</p>
                            <p className="text-gray-400 text-sm">Access trainer features via the icon in the header</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Toggle */}
            <div className="card flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">Notifications</h3>
                        <p className="text-[var(--text-secondary)] text-sm">Enable daily reminders</p>
                    </div>
                    <button
                        onClick={requestPermission}
                        aria-label={permission === 'granted' ? 'Notifications enabled' : 'Enable notifications'}
                        role="switch"
                        aria-checked={permission === 'granted'}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${permission === 'granted' ? 'bg-[var(--color-primary)]' : 'bg-gray-600'
                            }`}
                    >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${permission === 'granted' ? 'translate-x-6' : 'translate-x-0'
                            }`}></div>
                    </button>
                </div>

                {permission === 'granted' && (
                    <button
                        onClick={() => sendLocalNotification('Time to train!', { body: 'Ready to crush your workout?' })}
                        className="text-sm text-[var(--color-primary)] font-bold text-left hover:underline flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">notifications_active</span>
                        Send Test Notification
                    </button>
                )}
            </div>

            {/* FIX 3.1: Subscription Status */}
            <div className="card space-y-4">
                <h3 className="text-lg font-bold text-white">Subscription</h3>
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`font-medium ${
                        profile.subscription_status === 'active' ? 'text-green-400' :
                        profile.subscription_status === 'trial' ? 'text-blue-400' :
                        'text-red-400'
                    }`}>
                        {profile.subscription_status === 'active' ? 'Active' :
                         profile.subscription_status === 'trial' ? 'Free Trial' :
                         profile.subscription_status === 'expired' ? 'Expired' : 'None'}
                    </span>
                </div>
                {profile.subscription_status === 'trial' && profile.trial_started_at && (
                    <div className="flex items-center justify-between">
                        <span className="text-gray-400">Trial Days Remaining</span>
                        <span className="text-blue-400 font-medium">
                            {(() => {
                                const trialStart = new Date(profile.trial_started_at!).getTime();
                                const daysSinceStart = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
                                return Math.max(0, Math.ceil(7 - daysSinceStart));
                            })()}
                        </span>
                    </div>
                )}
                {/* C8 FIX: Add payment entry point for trial/expired users */}
                {profile.subscription_status === 'expired' && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-red-400">warning</span>
                            <div>
                                <p className="text-red-400 font-medium">Your trial has expired</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    Upgrade to continue using AI-powered workouts and meal tracking.
                                </p>
                            </div>
                        </div>
                        <a
                            href="https://sloefit.com/subscribe"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-3 px-4 bg-[var(--color-primary)] text-black font-bold rounded-xl text-center hover:opacity-90 transition-opacity"
                        >
                            Upgrade Now
                        </a>
                    </div>
                )}
                {profile.subscription_status === 'trial' && (
                    <div className="space-y-3">
                        <a
                            href="https://sloefit.com/subscribe"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-3 px-4 bg-gray-700 text-white font-bold rounded-xl text-center hover:bg-gray-600 transition-colors"
                        >
                            Upgrade for Full Access
                        </a>
                        <p className="text-xs text-gray-500 text-center">
                            Questions? Contact support@sloefit.com
                        </p>
                    </div>
                )}
            </div>

            {/* GDPR: Data & Privacy */}
            <div className="card space-y-4">
                <h3 className="text-lg font-bold text-white">Data & Privacy</h3>
                <p className="text-gray-400 text-sm">
                    Manage your personal data in compliance with GDPR regulations.
                </p>

                {/* Export Data */}
                <button
                    onClick={handleExportData}
                    disabled={exporting}
                    className="w-full py-3 px-4 bg-gray-700 text-gray-300 font-bold rounded-xl hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {exporting ? (
                        <>
                            <LoaderIcon className="w-5 h-5 animate-spin" />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download My Data
                        </>
                    )}
                </button>

                {/* Delete Account */}
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full py-3 px-4 bg-red-500/10 text-red-400 font-bold rounded-xl hover:bg-red-500/20 border border-red-500/30 transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Account
                </button>
            </div>

            {/* Delete Account Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-white">Delete Account</h4>
                                <p className="text-sm text-gray-400">This cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-300 text-sm">
                            This will permanently delete your account and all associated data including workouts, meals, progress photos, and measurements.
                        </p>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2">
                                Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition-colors font-mono"
                                placeholder="DELETE"
                                autoComplete="off"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirmText('');
                                }}
                                className="flex-1 py-3 px-4 bg-gray-700 text-gray-300 font-bold rounded-xl hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleteConfirmText !== 'DELETE' || deleting}
                                className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {deleting ? (
                                    <>
                                        <LoaderIcon className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Forever'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sign Out */}
            <button
                onClick={handleSignOut}
                aria-label="Sign out of account"
                className="w-full py-4 text-red-500 hover:text-red-400 font-bold transition-colors focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
            >
                Sign Out
            </button>

            {/* App Info & Legal Links */}
            <div className="text-center text-gray-500 text-sm pt-4 space-y-3">
                <p>SLOE FIT AI v1.0</p>
                <div className="flex justify-center gap-4">
                    {onPrivacy && (
                        <button
                            onClick={onPrivacy}
                            className="text-gray-400 hover:text-white underline underline-offset-2 transition-colors"
                        >
                            Privacy Policy
                        </button>
                    )}
                    {onTerms && (
                        <button
                            onClick={onTerms}
                            className="text-gray-400 hover:text-white underline underline-offset-2 transition-colors"
                        >
                            Terms of Service
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(Settings);
