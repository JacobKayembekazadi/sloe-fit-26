import React, { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { reportError } from '../utils/sentryHelpers';

const UpdatePrompt: React.FC = () => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const updateInProgressRef = useRef(false);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            // Check for updates every hour — store ref for cleanup
            if (r) {
                intervalRef.current = setInterval(async () => {
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
                }, 60 * 60 * 1000);
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

    // Cleanup interval on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    if (!needRefresh) return null;

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
                        onClick={() => updateServiceWorker(true)}
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
