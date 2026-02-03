import React, { memo } from 'react';

interface WorkoutSummaryProps {
    duration: string;
    volume: number; // lbs
    exercisesCount: number;
    onShare: () => void;
    onClose: () => void;
    onRate?: (rating: number) => void;
    onViewHistory?: () => void;
    isSaving?: boolean;
}

const WorkoutSummary: React.FC<WorkoutSummaryProps> = ({
    duration,
    volume,
    exercisesCount,
    onShare,
    onClose,
    onRate,
    onViewHistory,
    isSaving = false
}) => {
    return (
        <div className="relative flex h-auto min-h-screen w-full max-w-md sm:max-w-lg mx-auto flex-col overflow-x-hidden pb-10 bg-background-dark font-display text-white transition-colors duration-300">

            {/* TopAppBar */}
            <div className="flex items-center p-3 sm:p-4 pb-2 justify-between sticky top-0 z-50 bg-background-dark">
                <button onClick={onClose} className="text-white flex size-10 sm:size-12 shrink-0 items-center justify-start">
                    <span className="material-symbols-outlined cursor-pointer text-xl sm:text-2xl">close</span>
                </button>
                <h2 className="text-base sm:text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Workout Summary</h2>
                <div className="flex w-10 sm:w-12 items-center justify-end">
                    <button className="flex cursor-pointer items-center justify-center overflow-hidden rounded-lg size-10 sm:size-12 bg-transparent text-[var(--color-primary)] gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0">
                        <span className="material-symbols-outlined text-xl sm:text-2xl">share</span>
                    </button>
                </div>
            </div>

            <div className="bg-gradient-to-b from-[var(--color-primary)]/10 to-transparent pt-4 sm:pt-6 pb-4 sm:pb-6">
                {/* HeadlineText */}
                <div className="flex flex-col items-center px-4">
                    <div className="bg-[var(--color-primary)]/20 p-2 sm:p-3 rounded-full mb-3 sm:mb-4 ring-4 ring-[var(--color-primary)]/10">
                        <span className="material-symbols-outlined text-[var(--color-primary)] text-3xl sm:text-4xl">celebration</span>
                    </div>
                    <h1 className="tracking-light text-2xl sm:text-[32px] font-bold leading-tight text-center pb-1">Session Crushed!</h1>
                    <p className="text-[var(--color-primary)]/80 text-xs sm:text-sm font-medium">Great work today.</p>
                </div>

                {/* Stats Grid */}
                <div className="flex flex-wrap gap-2 sm:gap-3 p-3 sm:p-4">
                    <div className="flex min-w-[90px] sm:min-w-[100px] flex-1 flex-col gap-2 rounded-xl p-3 sm:p-4 bg-[#1a2e20] shadow-sm border border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">schedule</span>
                            <p className="text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Duration</p>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{duration}</p>
                    </div>
                    <div className="flex min-w-[90px] sm:min-w-[100px] flex-1 flex-col gap-2 rounded-xl p-3 sm:p-4 bg-[#1a2e20] shadow-sm border border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">fitness_center</span>
                            <p className="text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Volume</p>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{volume.toLocaleString()} <span className="text-sm font-normal text-slate-400">lbs</span></p>
                    </div>
                    <div className="flex min-w-[90px] sm:min-w-[100px] flex-1 flex-col gap-2 rounded-xl p-3 sm:p-4 bg-[#1a2e20] shadow-sm border border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[var(--color-primary)] text-lg">exercise</span>
                            <p className="text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-wider">Exercises</p>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{exercisesCount}</p>
                    </div>
                </div>
            </div>

            {/* Feedback Section */}
            <div className="mx-3 sm:mx-4 mt-6 sm:mt-8 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-[#1a2e20] border border-white/5 shadow-sm relative">
                {isSaving && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl sm:rounded-2xl">
                        <div className="text-center">
                            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin motion-reduce:animate-none mx-auto mb-2"></div>
                            <p className="text-white text-sm">Saving workout...</p>
                        </div>
                    </div>
                )}
                <h3 className="text-center text-base sm:text-lg font-bold mb-1 sm:mb-2">How did it feel?</h3>
                <p className="text-slate-400 text-center text-xs sm:text-sm mb-4 sm:mb-6">Your coach uses this to adjust tomorrow's load.</p>
                <div className="flex justify-between items-center px-0 sm:px-1">
                    {['sentiment_very_dissatisfied', 'sentiment_dissatisfied', 'sentiment_satisfied', 'sentiment_very_satisfied', 'rocket_launch'].map((icon, i) => (
                        <button
                            key={i}
                            onClick={() => onRate && onRate(i + 1)}
                            disabled={isSaving}
                            className={`flex flex-col items-center gap-1 sm:gap-2 group transition-transform active:scale-95 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="size-9 sm:size-12 rounded-full bg-background-dark flex items-center justify-center text-slate-400 group-hover:bg-[var(--color-primary)]/20 group-hover:text-[var(--color-primary)] transition-colors">
                                <span className="material-symbols-outlined text-xl sm:text-2xl">{icon}</span>
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase">{['Hard', 'Tough', 'Good', 'Strong', 'Elite'][i]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Coaching Insight */}
            <div className="px-4 sm:px-6 py-6 sm:py-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-dashed border-white/10">
                    <span className="material-symbols-outlined text-[var(--color-primary)]">psychology</span>
                    <p className="text-xs text-slate-400 leading-relaxed italic">
                        "Great work! Your AI Coach is analyzing this session to optimize your next workout."
                    </p>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="mt-auto px-3 sm:px-4 pb-6 sm:pb-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-2 sm:gap-3">
                <button onClick={onShare} disabled={isSaving} className={`w-full bg-[var(--color-primary)] text-background-dark h-12 sm:h-14 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20 active:scale-[0.98] transition-transform ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <span className="material-symbols-outlined text-xl">ios_share</span>
                    Share Progress
                </button>
                {onViewHistory && (
                    <button onClick={onViewHistory} disabled={isSaving} className={`w-full bg-white/5 text-white h-12 sm:h-14 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-white/10 transition-colors border border-white/10 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <span className="material-symbols-outlined text-xl">history</span>
                        View History
                    </button>
                )}
                <button onClick={onClose} disabled={isSaving} className={`w-full bg-transparent text-slate-400 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center hover:text-white transition-colors ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    Back to Dashboard
                </button>
            </div>

        </div>
    );
};

export default memo(WorkoutSummary);
