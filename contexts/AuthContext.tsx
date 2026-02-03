import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

// Ensure profile exists for user (creates if missing)
const ensureProfileExists = async (user: User) => {
    try {
        // Check if profile exists
        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        // If profile doesn't exist (PGRST116 = no rows returned), create it
        if (fetchError?.code === 'PGRST116' || !existingProfile) {
            // Determine role based on signup metadata
            const isTrainer = user.user_metadata?.is_trainer === true;
            const role = isTrainer ? 'trainer' : 'consumer';

            const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    full_name: user.user_metadata?.full_name || '',
                    role: role,
                    goal: null,
                    onboarding_complete: false,
                    created_at: new Date().toISOString()
                });

            if (insertError && insertError.code !== '23505') { // Ignore duplicate key errors
                console.error('Error creating profile:', insertError);
            }
        }
    } catch (err) {
        console.error('Error ensuring profile exists:', err);
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('[AuthContext] useEffect starting, checking session...');

        // Timeout safeguard - never stay loading forever
        const timeout = setTimeout(() => {
            console.log('[AuthContext] Timeout hit, forcing loading=false');
            setLoading(false);
        }, 10000);

        // Check active sessions and sets the user
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            console.log('[AuthContext] getSession result:', session?.user?.id || 'no user');
            setSession(session);
            setUser(session?.user ?? null);

            // Ensure profile exists for authenticated users
            if (session?.user) {
                console.log('[AuthContext] User found, ensuring profile exists...');
                await ensureProfileExists(session.user);
                console.log('[AuthContext] Profile check done');
            }

            console.log('[AuthContext] Setting loading=false');
            setLoading(false);
        }).catch((err) => {
            console.error('[AuthContext] Auth session error:', err);
            setLoading(false);
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            // Create profile on signup or ensure it exists on login
            if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
                await ensureProfileExists(session.user);
            }

            setLoading(false);
        });

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
