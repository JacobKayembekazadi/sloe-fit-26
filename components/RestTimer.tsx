import React, { useEffect, useState, useRef } from 'react';

interface RestTimerProps {
    initialTime: number; // seconds
    onComplete: () => void;
    onSkip: () => void;
    onAdd: (seconds: number) => void;
    onSubtract: (seconds: number) => void;
}

const RestTimer: React.FC<RestTimerProps> = ({
    initialTime,
    onComplete,
    onSkip,
    onAdd,
    onSubtract
}) => {
    const [timeLeft, setTimeLeft] = useState(initialTime);
    const totalTimeRef = useRef(initialTime);

    // Update local state when prop changes, but only if it's a manual adjustment
    useEffect(() => {
        setTimeLeft(initialTime);
    }, [initialTime]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [onComplete]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return { mins, secs };
    };

    const { mins, secs } = formatTime(timeLeft);
    const progress = Math.min(100, Math.max(0, ((totalTimeRef.current - timeLeft) / totalTimeRef.current) * 100));

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background-dark font-display text-white transition-colors duration-300">
            {/* Top Bar */}
            <div className="flex items-center p-4 pb-2 justify-between shrink-0">
                <button onClick={onSkip} className="flex size-12 shrink-0 items-center justify-center cursor-pointer rounded-full hover:bg-white/10 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                </button>
                <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Resting...</h2>
                <div className="size-12"></div>
            </div>

            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 overflow-y-auto">
                {/* Circular Timer */}
                <div className="relative flex justify-center items-center py-6 sm:py-8">
                    <div className="relative flex items-center justify-center size-48 sm:size-64 rounded-full border-4 border-slate-800">
                        {/* Progress Ring Implementation would go here - simplified for now with border */}
                        <div className="absolute inset-0 rounded-full border-4 border-[var(--color-primary)] border-t-transparent -rotate-45" style={{ transform: `rotate(${progress * 3.6}deg)` }}></div>

                        <div className="text-center">
                            <div className="flex gap-1 sm:gap-2 items-center justify-center">
                                <div className="flex flex-col items-center">
                                    <span className="text-4xl sm:text-6xl font-black tracking-tighter">{mins.toString().padStart(2, '0')}</span>
                                    <span className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-widest mt-1">Min</span>
                                </div>
                                <span className="text-slate-400 text-3xl sm:text-5xl font-light mb-3 sm:mb-4">:</span>
                                <div className="flex flex-col items-center">
                                    <span className="text-4xl sm:text-6xl font-black tracking-tighter">{secs.toString().padStart(2, '0')}</span>
                                    <span className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-widest mt-1">Sec</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Adjusters */}
                    <div className="absolute bottom-2 sm:bottom-4 flex gap-6 sm:gap-8">
                        <button onClick={() => onSubtract(10)} className="flex items-center justify-center size-9 sm:size-10 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-xl">remove</span>
                        </button>
                        <button onClick={() => onAdd(10)} className="flex items-center justify-center size-9 sm:size-10 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors">
                            <span className="material-symbols-outlined text-xl">add</span>
                        </button>
                    </div>
                </div>

                {/* Next Set Preview (Placeholder) */}
                <div className="mt-6 sm:mt-8">
                    <h3 className="text-xs sm:text-sm font-bold leading-tight tracking-wider uppercase px-1 pb-3 sm:pb-4">Up Next</h3>
                    <div className="flex items-center gap-3 sm:gap-4 bg-[#182634] p-3 sm:p-4 rounded-xl shadow-sm border border-white/5">
                        <div className="size-10 sm:size-12 bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-slate-400 text-xl">fitness_center</span>
                        </div>
                        <div>
                            <p className="font-bold text-sm sm:text-base">Next Set</p>
                            <p className="text-xs sm:text-sm text-slate-400">Get Ready!</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Button */}
            <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background-dark border-t border-slate-800 shrink-0">
                <button
                    onClick={onSkip}
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-black font-bold py-3 sm:py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-all text-sm sm:text-base"
                >
                    <span>Skip Rest & Start Set</span>
                    <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
            </div>
        </div>
    );
};

export default RestTimer;
