import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { supabaseGetSingle, supabaseInsert } from '../services/supabaseRawFetch';
import type { User, Session } from '@supabase/supabase-js';
import { reportError, reportWarning, setUserContext, clearUserContext } from '../utils/sentryHelpers';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    sessionExpired: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    sessionExpired: false,
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
    } catch (err) {
        // Profile creation failed - will be retried on next auth event
        reportWarning('Profile creation failed, will retry on next auth', {
            category: 'auth',
            operation: 'ensureProfileExists',
            userId: user.id,
            consoleLog: false,
        });
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionExpired, setSessionExpired] = useState(false);

    // FIX 17: Guard against concurrent/looping refreshSession calls from 401 events
    const isRefreshingRef = useRef(false);
    const lastRefreshAttemptRef = useRef(0);
    const REFRESH_COOLDOWN_MS = 5000; // Ignore 401 events within 5s of last refresh attempt

    useEffect(() => {
        // Timeout safeguard - never stay loading forever
        const timeout = setTimeout(() => {
            setLoading(false);
        }, 10000);

        // Helper to clear invalid auth state — shows toast instead of silently ejecting
        const clearInvalidSession = () => {
            // Auto-save any workout draft before clearing session
            // (draft is already in localStorage via WorkoutSession autosave)
            // Clear any stored tokens that might be invalid
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            try {
                const projectId = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
                if (projectId) {
                    localStorage.removeItem(`sb-${projectId}-auth-token`);
                }
            } catch (err) {
                reportWarning('Failed to clear auth token from localStorage', {
                    category: 'auth',
                    operation: 'clearInvalidSession',
                    consoleLog: false,
                });
            }
            setSessionExpired(true);
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

            // FIX 4.2 + FIX 21: Handle PASSWORD_RECOVERY — user clicked a password reset link
            if (event === 'PASSWORD_RECOVERY') {
                setSession(session);
                setUser(session?.user ?? null);
                // FIX 21: Ensure profile exists (user may have reset password before completing onboarding)
                if (session?.user) {
                    await ensureProfileExists(session.user);
                }
                setLoading(false);
                return;
            }

            setSession(session);
            setUser(session?.user ?? null);

            // FIX 4.4: Reset sessionExpired on successful re-login
            if (event === 'SIGNED_IN' && session?.user) {
                setSessionExpired(false);
                // Set Sentry user context for error tracking
                setUserContext(session.user.id, session.user.email);
            }

            // Create profile on signup or ensure it exists on login
            if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
                await ensureProfileExists(session.user);
            }

            setLoading(false);
        });

        // FIX 4.5 + FIX 17: Listen for 401 errors with dedup/cooldown to prevent infinite loops
        // Without guards: 401 → event → refreshSession → 401 → event → infinite loop
        const handleAuthError = async () => {
            // Guard 1: Skip if already refreshing (prevents concurrent calls from parallel 401s)
            if (isRefreshingRef.current) return;
            // Guard 2: Cooldown — skip if we attempted refresh recently
            const now = Date.now();
            if (now - lastRefreshAttemptRef.current < REFRESH_COOLDOWN_MS) return;

            isRefreshingRef.current = true;
            lastRefreshAttemptRef.current = now;
            try {
                const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
                if (error || !refreshedSession) {
                    clearInvalidSession();
                }
                // If refresh succeeded, Supabase will fire TOKEN_REFRESHED event
            } catch (err) {
                reportError(err, {
                    category: 'auth',
                    operation: 'refreshSession',
                    severity: 'warning',
                });
                clearInvalidSession();
            } finally {
                isRefreshingRef.current = false;
            }
        };
        window.addEventListener('supabase-auth-error', handleAuthError);

        // FIX: Always refresh token when tab becomes visible after being hidden.
        // Browser throttles inactive tabs, so autoRefresh may not run while away.
        // Previous approach (only refresh if <5 min remaining) missed tokens that
        // went stale during 30-60 min of backgrounding.
        const handleVisibilityChange = async () => {
            if (document.visibilityState !== 'visible') return;
            if (isRefreshingRef.current) return;
            const now = Date.now();
            if (now - lastRefreshAttemptRef.current < REFRESH_COOLDOWN_MS) return;

            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                if (!currentSession) return;

                // Always refresh on tab return — browser may have suspended autoRefresh
                isRefreshingRef.current = true;
                lastRefreshAttemptRef.current = now;
                try {
                    await supabase.auth.refreshSession();
                } finally {
                    isRefreshingRef.current = false;
                }
            } catch {
                // Best-effort — ignore errors
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
            window.removeEventListener('supabase-auth-error', handleAuthError);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const signOut = useCallback(async () => {
        // Clear sloefit_ prefixed localStorage entries to prevent data leaking between users
        // PRESERVE offline_meal_queue — user's pending data should survive logout
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sloefit_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (err) {
            reportWarning('localStorage unavailable during signOut', {
                category: 'auth',
                operation: 'signOut',
                consoleLog: false,
            });
        }
        setSessionExpired(false);
        clearUserContext();
        await supabase.auth.signOut();
    }, []);

    return (
        <AuthContext.Provider value={{ user, session, loading, sessionExpired, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
