import React, { useEffect, useState } from 'react';

interface ActiveWorkoutTimerProps {
    startTime: number;
    onPause: () => void;
    onFinishSet: () => void;
    currentExerciseName: string;
    currentSet: number;
    totalSets: number;
    weight: string;
    reps: string;
}

const ActiveWorkoutTimer: React.FC<ActiveWorkoutTimerProps> = ({
    startTime,
    onPause,
    onFinishSet,
    currentExerciseName,
    currentSet,
    totalSets,
    weight,
    reps
}) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return { mins, secs };
    };

    const { mins, secs } = formatTime(elapsed);

    // Calculate generic progress for visual ring (just spinning or based on average set time?)
    // For now, let's make it a simple visual indicator

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Hero Circular Timer Section */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-[30vh] sm:min-h-[40vh]">
                <div className="relative flex items-center justify-center w-48 h-48 sm:w-64 sm:h-64">
                    <svg className="absolute w-full h-full -rotate-90">
                        <circle className="text-[#223649]" cx="50%" cy="50%" fill="transparent" r="45%" stroke="currentColor" strokeWidth="8"></circle>
                        <circle className="text-[var(--color-primary)] timer-ring animate-[spin_10s_linear_infinite]" cx="50%" cy="50%" fill="transparent" r="45%" stroke="currentColor" strokeLinecap="round" strokeWidth="8" strokeDasharray="283" strokeDashoffset="70"></circle>
                    </svg>
                    <div className="flex flex-col items-center">
                        <div className="flex gap-1 items-baseline">
                            <span className="text-white text-4xl sm:text-6xl font-black tracking-tighter">{mins}</span>
                            <span className="text-white/50 text-2xl sm:text-3xl font-light">:</span>
                            <span className="text-white text-4xl sm:text-6xl font-black tracking-tighter">{secs}</span>
                        </div>
                        <p className="text-white/60 text-xs sm:text-sm font-medium mt-1 uppercase tracking-[0.2em]">Elapsed</p>
                    </div>
                </div>

                {/* AI Coaching Snippet */}
                <div className="mt-4 sm:mt-8 px-4 sm:px-6 py-2 sm:py-3 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl flex items-center gap-2 sm:gap-3 max-w-[95%] sm:max-w-[90%]">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-sm shrink-0">psychology</span>
                    <p className="text-[var(--color-primary)]/90 text-[11px] sm:text-xs font-medium italic">"Focus on the slow eccentric phase, keep your core braced."</p>
                </div>
            </div>

            {/* Headline & Exercise Details */}
            <div className="bg-black/40 backdrop-blur-md rounded-t-[2rem] sm:rounded-t-[2.5rem] pt-6 sm:pt-8 pb-8 sm:pb-10 px-4 sm:px-6 border-t border-white/5 flex-1 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="flex flex-col items-center mb-6 sm:mb-8">
                    <h1 className="text-white tracking-tight text-xl sm:text-3xl font-bold leading-tight text-center mb-1 px-2">{currentExerciseName}</h1>
                    <p className="text-white/60 text-sm sm:text-base font-normal leading-normal text-center">Target: {totalSets} sets of {reps}</p>

                    <div className="flex gap-2 sm:gap-4 mt-4 sm:mt-6">
                        <div className="bg-[#223649] px-3 sm:px-4 py-2 rounded-lg text-center min-w-[70px] sm:min-w-[80px]">
                            <p className="text-white/50 text-[10px] uppercase font-bold">Set</p>
                            <p className="text-white text-lg sm:text-xl font-bold">{currentSet}/{totalSets}</p>
                        </div>
                        <div className="bg-[#223649] px-3 sm:px-4 py-2 rounded-lg text-center min-w-[70px] sm:min-w-[80px]">
                            <p className="text-white/50 text-[10px] uppercase font-bold">Weight</p>
                            <p className="text-white text-lg sm:text-xl font-bold">{weight}<span className="text-xs ml-0.5">lb</span></p>
                        </div>
                        <div className="bg-[#223649] px-3 sm:px-4 py-2 rounded-lg text-center min-w-[70px] sm:min-w-[80px]">
                            <p className="text-white/50 text-[10px] uppercase font-bold">Reps</p>
                            <p className="text-white text-lg sm:text-xl font-bold">{reps.split('-')[0]}</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 sm:gap-4 w-full">
                    <button
                        onClick={onPause}
                        className="flex-1 flex items-center justify-center gap-1 sm:gap-2 h-12 sm:h-14 rounded-xl border-2 border-[#223649] text-white font-bold text-sm sm:text-base hover:bg-[#223649] transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">pause</span>
                        <span className="hidden xs:inline">Pause</span>
                    </button>
                    <button
                        onClick={onFinishSet}
                        className="flex-[1.5] flex items-center justify-center gap-1 sm:gap-2 h-12 sm:h-14 rounded-xl bg-[var(--color-primary)] text-black font-bold text-sm sm:text-base shadow-lg shadow-[var(--color-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined text-xl">check_circle</span>
                        Finish Set
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActiveWorkoutTimer;
