import React, { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt: React.FC = () => {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            // Check for updates every hour — store ref for cleanup
            if (r) {
                intervalRef.current = setInterval(() => {
                    r.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('SW registration error:', error);
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
