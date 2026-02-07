import React from 'react';
import { Calendar, Dumbbell, Loader2, ChevronRight, Sparkles } from 'lucide-react';
import { DayPlan, GeneratedWorkout } from '../services/aiService';

interface WeeklyPlanCardProps {
  plan: {
    days: DayPlan[];
    reasoning?: string;
    progressive_overload_notes?: string;
  } | null;
  todaysPlan: DayPlan | null;
  isLoading: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  onViewPlan: () => void;
  onStartWorkout: (workout: GeneratedWorkout) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WeeklyPlanCard: React.FC<WeeklyPlanCardProps> = ({
  plan,
  todaysPlan,
  isLoading,
  isGenerating,
  onGenerate,
  onViewPlan,
  onStartWorkout
}) => {
  const todayIndex = new Date().getDay();

  // No plan exists yet
  if (!plan && !isLoading) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-[#D4FF00]" />
          <h3 className="font-bold text-white">Weekly Plan</h3>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          Let AI analyze your history and create a personalized training week with progressive overload built in.
        </p>

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full py-3 bg-[#D4FF00] text-black font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Plan...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Weekly Plan
            </>
          )}
        </button>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-[#D4FF00]" />
          <h3 className="font-bold text-white">Weekly Plan</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Plan exists - show overview
  const trainingDays = plan?.days?.filter(d => !d.is_rest_day).length || 0;
  const restDays = plan?.days?.filter(d => d.is_rest_day).length || 0;

  return (
    <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#D4FF00]" />
          <h3 className="font-bold text-white">This Week's Plan</h3>
        </div>
        <button
          onClick={onViewPlan}
          className="text-xs text-[#D4FF00] flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Week overview dots */}
      <div className="flex justify-between mb-4">
        {plan?.days?.map((day, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <span className={`text-xs ${day.day === todayIndex ? 'text-[#D4FF00] font-bold' : 'text-gray-500'}`}>
              {DAY_NAMES[day.day]}
            </span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                day.day === todayIndex
                  ? 'bg-[#D4FF00] text-black'
                  : day.is_rest_day
                  ? 'bg-zinc-800 text-gray-500'
                  : 'bg-zinc-700 text-white'
              }`}
            >
              {day.is_rest_day ? (
                <span className="text-xs">R</span>
              ) : (
                <Dumbbell className="w-4 h-4" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Today's workout or rest */}
      {todaysPlan && (
        <div className="bg-zinc-800 rounded-xl p-3 mb-3">
          <div className="text-xs text-gray-400 mb-1">Today</div>
          {todaysPlan.is_rest_day ? (
            <div>
              <div className="font-bold text-white">Rest Day</div>
              <div className="text-sm text-gray-400">{todaysPlan.rest_reason || 'Recovery and growth'}</div>
            </div>
          ) : todaysPlan.workout ? (
            <div>
              <div className="font-bold text-white">{todaysPlan.workout.title}</div>
              <div className="text-sm text-gray-400">
                {todaysPlan.workout.duration_minutes} min • {todaysPlan.workout.exercises?.length || 0} exercises
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Quick stats */}
      <div className="flex gap-4 text-center mb-4">
        <div className="flex-1 bg-zinc-800 rounded-lg py-2">
          <div className="text-lg font-bold text-white">{trainingDays}</div>
          <div className="text-xs text-gray-500">Training</div>
        </div>
        <div className="flex-1 bg-zinc-800 rounded-lg py-2">
          <div className="text-lg font-bold text-white">{restDays}</div>
          <div className="text-xs text-gray-500">Rest</div>
        </div>
      </div>

      {/* Regenerate option */}
      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full mt-2 py-2 text-sm text-gray-400 flex items-center justify-center gap-1"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Regenerating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Regenerate Plan
          </>
        )}
      </button>
    </div>
  );
};

export default WeeklyPlanCard;
