import React, { useState, useMemo, useEffect, useRef, useReducer, memo } from 'react';
import ProgressBar from './ProgressBar';
import MealIcon from './icons/MealIcon';
import CameraIcon from './icons/CameraIcon';
import ShopIcon from './icons/ShopIcon';
import HistoryIcon from './icons/HistoryIcon';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import Skeleton from './ui/Skeleton';
import SupplementRecommendationCard from './SupplementRecommendationCard';
import AddToHomeScreenButton from './AddToHomeScreenButton';
import WeeklyPlanCard from './WeeklyPlanCard';
import { getRecommendations } from '../services/supplementService';
import CoachInsightCard from './CoachInsightCard';
import SectionErrorBoundary from './SectionErrorBoundary';
import type { CoachInsight } from '../hooks/useCoachingAgent';
import type { NutritionLog, CompletedWorkout } from '../App';
import type { NutritionTargets, UserProfile } from '../hooks/useUserData';
import type { WeeklyPlan, DayPlan, GeneratedWorkout } from '../services/aiService';

type Tab = 'dashboard' | 'train' | 'body' | 'meal' | 'mindset';
type WorkoutStatus = 'idle' | 'recovery' | 'generating' | 'preview' | 'active' | 'completed';

interface DashboardProps {
    setActiveTab: (tab: Tab) => void;
    showHistoryView: () => void;
    showTrainerView?: () => void;
    nutritionLog: NutritionLog[];
    nutritionTargets: NutritionTargets;
    goal: string | null;
    workoutHistory: CompletedWorkout[];
    userProfile?: UserProfile;
    onStartWorkout: () => void;
    workoutStatus: WorkoutStatus;
    // Weekly Plan props
    weeklyPlan?: WeeklyPlan | null;
    todaysPlan?: DayPlan | null;
    isWeeklyPlanLoading?: boolean;
    isGeneratingPlan?: boolean;
    onGeneratePlan?: () => void;
    onViewWeeklyPlan?: () => void;
    onStartPlanWorkout?: (workout: GeneratedWorkout) => void;
    coachInsights?: CoachInsight[];
    onDismissInsight?: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
    setActiveTab,
    showHistoryView,
    showTrainerView,
    nutritionLog,
    nutritionTargets,
    goal,
    workoutHistory,
    userProfile,
    onStartWorkout,
    workoutStatus,
    weeklyPlan,
    todaysPlan,
    isWeeklyPlanLoading,
    isGeneratingPlan,
    onGeneratePlan,
    onViewWeeklyPlan,
    onStartPlanWorkout,
    coachInsights,
    onDismissInsight
}) => {
    const { user } = useAuth();
    const [pendingWorkoutsCount, setPendingWorkoutsCount] = useState(0);
    const [trainerName, setTrainerName] = useState<string | null>(null);

    // Fetch pending workouts count for clients with trainers - PARALLELIZED
    useEffect(() => {
        const fetchTrainerData = async () => {
            if (!user || !userProfile?.trainer_id) return;

            try {
                const [pendingResult, trainerResult] = await Promise.all([
                    supabase
                        .from('assigned_workouts')
                        .select('*', { count: 'exact', head: true })
                        .eq('client_id', user.id)
                        .eq('status', 'pending'),
                    supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', userProfile.trainer_id)
                        .single()
                ]);

                setPendingWorkoutsCount(pendingResult.count || 0);

                if (trainerResult.data) {
                    setTrainerName(trainerResult.data.full_name);
                }
            } catch {
                // Optional feature - trainer data may not be set up
            }
        };

        fetchTrainerData();
    }, [user, userProfile?.trainer_id]);

    // Memoize supplement recommendations so we don't create new objects every render
    const supplementRecs = useMemo(() => getRecommendations(goal), [goal]);

    // FIX 5.2 + FIX 24: Force re-render at midnight — setTimeout to exact boundary
    // Uses useReducer to avoid unused state variable lint warnings
    const [, forceRender] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
        const scheduleNextMidnight = () => {
            const now = new Date();
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            // Add 1s buffer to ensure we're past midnight
            const msUntilMidnight = tomorrow.getTime() - now.getTime() + 1000;
            return setTimeout(() => {
                forceRender();
                // Re-schedule for next midnight
                timerId = scheduleNextMidnight();
            }, msUntilMidnight);
        };
        let timerId = scheduleNextMidnight();
        return () => clearTimeout(timerId);
    }, []);

    // RALPH LOOP 22: Refresh day counter when tab becomes visible
    // Handles case where tab was backgrounded past midnight
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                forceRender();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Calculate program day (days since user started) instead of calendar day
    const { dayDisplay, isMilestone, milestoneMessage } = useMemo(() => {
        if (!userProfile?.created_at) {
            return { programDay: 1, dayDisplay: 'Day 1', isMilestone: true, milestoneMessage: null };
        }

        // RALPH LOOP 29: Validate created_at format with try/catch
        let startDate: Date;
        try {
            startDate = new Date(userProfile.created_at);
            // Check if date is valid
            if (isNaN(startDate.getTime())) {
                console.warn('[Dashboard] Invalid created_at format:', userProfile.created_at);
                return { programDay: 1, dayDisplay: 'Day 1', isMilestone: true, milestoneMessage: null };
            }
        } catch {
            console.warn('[Dashboard] Failed to parse created_at:', userProfile.created_at);
            return { programDay: 1, dayDisplay: 'Day 1', isMilestone: true, milestoneMessage: null };
        }

        // RALPH LOOP 21: DST-safe day calculation using UTC calendar days
        // This avoids issues where setHours(0,0,0,0) can shift days during DST transitions
        const todayUTC = Date.UTC(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate()
        );
        const startUTC = Date.UTC(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate()
        );

        // Calculate difference in calendar days (not affected by DST)
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        const diffDays = Math.floor((todayUTC - startUTC) / MS_PER_DAY) + 1; // +1 so Day 1 is first day
        const day = Math.max(1, diffDays);

        // Format display for large numbers
        let display: string;
        let milestone = false;
        let message: string | null = null;

        // Check for milestones with celebration messages (SOUL.md: King Kay Mix voice)
        const MILESTONE_MESSAGES: Record<number, string> = {
            7: 'Week 1 down. Building the habit.',
            14: 'Two weeks in. Momentum building.',
            21: 'Three weeks. Habit territory.',
            30: "30 days. You're not dabbling anymore.",
            60: 'Two months. This is becoming you.',
            90: '90 days. Quarter of a year. Solid.',
            100: 'Triple digits. This is who you are now.',
            180: 'Half a year. Transformed.',
            365: 'One year. Legend status.',
        };

        if (MILESTONE_MESSAGES[day]) {
            milestone = true;
            message = MILESTONE_MESSAGES[day];
        }

        // Format display based on day count
        if (day >= 365) {
            const years = Math.floor(day / 365);
            const remainingDays = day % 365;
            if (remainingDays === 0) {
                display = `Year ${years}`;
                milestone = true;
            } else {
                display = `Year ${years}, Day ${remainingDays}`;
            }
        } else if (day > 99) {
            display = `Day ${day}`;
        } else {
            display = `Day ${day}`;
        }

        return { programDay: day, dayDisplay: display, isMilestone: milestone, milestoneMessage: message };
    }, [userProfile?.created_at]);

    // Get today's nutrition from log or use defaults (local date YYYY-MM-DD format to match database)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayNutrition = nutritionLog.find(entry => entry.date === today) || {
        date: today,
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0
    };

    const nutritionData = {
        calories: { current: todayNutrition.calories, target: nutritionTargets.calories },
        protein: { current: todayNutrition.protein, target: nutritionTargets.protein },
        carbs: { current: todayNutrition.carbs, target: nutritionTargets.carbs },
    };

    // Prevent conflicting actions during loading states
    const isBusy = workoutStatus === 'generating' || workoutStatus === 'recovery' || isGeneratingPlan || isWeeklyPlanLoading;

    return (
        <div className="w-full space-y-8 pb-8">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter">TODAY</h2>
                    <p className="text-gray-400 text-sm font-medium">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-2xl">{isMilestone ? '🏆' : '🔥'}</span>
                        <span className={`font-bold text-xl ${isMilestone ? 'text-yellow-400' : 'text-[var(--color-primary)]'}`}>
                            {dayDisplay}
                        </span>
                    </div>
                    {milestoneMessage && (
                        <p className="text-xs text-yellow-400/80 mt-1 font-medium">{milestoneMessage}</p>
                    )}
                </div>
            </header>

            {/* Nutrition Card */}
            <div className="card">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <MealIcon className="w-5 h-5 text-[var(--color-primary)]" /> NUTRITION
                    </h3>
                </div>
                <div className="space-y-6">
                    <ProgressBar label="Calories" currentValue={nutritionData.calories.current} targetValue={nutritionData.calories.target} unit="kcal" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <ProgressBar label="Protein" currentValue={nutritionData.protein.current} targetValue={nutritionData.protein.target} unit="g" />
                        <ProgressBar label="Carbs" currentValue={nutritionData.carbs.current} targetValue={nutritionData.carbs.target} unit="g" />
                    </div>
                </div>
                {userProfile && (!userProfile.height_inches || !userProfile.age || !userProfile.gender) && (
                    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                        <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <p className="text-xs text-yellow-300 font-medium">Using generic baseline targets</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Add {!userProfile.height_inches ? 'height, ' : ''}{!userProfile.age ? 'age, ' : ''}{!userProfile.gender ? 'gender ' : ''}in Settings for personalized calorie targets.
                            </p>
                        </div>
                    </div>
                )}

                {/* FIX 3.1: Trial Status Banner */}
                {userProfile?.subscription_status === 'trial' && userProfile.trial_started_at && (
                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-xs text-blue-300 font-medium">Free Trial Active</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {(() => {
                                    const trialStart = new Date(userProfile.trial_started_at!).getTime();
                                    const daysSinceStart = (Date.now() - trialStart) / (1000 * 60 * 60 * 24);
                                    const daysRemaining = Math.max(0, Math.ceil(7 - daysSinceStart));
                                    return daysRemaining > 0
                                        ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
                                        : 'Trial expired';
                                })()}
                            </p>
                        </div>
                        <a
                            href="https://sloefit.com/subscribe"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors whitespace-nowrap"
                        >
                            Upgrade
                        </a>
                    </div>
                )}

                {/* C8 FIX: Prominent upgrade banner for expired trials */}
                {userProfile?.subscription_status === 'expired' && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-red-400 text-xl">warning</span>
                            <div className="flex-1">
                                <p className="text-sm text-red-400 font-medium">Trial Expired</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Upgrade to continue using AI workouts and nutrition tracking.
                                </p>
                            </div>
                        </div>
                        <a
                            href="https://sloefit.com/subscribe"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block w-full py-2 px-4 bg-[var(--color-primary)] text-black text-sm font-bold rounded-lg text-center hover:opacity-90 transition-opacity"
                        >
                            Upgrade Now
                        </a>
                    </div>
                )}
            </div>

            {/* Unified Workout CTA - Context-Aware */}
            <div className="card">
                {workoutStatus === 'generating' || isGeneratingPlan ? (
                    <div className="py-6 space-y-4">
                        <div className="text-center">
                            <p className="text-xl font-black text-white animate-pulse motion-reduce:animate-none">
                                {isGeneratingPlan ? 'GENERATING PLAN...' : 'GENERATING WORKOUT...'}
                            </p>
                            <p className="text-gray-400 text-sm mt-1">
                                {isGeneratingPlan ? 'Creating your personalized week' : 'Personalizing based on your recovery'}
                            </p>
                        </div>
                        <div className="space-y-3 px-2">
                            <Skeleton className="h-6 w-3/5 mx-auto" />
                            <div className="space-y-2">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                                        <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/3" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    </div>
                ) : todaysPlan && !todaysPlan.is_rest_day && todaysPlan.workout && onStartPlanWorkout ? (
                    /* Has plan workout for today - show as primary */
                    <div className="py-6 text-center">
                        <div className="mb-5">
                            <div className="w-14 h-14 mx-auto bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-[var(--color-primary)] text-2xl">calendar_today</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{todaysPlan.workout.title}</h3>
                            <p className="text-gray-400 text-sm">
                                {todaysPlan.workout.duration_minutes} min • {todaysPlan.workout.exercises?.length || 0} exercises
                            </p>
                            <p className="text-[var(--color-primary)] text-xs mt-1">From your weekly plan</p>
                        </div>
                        <button
                            onClick={() => onStartPlanWorkout(todaysPlan.workout!)}
                            disabled={isBusy}
                            className="btn-primary w-full focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1C1E] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Start Workout
                        </button>
                        <button
                            onClick={onStartWorkout}
                            disabled={isBusy}
                            className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Or generate a fresh workout →
                        </button>
                    </div>
                ) : todaysPlan?.is_rest_day ? (
                    /* Rest day in plan */
                    <div className="py-6 text-center">
                        <div className="mb-5">
                            <div className="w-14 h-14 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center mb-3">
                                <span className="material-symbols-outlined text-blue-400 text-2xl">bedtime</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">Rest Day</h3>
                            <p className="text-gray-400 text-sm">{todaysPlan.rest_reason || 'Recovery and muscle growth'}</p>
                        </div>
                        <button
                            onClick={onStartWorkout}
                            disabled={isBusy}
                            className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Train Anyway
                        </button>
                    </div>
                ) : workoutStatus === 'idle' ? (
                    /* No plan - default CTA */
                    <div className="py-8 text-center">
                        <div className="mb-6">
                            <div className="w-16 h-16 mx-auto bg-[var(--color-primary)]/20 rounded-full flex items-center justify-center mb-4">
                                <span className="text-3xl">💪</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Ready to Train?</h3>
                            <p className="text-gray-400 text-sm">AI will generate a workout based on your recovery</p>
                        </div>
                        <button
                            onClick={onStartWorkout}
                            disabled={isBusy}
                            className="btn-primary w-full focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C1C1E] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Start Today's Workout
                        </button>
                    </div>
                ) : null}
            </div>

            {/* Weekly Plan Card */}
            {onGeneratePlan && onViewWeeklyPlan && onStartPlanWorkout && (
                <WeeklyPlanCard
                    plan={weeklyPlan ? { days: weeklyPlan.days, reasoning: weeklyPlan.reasoning, progressive_overload_notes: weeklyPlan.progressive_overload_notes } : null}
                    todaysPlan={todaysPlan || null}
                    isLoading={isWeeklyPlanLoading || false}
                    isGenerating={isGeneratingPlan || false}
                    onGenerate={onGeneratePlan}
                    onViewPlan={onViewWeeklyPlan}
                    onStartWorkout={onStartPlanWorkout}
                />
            )}

            {/* Trainer Card (for clients with trainers) */}
            {userProfile?.trainer_id && showTrainerView && (
                <button
                    onClick={showTrainerView}
                    className="card flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/30 to-purple-600/20 border-purple-500/30 hover:border-purple-500/50 transition-all hover:scale-[1.02]"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-white">My Trainer</h4>
                            <p className="text-sm text-gray-400">{trainerName || 'Your Coach'}</p>
                            {pendingWorkoutsCount > 0 && (
                                <p className="text-xs text-yellow-400 mt-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                                    {pendingWorkoutsCount} workout{pendingWorkoutsCount > 1 ? 's' : ''} assigned
                                </p>
                            )}
                        </div>
                    </div>
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Coach Insights */}
            {coachInsights && coachInsights.length > 0 && onDismissInsight && (
                <SectionErrorBoundary sectionName="Coach Insights">
                <div className="space-y-3">
                    {coachInsights.slice(0, 2).map(insight => (
                        <CoachInsightCard
                            key={insight.id}
                            insight={insight}
                            onDismiss={onDismissInsight}
                            onProductClick={() => {
                                const url = insight.product?.productUrl;
                                if (url) window.open(url, '_blank');
                            }}
                        />
                    ))}
                </div>
                </SectionErrorBoundary>
            )}

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <button
                    onClick={() => setActiveTab('meal')}
                    aria-label="Log a meal"
                    className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group touch-manipulation focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset"
                >
                    <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                        <MealIcon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white">Log Meal</span>
                </button>
                <button
                    onClick={() => setActiveTab('body')}
                    aria-label="Body check-in with camera"
                    className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group touch-manipulation focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset"
                >
                    <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                        <CameraIcon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white">Check In</span>
                </button>
                <button
                    onClick={showHistoryView}
                    aria-label="View full history"
                    className="card flex flex-col items-center justify-center gap-3 py-6 hover:border-[var(--color-primary)] group touch-manipulation focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset"
                >
                    <div className="bg-gray-800 p-3 rounded-full group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                        <HistoryIcon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <span className="font-bold text-sm text-gray-300 group-hover:text-white">History</span>
                </button>
            </div>

            {/* Shopify Store Link */}
            <a href="https://sloe-fit.com" target="_blank" rel="noopener noreferrer" className="card flex items-center justify-between p-4 bg-gradient-to-r from-[var(--bg-card)] to-[var(--color-primary)]/10 border-0 hover:scale-[1.02] touch-manipulation focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-inset">
                <div className="flex items-center gap-4">
                    <div className="bg-[var(--color-primary)] text-black p-2 rounded-lg">
                        <ShopIcon className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-white">Supplements</h4>
                        <p className="text-xs text-[var(--color-primary)]">Restock & Fuel Up</p>
                    </div>
                </div>
                <div className="text-gray-400">&rarr;</div>
            </a>

            {/* Recovery Fuel - Dosage Recommendations */}
            <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-6 bg-[var(--color-primary)] rounded-full"></span>
                    <h3 className="text-lg font-bold text-white">RECOVERY FUEL</h3>
                </div>
                {supplementRecs.map(rec => (
                    <SupplementRecommendationCard key={rec.id} recommendation={rec} />
                ))}
            </div>

            {/* Add to Home Screen - for iOS users */}
            <AddToHomeScreenButton />

            {/* FIX 9.1: Health Disclaimer */}
            <p className="text-xs text-gray-600 text-center mt-4 px-4 leading-relaxed">
                Not medical advice. Consult a healthcare professional before starting any diet or exercise program. AI-generated nutrition estimates may not be accurate.
            </p>
        </div>
    );
};

export default memo(Dashboard);
