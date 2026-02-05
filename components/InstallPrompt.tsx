import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already installed (standalone mode)
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        setIsStandalone(standalone);

        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(iOS);

        // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            // Check if user dismissed before (don't show again for 7 days)
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            if (dismissed) {
                const dismissedTime = parseInt(dismissed, 10);
                const sevenDays = 7 * 24 * 60 * 60 * 1000;
                if (Date.now() - dismissedTime < sevenDays) {
                    return;
                }
            }

            // Show after a short delay for better UX
            setTimeout(() => setShowPrompt(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // For iOS, show custom prompt after delay if not already installed
        if (iOS && !standalone) {
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            if (!dismissed || Date.now() - parseInt(dismissed, 10) > 7 * 24 * 60 * 60 * 1000) {
                setTimeout(() => setShowPrompt(true), 3000);
            }
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                setShowPrompt(false);
            }
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    };

    // Don't show if already installed
    if (isStandalone || !showPrompt) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-slide-up">
            <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-lg">
                <div className="flex items-start gap-4">
                    {/* App Icon */}
                    <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center flex-shrink-0 border border-[var(--color-primary)]/30">
                        <span className="text-3xl">💪</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white text-lg">Install Sloe Fit</h3>
                        <p className="text-gray-400 text-sm mt-0.5">
                            {isIOS
                                ? 'Tap the share button, then "Add to Home Screen"'
                                : 'Get the full app experience on your device'}
                        </p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={handleDismiss}
                        className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10"
                        aria-label="Dismiss"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={handleDismiss}
                        className="flex-1 py-3 px-4 min-h-[44px] text-gray-400 font-semibold rounded-xl border border-white/10 hover:bg-white/5 transition-all"
                    >
                        Not Now
                    </button>
                    {!isIOS && (
                        <button
                            onClick={handleInstall}
                            className="flex-1 py-3 px-4 min-h-[44px] bg-[var(--color-primary)] text-black font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[var(--color-primary)]/20"
                        >
                            Install App
                        </button>
                    )}
                    {isIOS && (
                        <button
                            onClick={handleDismiss}
                            className="flex-1 py-3 px-4 min-h-[44px] bg-[var(--color-primary)] text-black font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Got it
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
