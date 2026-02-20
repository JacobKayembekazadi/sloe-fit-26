import React, { useEffect, useRef, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { reportError } from '../utils/sentryHelpers';

interface UpdatePromptProps {
    /** When true, hides the update banner AND pauses SW checks (e.g. during active workouts) */
    suppressBanner?: boolean;
}

const UpdatePrompt: React.FC<UpdatePromptProps> = ({ suppressBanner = false }) => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const updateInProgressRef = useRef(false);
    const bcRef = useRef<BroadcastChannel | null>(null);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            // Check for updates every 5 minutes — store ref for cleanup
            if (r) {
                intervalRef.current = setInterval(async () => {
                    // M1 FIX: Skip update checks during active workouts to prevent
                    // interruption from SW reload mid-exercise
                    if (suppressBannerRef.current) {
                        return;
                    }

                    // Prevent concurrent update attempts (causes InvalidStateError)
                    if (updateInProgressRef.current) {
                        return;
                    }

                    try {
                        updateInProgressRef.current = true;
                        await r.update();
                    } catch (error) {
                        // InvalidStateError: SW is in an invalid state (corrupt or already updating)
                        // This can happen on Chrome Mobile when the SW registration is corrupted
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        if (errorMessage.includes('InvalidStateError')) {
                            console.warn('[SW] InvalidStateError during update check, attempting recovery...');

                            // Try to unregister and let the next page load re-register
                            try {
                                const registrations = await navigator.serviceWorker.getRegistrations();
                                for (const registration of registrations) {
                                    if (registration.scope === window.location.origin + '/') {
                                        await registration.unregister();
                                        console.log('[SW] Unregistered corrupt service worker');
                                    }
                                }
                            } catch (unregisterError) {
                                // Can't recover — report and continue
                                reportError(unregisterError, {
                                    category: 'pwa',
                                    operation: 'sw_unregister_recovery',
                                    severity: 'warning',
                                });
                            }
                        } else {
                            // Report other SW update errors
                            reportError(error, {
                                category: 'pwa',
                                operation: 'sw_update_check',
                                severity: 'warning',
                            });
                        }
                    } finally {
                        updateInProgressRef.current = false;
                    }
                }, 5 * 60 * 1000); // Check every 5 minutes
            }
        },
        onRegisterError(error) {
            console.error('SW registration error:', error);

            // Report to Sentry with context
            reportError(error, {
                category: 'pwa',
                operation: 'sw_registration',
                severity: 'error',
                context: {
                    userAgent: navigator.userAgent,
                    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
                },
            });

            // If registration fails with InvalidStateError, try to clean up
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('InvalidStateError')) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => {
                        registration.unregister().catch(() => {
                            // Best effort cleanup
                        });
                    });
                }).catch(() => {
                    // Can't access SW — likely browser issue
                });
            }
        },
    });

    // Keep ref in sync with prop so interval callback reads latest value
    const suppressBannerRef = useRef(suppressBanner);
    useEffect(() => { suppressBannerRef.current = suppressBanner; }, [suppressBanner]);

    // H3 FIX: BroadcastChannel to coordinate updates across tabs
    // Only one tab should apply the SW update to avoid race conditions
    useEffect(() => {
        try {
            const bc = new BroadcastChannel('sloefit-sw-update');
            bcRef.current = bc;
            bc.onmessage = (event) => {
                if (event.data?.type === 'sw-updating') {
                    // Another tab is applying the update — dismiss our banner
                    setNeedRefresh(false);
                }
            };
            return () => { bc.close(); bcRef.current = null; };
        } catch {
            // BroadcastChannel not supported (older browsers) — no coordination needed
            return;
        }
    }, [setNeedRefresh]);

    // Expose a global function for Settings "Check for Updates" button
    const manualCheckForUpdate = useCallback(async (): Promise<boolean> => {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.update();
            }
            // Return whether there's a waiting update
            return needRefresh;
        } catch {
            return false;
        }
    }, [needRefresh]);

    // Store the check function globally so Settings can call it
    useEffect(() => {
        (window as any).__sloefit_checkForUpdate = manualCheckForUpdate;
        (window as any).__sloefit_applyUpdate = () => {
            bcRef.current?.postMessage({ type: 'sw-updating' });
            updateServiceWorker(true);
        };
        return () => {
            delete (window as any).__sloefit_checkForUpdate;
            delete (window as any).__sloefit_applyUpdate;
        };
    }, [manualCheckForUpdate, updateServiceWorker]);

    // Cleanup interval on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Don't show banner during active workouts or when suppressed
    if (!needRefresh || suppressBanner) return null;

    return (
        <div className="fixed top-4 left-4 right-4 z-50 animate-slide-up">
            <div className="bg-[var(--bg-card)] border border-[var(--color-primary)]/30 rounded-2xl p-4 shadow-2xl backdrop-blur-lg">
                <div className="flex items-center gap-3">
                    <div className="bg-[var(--color-primary)] text-black p-2 rounded-lg">
                        <span className="material-symbols-outlined">system_update</span>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-white">Update Available</h4>
                        <p className="text-gray-400 text-sm">New version ready to install</p>
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={() => setNeedRefresh(false)}
                        className="flex-1 py-3 px-4 min-h-[44px] text-gray-400 font-semibold rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                    >
                        Later
                    </button>
                    <button
                        onClick={() => {
                            // H3 FIX: Notify other tabs before applying update
                            bcRef.current?.postMessage({ type: 'sw-updating' });
                            updateServiceWorker(true);
                        }}
                        className="flex-1 py-3 px-4 min-h-[44px] bg-[var(--color-primary)] text-black font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[var(--color-primary)]/20"
                    >
                        Update Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdatePrompt;
