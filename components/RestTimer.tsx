import React, { useEffect, useState, useRef } from 'react';

interface RestTimerProps {
    initialTime: number; // seconds
    onComplete: () => void;
    onSkip: (timeRemaining: number) => void;
    exerciseName?: string;
    lastSetWeight?: string;
    lastSetReps?: string;
    completedSets?: number;
    totalSets?: number;
    sessionVolume?: number;
}

const RestTimer: React.FC<RestTimerProps> = ({
    initialTime,
    onComplete,
    onSkip,
    exerciseName,
    lastSetWeight,
    lastSetReps,
    completedSets,
    totalSets,
    sessionVolume
}) => {
    const [timeLeft, setTimeLeft] = useState(initialTime);
    const [totalTime, setTotalTime] = useState(initialTime);
    const [isComplete, setIsComplete] = useState(false);
    const onCompleteRef = useRef(onComplete);

    // Keep onComplete ref up to date
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    // Timer countdown effect — uses Date.now() delta so backgrounding doesn't freeze it
    const endTimeRef = useRef(Date.now() + initialTime * 1000);

    useEffect(() => {
        endTimeRef.current = Date.now() + initialTime * 1000;
    }, [initialTime]);

    useEffect(() => {
        const tick = () => {
            const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                setIsComplete(true);
            }
        };

        const interval = setInterval(tick, 1000);

        // Recover accurate time when tab regains focus
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    // Handle completion in a separate effect
    useEffect(() => {
        if (isComplete) {
            onCompleteRef.current();
        }
    }, [isComplete]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAdd = (seconds: number) => {
        endTimeRef.current += seconds * 1000;
        setTimeLeft(prev => prev + seconds);
        setTotalTime(prev => prev + seconds);
    };

    const handleSubtract = (seconds: number) => {
        endTimeRef.current -= seconds * 1000;
        setTimeLeft(prev => Math.max(0, prev - seconds));
        // Don't shrink totalTime — this makes the ring drain faster (intuitive)
    };

    const progress = totalTime > 0 ? Math.min(1, timeLeft / totalTime) : 0;

    // Mini SVG circle progress
    const circleRadius = 16;
    const circumference = 2 * Math.PI * circleRadius;
    const strokeDashoffset = circumference * (1 - progress);

    const formattedVolume = sessionVolume != null
        ? sessionVolume.toLocaleString()
        : null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col font-display text-white overflow-hidden">

            {/* Layer 0: Background Image + Dark Overlay */}
            <div className="absolute inset-0">
                <img
                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=60"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: 'grayscale(100%) contrast(1.2)', opacity: 0.15 }}
                />
                <div className="absolute inset-0 bg-[#050505]/85" />
            </div>

            {/* Layer 1: Perimeter Progress */}
            <div
                className="perimeter-progress"
                style={{ '--progress': progress } as React.CSSProperties}
            />

            {/* Layer 2: Stencil Typography (centered, behind content) */}
            {(lastSetWeight || lastSetReps) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    {lastSetWeight && (
                        <>
                            <span className="stencil-text-primary text-[8rem] sm:text-[12rem] leading-none tracking-tighter">
                                {lastSetWeight}
                            </span>
                            <span className="stencil-text text-2xl sm:text-3xl uppercase tracking-[0.3em] -mt-2">
                                lbs
                            </span>
                        </>
                    )}
                    {lastSetReps && (
                        <>
                            <span className="stencil-text-primary text-[6rem] sm:text-[9rem] leading-none tracking-tighter mt-2">
                                {lastSetReps}
                            </span>
                            <span className="stencil-text text-2xl sm:text-3xl uppercase tracking-[0.3em] -mt-2">
                                reps
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Layer 3: Top Bar */}
            <div className="relative z-10 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] shrink-0">
                <span className="text-sm font-bold text-white/80 truncate max-w-[60%]">
                    {exerciseName || 'Rest Period'}
                </span>
                <button
                    onClick={() => onSkip(timeLeft)}
                    className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Close rest timer"
                >
                    <span className="material-symbols-outlined text-xl text-white/60">close</span>
                </button>
            </div>

            {/* Spacer to push bottom content down */}
            <div className="flex-1" />

            {/* Layer 4: Bottom Section */}
            <div className="relative z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">

                {/* Rest Timer Pill */}
                <div className="flex items-center justify-between glass-panel px-4 py-3 mb-4">
                    <div className="flex items-center gap-3">
                        {/* Mini circular progress */}
                        <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0 -rotate-90">
                            <circle
                                cx="20" cy="20" r={circleRadius}
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="3"
                            />
                            <circle
                                cx="20" cy="20" r={circleRadius}
                                fill="none"
                                stroke="var(--color-primary)"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                        <button
                            onClick={() => handleSubtract(15)}
                            className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 active:scale-90 transition-all text-lg font-bold"
                            aria-label="Subtract 15 seconds"
                        >
                            −
                        </button>
                        <span className="text-2xl font-black tabular-nums tracking-tight">
                            {formatTime(timeLeft)}
                        </span>
                        <button
                            onClick={() => handleAdd(15)}
                            className="size-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 active:scale-90 transition-all text-lg font-bold"
                            aria-label="Add 15 seconds"
                        >
                            +
                        </button>
                    </div>
                    <button
                        onClick={() => onSkip(timeLeft)}
                        className="text-sm font-bold text-[var(--color-primary)] px-4 py-2 rounded-lg hover:bg-[var(--color-primary)]/10 transition-colors"
                    >
                        Skip
                    </button>
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between px-1 mb-4">
                    {formattedVolume != null && (
                        <span className="text-xs text-slate-400">
                            Session Volume: <span className="text-white font-bold">{formattedVolume} lbs</span>
                        </span>
                    )}
                    {completedSets != null && totalSets != null && (
                        <span className="text-xs text-slate-400">
                            Set <span className="text-white font-bold">{completedSets}</span> / {totalSets}
                        </span>
                    )}
                </div>

                {/* Tap to Continue */}
                <button
                    onClick={() => onSkip(timeLeft)}
                    className="w-full py-4 rounded-xl border border-white/10 text-sm text-slate-400 font-medium hover:bg-white/5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    Tap to continue
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
            </div>
        </div>
    );
};

export default RestTimer;
