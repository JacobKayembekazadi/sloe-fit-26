import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { supabaseGetSingle, supabaseInsert } from '../services/supabaseRawFetch';
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
        // Check if profile exists using raw fetch
        const { data: existingProfile, error: fetchError } = await supabaseGetSingle<{ id: string }>(
            `profiles?id=eq.${user.id}&select=id`
        );

        // If profile doesn't exist, create it
        if (fetchError?.code === 'PGRST116' || !existingProfile) {
            // Determine role based on signup metadata
            const isTrainer = user.user_metadata?.is_trainer === true;
            const role = isTrainer ? 'trainer' : 'consumer';

            await supabaseInsert('profiles', {
                id: user.id,
                full_name: user.user_metadata?.full_name || '',
                role: role,
                goal: null,
                onboarding_complete: false,
                created_at: new Date().toISOString()
            });
        }
    } catch {
        // Profile creation failed - will be retried on next auth event
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Timeout safeguard - never stay loading forever
        const timeout = setTimeout(() => {
            setLoading(false);
        }, 10000);

        // Helper to clear invalid auth state
        const clearInvalidSession = () => {
            // Clear any stored tokens that might be invalid
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            try {
                const projectId = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
                if (projectId) {
                    localStorage.removeItem(`sb-${projectId}-auth-token`);
                }
            } catch {
                // Ignore localStorage errors
            }
            setSession(null);
            setUser(null);
            setLoading(false);
        };

        // Check active sessions and sets the user
        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
            // Handle invalid refresh token error
            if (error) {
                if (error.message?.includes('Invalid Refresh Token') ||
                    error.message?.includes('Refresh Token Not Found')) {
                    clearInvalidSession();
                    return;
                }
            }

            setSession(session);
            setUser(session?.user ?? null);

            // Ensure profile exists for authenticated users
            if (session?.user) {
                await ensureProfileExists(session.user);
            }

            setLoading(false);
        }).catch((error) => {
            // Handle any auth errors by clearing invalid state
            if (error?.message?.includes('Invalid Refresh Token') ||
                error?.message?.includes('Refresh Token Not Found')) {
                clearInvalidSession();
            } else {
                setLoading(false);
            }
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            // Handle token refresh failures
            if (event === 'TOKEN_REFRESHED' && !session) {
                clearInvalidSession();
                return;
            }

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
