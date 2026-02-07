import React, { memo, useState } from 'react';

interface PreviewExercise {
    name: string;
    sets: number;
    reps: string;
    image?: string;
    targetMuscles?: string[];
    formCues?: string[];
    notes?: string;
}

interface WorkoutPreviewProps {
    title: string;
    duration: number; // minutes
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
    description: string;
    exercises: PreviewExercise[];
    onStart: () => void;
    onBack: () => void;
}

const WorkoutPreview: React.FC<WorkoutPreviewProps> = ({
    title,
    duration,
    difficulty,
    description,
    exercises,
    onStart,
    onBack
}) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-y-auto pb-44 bg-background-dark font-display text-white transition-colors duration-300">
            {/* Top App Bar Overlay */}
            <div className="fixed top-0 left-0 right-0 z-[60] flex items-center bg-transparent p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 justify-between">
                <button
                    onClick={onBack}
                    aria-label="Back"
                    className="flex size-12 sm:size-14 shrink-0 items-center justify-center cursor-pointer rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-2xl sm:text-3xl">chevron_left</span>
                </button>
                <div className="w-12 sm:w-14" />
            </div>

            {/* Header Hero Section */}
            <div className="w-full">
                <div className="bg-cover bg-center flex flex-col justify-end overflow-hidden min-h-[28vh] sm:min-h-[38vh] relative"
                    style={{
                        backgroundImage: `linear-gradient(180deg, rgba(16, 25, 34, 0.1) 0%, rgba(16, 25, 34, 1) 100%), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop")`
                    }}
                >
                    <div className="flex flex-col p-4 sm:p-6 gap-1 sm:gap-2 relative z-10">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-[var(--color-primary)]/30 backdrop-blur-sm">
                                {exercises.length} exercises
                            </span>
                        </div>
                        <h1 className="text-white tracking-tight text-2xl sm:text-4xl font-black leading-tight">
                            {title}
                        </h1>
                        <p className="text-gray-400 text-xs sm:text-sm max-w-[95%] sm:max-w-[90%] leading-relaxed">
                            {description}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Section */}
            <div className="flex flex-wrap gap-2 sm:gap-3 px-4 sm:px-6 -mt-4 relative z-20">
                <div className="flex min-w-[90px] sm:min-w-[100px] flex-1 flex-col gap-1 rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card bg-[#223649]/40 backdrop-blur-md border border-white/10">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-xl sm:text-2xl">schedule</span>
                    <p className="text-white/60 text-[10px] sm:text-xs font-medium uppercase mt-1">Duration</p>
                    <p className="text-white tracking-tight text-lg sm:text-xl font-bold leading-tight">{duration} <span className="text-xs sm:text-sm font-normal text-white/50">min</span></p>
                </div>
                <div className="flex min-w-[90px] sm:min-w-[100px] flex-1 flex-col gap-1 rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card bg-[#223649]/40 backdrop-blur-md border border-white/10">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-xl sm:text-2xl">fitness_center</span>
                    <p className="text-white/60 text-[10px] sm:text-xs font-medium uppercase mt-1">Volume</p>
                    <p className="text-white tracking-tight text-lg sm:text-xl font-bold leading-tight">{exercises.reduce((acc, ex) => acc + ex.sets, 0)} <span className="text-xs sm:text-sm font-normal text-white/50">Sets</span></p>
                </div>
                <div className="flex min-w-[90px] sm:min-w-[100px] flex-1 flex-col gap-1 rounded-xl sm:rounded-2xl p-3 sm:p-4 glass-card bg-[#223649]/40 backdrop-blur-md border border-white/10">
                    <span className="material-symbols-outlined text-[var(--color-primary)] text-xl sm:text-2xl">bolt</span>
                    <p className="text-white/60 text-[10px] sm:text-xs font-medium uppercase mt-1">Intensity</p>
                    <p className="text-white tracking-tight text-lg sm:text-xl font-bold leading-tight">{difficulty}</p>
                </div>
            </div>

            {/* Exercise List Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 pt-6 sm:pt-8 pb-3 sm:pb-4">
                <h3 className="text-white text-lg sm:text-xl font-bold leading-tight tracking-tight">Exercise List</h3>
                <span className="text-slate-500 text-xs sm:text-sm font-medium">{exercises.length} exercises</span>
            </div>

            {/* List Content */}
            <div className="flex flex-col gap-2 sm:gap-3 px-3 sm:px-4 pb-8">
                {exercises.map((exercise, index) => {
                    const isExpanded = expandedIndex === index;
                    const hasDetails = (exercise.formCues && exercise.formCues.length > 0) || exercise.notes;

                    return (
                        <div key={index} className="bg-[#223649]/40 rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden">
                            <button
                                onClick={() => hasDetails ? setExpandedIndex(isExpanded ? null : index) : undefined}
                                className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 min-h-[76px] sm:min-h-[84px] py-3 sm:py-4 w-full text-left ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                <div className="flex items-center justify-center size-8 sm:size-10 rounded-full bg-white/10 text-slate-400 font-bold text-sm shrink-0">
                                    {index + 1}
                                </div>
                                <div
                                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg sm:rounded-xl size-12 sm:size-14 border border-white/10 bg-slate-700 shrink-0"
                                    style={{ backgroundImage: exercise.image ? `url("${exercise.image}")` : undefined }}
                                >
                                    {!exercise.image && <div className="w-full h-full flex items-center justify-center text-slate-400"><span className="material-symbols-outlined text-xl">fitness_center</span></div>}
                                </div>
                                <div className="flex flex-col justify-center min-w-0 flex-1">
                                    <p className="text-white text-sm sm:text-base font-bold leading-tight line-clamp-1">{exercise.name}</p>
                                    <p className="text-[var(--color-primary)] text-[11px] sm:text-xs font-semibold leading-normal mt-0.5">{exercise.sets} Sets × {exercise.reps} Reps</p>
                                    {exercise.targetMuscles && exercise.targetMuscles.length > 0 && (
                                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                                            {exercise.targetMuscles.map((m, i) => (
                                                <span key={i} className="text-[9px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded-full capitalize">{m}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {hasDetails && (
                                    <span className="material-symbols-outlined text-slate-600 text-lg shrink-0">
                                        {isExpanded ? 'expand_less' : 'expand_more'}
                                    </span>
                                )}
                            </button>

                            {isExpanded && hasDetails && (
                                <div className="px-4 pb-3 pt-0 border-t border-white/5">
                                    {exercise.formCues && exercise.formCues.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Form Cues</p>
                                            <ul className="space-y-1">
                                                {exercise.formCues.map((cue, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                                        <span className="text-[var(--color-primary)] mt-0.5 shrink-0">•</span>
                                                        {cue}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {exercise.notes && (
                                        <p className="text-xs text-slate-400 mt-2 italic">{exercise.notes}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Sticky Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-background-dark via-background-dark/95 to-transparent pt-8 sm:pt-10 z-[70]">
                <div className="flex flex-col gap-3 sm:gap-4 max-w-md mx-auto">
                    <button
                        onClick={onStart}
                        className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-full h-14 sm:h-16 bg-[var(--color-primary)] text-black gap-2 sm:gap-3 text-base sm:text-lg font-black leading-normal tracking-wide shadow-[0_8px_30px_rgba(212,255,0,0.3)] hover:shadow-[0_8px_40px_rgba(212,255,0,0.4)] active:scale-[0.98] transition-all"
                    >
                        <span className="material-symbols-outlined text-xl sm:text-2xl">play_arrow</span>
                        START WORKOUT
                    </button>

                    {/* Safe area spacing for iOS home indicator */}
                    <div className="h-[env(safe-area-inset-bottom)]"></div>
                </div>
            </div>
        </div>
    );
};

export default memo(WorkoutPreview);
