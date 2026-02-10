import React, { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Calendar,
  Dumbbell,
  Moon,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  TrendingUp,
  Loader2,
  Sparkles,
  Play,
  CheckCircle
} from 'lucide-react';
import { WeeklyPlan, DayPlan, GeneratedWorkout } from '../services/aiService';

interface WeeklyPlanViewProps {
  plan: WeeklyPlan | null;
  isLoading: boolean;
  isGenerating: boolean;
  isPreviousWeekPlan?: boolean; // True if showing a plan from a previous week
  onBack: () => void;
  onGenerate: () => void;
  onStartWorkout: (workout: GeneratedWorkout) => void;
  completedDays?: Set<number>; // Track which days have been completed
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WeeklyPlanView: React.FC<WeeklyPlanViewProps> = ({
  plan,
  isLoading,
  isGenerating,
  isPreviousWeekPlan = false,
  onBack,
  onGenerate,
  onStartWorkout,
  completedDays = new Set()
}) => {
  const [expandedDay, setExpandedDay] = useState<number | null>(new Date().getDay());
  const todayIndex = new Date().getDay();

  // Confirm before regenerating if progress exists
  const handleRegenerate = useCallback(() => {
    if (completedDays.size > 0) {
      const confirmed = window.confirm(
        `You've completed ${completedDays.size} day(s) this week. Regenerating will reset this progress. Continue?`
      );
      if (!confirmed) return;
    }
    onGenerate();
  }, [completedDays, onGenerate]);

  // No plan yet
  if (!plan && !isLoading) {
    return (
      <div className="min-h-screen bg-black p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Weekly Plan</h1>
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6">
            <Calendar className="w-10 h-10 text-[#D4FF00]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Plan Yet</h2>
          <p className="text-gray-400 mb-8 max-w-xs">
            Generate a personalized 7-day training plan based on your history and goals.
          </p>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-8 py-4 bg-[#D4FF00] text-black font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Weekly Plan
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Loading state - skeleton loaders for better perceived performance
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Weekly Plan</h1>
        </div>

        {/* Plan info skeleton */}
        <div className="bg-zinc-900 rounded-2xl p-4 mb-6 border border-zinc-800 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
              <div className="h-5 w-24 bg-zinc-800 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-20 bg-zinc-800 rounded-full" />
              <div className="h-7 w-16 bg-zinc-800 rounded-full" />
            </div>
          </div>
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="h-4 w-24 bg-zinc-700 rounded mb-2" />
            <div className="h-3 w-full bg-zinc-700 rounded mb-1" />
            <div className="h-3 w-3/4 bg-zinc-700 rounded" />
          </div>
        </div>

        {/* Day cards skeleton */}
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-800 rounded-full" />
                <div>
                  <div className="h-4 w-20 bg-zinc-800 rounded mb-2" />
                  <div className="h-3 w-32 bg-zinc-800 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const trainingDays = plan?.days?.filter(d => !d.is_rest_day).length || 0;

  return (
    <div className="min-h-screen bg-black p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Weekly Plan</h1>
      </div>

      {/* Previous week banner */}
      {isPreviousWeekPlan && (
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-amber-400 font-medium text-sm">Previous Week's Plan</div>
              <p className="text-amber-200/80 text-sm mt-1">
                This plan was created for a previous week. Generate a new plan for this week to get fresh recommendations.
              </p>
              <button
                onClick={onGenerate}
                disabled={isGenerating}
                className="mt-3 px-4 py-2 bg-amber-500 text-black font-medium rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate New Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan info card */}
      <div className="bg-zinc-900 rounded-2xl p-4 mb-6 border border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-gray-500">Week of</div>
            <div className="font-bold text-white">{plan?.week_start || 'This Week'}</div>
          </div>
          <div className="flex gap-2">
            <div className="bg-zinc-800 px-3 py-1 rounded-full">
              <span className="text-sm text-white">{trainingDays} Training</span>
            </div>
            <div className="bg-zinc-800 px-3 py-1 rounded-full">
              <span className="text-sm text-white">{7 - trainingDays} Rest</span>
            </div>
          </div>
        </div>

        {/* AI reasoning */}
        {plan?.reasoning && (
          <div className="bg-zinc-800 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#D4FF00]" />
              <span className="text-xs font-medium text-[#D4FF00]">AI Reasoning</span>
            </div>
            <p className="text-sm text-gray-300">{plan.reasoning}</p>
          </div>
        )}

        {/* Progressive overload notes */}
        {plan?.progressive_overload_notes && (
          <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">Progressive Overload</span>
            </div>
            <p className="text-sm text-green-200">{plan.progressive_overload_notes}</p>
          </div>
        )}
      </div>

      {/* Days list */}
      <div className="space-y-3">
        {plan?.days?.map((day, index) => (
          <DayCard
            key={index}
            day={day}
            isToday={day.day === todayIndex}
            isExpanded={expandedDay === day.day}
            isCompleted={completedDays.has(day.day)}
            onToggle={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
            onStartWorkout={onStartWorkout}
          />
        ))}
      </div>

      {/* Regenerate button */}
      <button
        onClick={handleRegenerate}
        disabled={isGenerating}
        className="w-full mt-6 py-3 bg-zinc-900 border border-zinc-800 text-white font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Regenerating Plan...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Regenerate Plan
          </>
        )}
      </button>
    </div>
  );
};

// Day card component
interface DayCardProps {
  day: DayPlan;
  isToday: boolean;
  isExpanded: boolean;
  isCompleted: boolean;
  onToggle: () => void;
  onStartWorkout: (workout: GeneratedWorkout) => void;
}

const DayCard: React.FC<DayCardProps> = ({
  day,
  isToday,
  isExpanded,
  isCompleted,
  onToggle,
  onStartWorkout
}) => {
  return (
    <div
      className={`bg-zinc-900 rounded-xl border ${
        isCompleted
          ? 'border-green-500/50'
          : isToday
          ? 'border-[#D4FF00]'
          : 'border-zinc-800'
      } overflow-hidden ${isCompleted ? 'opacity-80' : ''}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`${DAY_NAMES[day.day]}: ${day.is_rest_day ? 'Rest Day' : day.workout?.title || 'Workout'}${isCompleted ? ' (Completed)' : ''}`}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isCompleted
                ? 'bg-green-500/20 text-green-400'
                : isToday
                ? 'bg-[#D4FF00] text-black'
                : day.is_rest_day
                ? 'bg-zinc-800 text-gray-500'
                : 'bg-zinc-700 text-white'
            }`}
          >
            {isCompleted ? (
              <CheckCircle className="w-5 h-5" />
            ) : day.is_rest_day ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Dumbbell className="w-5 h-5" />
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                {DAY_NAMES[day.day]}
              </span>
              {isCompleted && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                  Done
                </span>
              )}
              {isToday && !isCompleted && (
                <span className="text-xs bg-[#D4FF00] text-black px-2 py-0.5 rounded-full font-medium">
                  Today
                </span>
              )}
            </div>
            <div className={`text-sm ${isCompleted ? 'text-green-400/70' : 'text-gray-400'}`}>
              {day.is_rest_day
                ? 'Rest Day'
                : day.workout?.title || 'Workout'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!day.is_rest_day && day.workout && (
            <span className="text-sm text-gray-500">
              {day.workout.duration_minutes} min
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-zinc-800">
          {day.is_rest_day ? (
            <div className="pt-4">
              <p className="text-gray-400">{day.rest_reason || 'Recovery and muscle growth'}</p>
              <div className="mt-3 p-3 bg-zinc-800 rounded-lg">
                <div className="text-sm text-gray-300">Suggestions:</div>
                <ul className="text-sm text-gray-400 mt-1 space-y-1">
                  <li>• Light stretching or yoga</li>
                  <li>• 10-15 minute walk</li>
                  <li>• Focus on sleep and nutrition</li>
                </ul>
              </div>
            </div>
          ) : day.workout ? (
            <div className="pt-4">
              {/* Workout meta */}
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  {day.workout.duration_minutes} min
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Target className="w-4 h-4" />
                  {day.workout.intensity}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Dumbbell className="w-4 h-4" />
                  {day.workout.exercises?.length || 0} exercises
                </div>
              </div>

              {/* Focus areas */}
              {day.focus_areas && day.focus_areas.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {day.focus_areas.map((area, i) => (
                    <span
                      key={i}
                      className="text-xs bg-zinc-800 text-gray-300 px-2 py-1 rounded-full"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {/* Exercise list */}
              <div className="space-y-2 mb-4">
                {day.workout.exercises?.slice(0, 5).map((ex, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0"
                  >
                    <span className="text-sm text-white">{ex.name}</span>
                    <span className="text-sm text-gray-500">
                      {ex.sets} × {ex.reps}
                    </span>
                  </div>
                ))}
                {(day.workout.exercises?.length || 0) > 5 && (
                  <div className="text-sm text-gray-500 text-center py-2">
                    +{(day.workout.exercises?.length || 0) - 5} more exercises
                  </div>
                )}
              </div>

              {/* Recovery notes */}
              {day.workout.recovery_adjusted && day.workout.recovery_notes && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg mb-4">
                  <div className="text-sm text-yellow-400 font-medium">Recovery Adjusted</div>
                  <div className="text-sm text-yellow-200 mt-1">{day.workout.recovery_notes}</div>
                </div>
              )}

              {/* Start workout button */}
              <button
                onClick={() => onStartWorkout(day.workout!)}
                className="w-full py-3 bg-[#D4FF00] text-black font-bold rounded-xl flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Workout
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanView;
