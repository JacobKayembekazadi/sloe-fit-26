import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const AddToHomeScreenButton: React.FC = () => {
    const [showInstructions, setShowInstructions] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        // Check if iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(iOS);

        // Check if already installed (standalone mode)
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        setIsStandalone(standalone);

        // Listen for the beforeinstallprompt event (Chrome, Edge, etc.)
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // Chrome/Android - trigger native install prompt
            setIsInstalling(true);
            try {
                await deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                if (choice.outcome === 'accepted') {
                    setShowInstructions(false);
                    setDeferredPrompt(null);
                }
            } finally {
                setIsInstalling(false);
            }
        } else {
            // No native prompt available - show instructions
            setShowInstructions(true);
        }
    };

    // Don't show if already installed
    if (isStandalone) return null;

    return (
        <>
            <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="card flex items-center justify-between p-4 w-full text-left hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-50"
            >
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[var(--color-primary)]">
                        install_mobile
                    </span>
                    <div>
                        <span className="font-bold text-white block">
                            {isInstalling ? 'Installing...' : 'Add to Home Screen'}
                        </span>
                        <p className="text-xs text-gray-400">
                            {deferredPrompt ? 'Install the app now' : 'Get the full app experience'}
                        </p>
                    </div>
                </div>
                <span className="text-gray-400">{deferredPrompt ? '↓' : '→'}</span>
            </button>

            {showInstructions && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowInstructions(false);
                    }}
                >
                    <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl p-6 max-w-sm w-full animate-slide-up">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-[var(--color-primary)]/30">
                                <span className="text-2xl">💪</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Install Sloe Fit</h3>
                                <p className="text-gray-400 text-sm">Add to your home screen</p>
                            </div>
                        </div>

                        {isIOS ? (
                            <ol className="text-gray-300 space-y-4 mb-6">
                                <li className="flex items-start gap-3">
                                    <span className="bg-[var(--color-primary)] text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                                    <span>Tap the <strong className="text-white">Share</strong> button in Safari's toolbar (the square with arrow)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="bg-[var(--color-primary)] text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                                    <span>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="bg-[var(--color-primary)] text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                                    <span>Tap <strong className="text-white">"Add"</strong> in the top right corner</span>
                                </li>
                            </ol>
                        ) : (
                            <ol className="text-gray-300 space-y-4 mb-6">
                                <li className="flex items-start gap-3">
                                    <span className="bg-[var(--color-primary)] text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                                    <span>Tap the <strong className="text-white">menu icon</strong> (three dots) in Chrome's top right corner</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="bg-[var(--color-primary)] text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                                    <span>Tap <strong className="text-white">"Add to Home screen"</strong> or <strong className="text-white">"Install app"</strong></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="bg-[var(--color-primary)] text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                                    <span>Tap <strong className="text-white">"Add"</strong> or <strong className="text-white">"Install"</strong> to confirm</span>
                                </li>
                            </ol>
                        )}

                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full py-3 min-h-[44px] bg-[var(--color-primary)] text-black font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AddToHomeScreenButton;
