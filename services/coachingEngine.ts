/**
 * Coaching Engine — Pure Pattern Detection Logic
 *
 * No React, no DOM, no localStorage. Portable to React Native.
 * Receives data arrays, returns detected patterns.
 */

// ============================================================================
// Types
// ============================================================================

export interface CoachEvent {
  type: 'workout_completed' | 'recovery_checkin';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface DetectedPattern {
  type: string;
  priority: 'high' | 'medium' | 'low';
  data: Record<string, unknown>;
  productKey?: string;
}

export interface AutoAdjustment {
  restSeconds?: number;
  intensity?: 'lower' | 'normal';
}

// ============================================================================
// Constants
// ============================================================================

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;

// SOUL.md milestone thresholds
const MILESTONE_DAYS = [1, 7, 14, 21, 30, 60, 90, 100, 365];

const MILESTONE_MESSAGES: Record<number, { message: string; emoji: string }> = {
  1: { message: "Day 1. Everyone starts somewhere.", emoji: '' },
  7: { message: "Week 1 down. Building the habit.", emoji: '🔥' },
  14: { message: "Two weeks in. Momentum building.", emoji: '🔥' },
  21: { message: "Three weeks. Habit territory.", emoji: '🔥' },
  30: { message: "30 days. You're not dabbling anymore.", emoji: '🏆' },
  60: { message: "Two months. This is becoming you.", emoji: '🔥' },
  90: { message: "90 days. Quarter of a year. Solid.", emoji: '🏆' },
  100: { message: "Triple digits. This is who you are now.", emoji: '🏆' },
  365: { message: "One year. Legend status.", emoji: '🏆' },
};

// ============================================================================
// Pattern Detection — Pure Functions
// ============================================================================

function detectRestSkipper(events: CoachEvent[]): DetectedPattern | null {
  const recentWorkouts = events
    .filter(e => e.type === 'workout_completed')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  if (recentWorkouts.length < 2) return null;

  const totalRests = recentWorkouts.reduce((sum, w) => sum + (Number(w.data.totalRests) || 0), 0);
  const totalSkips = recentWorkouts.reduce((sum, w) => sum + (Number(w.data.restSkips) || 0), 0);

  if (totalRests === 0) return null;

  const skipRate = totalSkips / totalRests;
  if (skipRate > 0.5) {
    return {
      type: 'rest_skipper',
      priority: 'medium',
      data: { skipRate: Math.round(skipRate * 100), totalSkips, totalRests },
    };
  }
  return null;
}

function detectLowSleep(events: CoachEvent[]): DetectedPattern | null {
  const recent = events
    .filter(e => e.type === 'recovery_checkin')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 1);

  if (recent.length === 0) return null;

  const sleep = Number(recent[0].data.sleep);
  // Validate sleep is a real number in reasonable range (0-24 hours)
  if (isNaN(sleep) || sleep < 0 || sleep > 24) return null;
  if (sleep > 0 && sleep < 6) {
    return {
      type: 'low_sleep',
      priority: 'high',
      data: { sleepHours: sleep },
      productKey: 'sleep_deficit',
    };
  }
  return null;
}

function detectTrainingStreak(events: CoachEvent[]): DetectedPattern | null {
  const workouts = events
    .filter(e => e.type === 'workout_completed')
    .sort((a, b) => b.timestamp - a.timestamp);

  if (workouts.length < 3) return null;

  // Use UTC date keys to avoid timezone-related streak miscounts
  const toUTCDateKey = (ts: number): string => {
    const d = new Date(ts);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  };

  // Collect unique UTC dates, sorted most recent first
  const uniqueDates: string[] = [];
  const seen = new Set<string>();
  for (const w of workouts) {
    const key = toUTCDateKey(w.timestamp);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDates.push(key);
    }
  }

  // Count strictly consecutive days (no gaps allowed)
  const now = Date.now();
  const todayKey = toUTCDateKey(now);
  const yesterdayKey = toUTCDateKey(now - MS_PER_DAY);

  // Streak must start from today or yesterday
  if (uniqueDates[0] !== todayKey && uniqueDates[0] !== yesterdayKey) {
    return null;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    // Check if the previous unique date is exactly 1 day before this one
    const prevWorkoutTs = workouts.find(w => toUTCDateKey(w.timestamp) === uniqueDates[i])!.timestamp;
    const currWorkoutTs = workouts.find(w => toUTCDateKey(w.timestamp) === uniqueDates[i - 1])!.timestamp;
    const dayDiff = Math.round((currWorkoutTs - prevWorkoutTs) / MS_PER_DAY);
    if (dayDiff <= 1) {
      streak++;
    } else {
      break; // Gap found — streak ends
    }
  }

  if (streak >= 3) {
    return {
      type: 'training_streak',
      priority: streak >= 5 ? 'high' : 'low',
      data: { streakDays: streak },
      productKey: streak >= 5 ? 'general_recovery' : undefined,
    };
  }
  return null;
}

function detectOvertraining(events: CoachEvent[]): DetectedPattern | null {
  const now = Date.now();
  const weekAgo = now - MS_PER_WEEK;
  const workoutsThisWeek = events.filter(
    e => e.type === 'workout_completed' && e.timestamp > weekAgo
  );

  if (workoutsThisWeek.length <= 5) return null;

  // Check if RECENT recovery check-in (within 3 days) has high soreness
  const threeDaysAgo = now - (3 * MS_PER_DAY);
  const lastRecovery = events
    .filter(e => e.type === 'recovery_checkin' && e.timestamp > threeDaysAgo)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  if (!lastRecovery) return null; // No recent recovery data — can't diagnose overtraining

  const soreness = lastRecovery.data.soreness;
  const hasSoreness = Array.isArray(soreness) ? soreness.length > 2 : false;

  if (hasSoreness) {
    return {
      type: 'overtraining',
      priority: 'high',
      data: { sessionsThisWeek: workoutsThisWeek.length, sorenessAreas: soreness },
      productKey: 'general_recovery',
    };
  }
  return null;
}

function detectVolumeProgression(events: CoachEvent[]): DetectedPattern | null {
  const workouts = events
    .filter(e => {
      const vol = Number(e.data.volume);
      // Validate: must be a real positive number, not NaN/Infinity
      return e.type === 'workout_completed' && isFinite(vol) && vol > 0;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  if (workouts.length < 4) return null;

  const halfpoint = Math.floor(workouts.length / 2);
  const firstHalf = workouts.slice(0, halfpoint);
  const secondHalf = workouts.slice(halfpoint);

  const avgFirst = firstHalf.reduce((s, w) => s + Number(w.data.volume), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, w) => s + Number(w.data.volume), 0) / secondHalf.length;

  if (avgFirst <= 0) return null; // Prevent division by zero

  if (avgSecond > avgFirst * 1.1) {
    const volumeIncrease = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);
    if (!isFinite(volumeIncrease)) return null;
    return {
      type: 'volume_progression',
      priority: 'low',
      data: {
        volumeIncrease,
        currentAvgVolume: Math.round(avgSecond),
      },
      productKey: 'general_recovery',
    };
  }
  return null;
}

function detectStaleWorkout(events: CoachEvent[]): DetectedPattern | null {
  const workouts = events
    .filter(e => e.type === 'workout_completed' && Array.isArray(e.data.exercises))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);

  if (workouts.length < 4) return null;

  // Extract exercise names from each workout
  const exerciseSets = workouts.map(w => {
    const exercises = w.data.exercises as Array<{ name?: string }>;
    return new Set(exercises.map(e => (e.name || '').toLowerCase()));
  });

  // Find exercises that appear in ALL 4 sessions
  const firstSet = exerciseSets[0];
  const repeatedInAll = [...firstSet].filter(name =>
    name && exerciseSets.every(s => s.has(name))
  );

  if (repeatedInAll.length >= 3) {
    return {
      type: 'stale_workout',
      priority: 'low',
      data: { repeatedExercises: repeatedInAll.slice(0, 3), sessions: workouts.length },
    };
  }
  return null;
}

function detectGoodSession(events: CoachEvent[]): DetectedPattern | null {
  const workouts = events
    .filter(e => e.type === 'workout_completed')
    .sort((a, b) => b.timestamp - a.timestamp);

  if (workouts.length < 2) return null;

  const latest = workouts[0];
  const previous = workouts[1];

  const latestVolume = Number(latest.data.volume) || 0;
  const previousVolume = Number(previous.data.volume) || 0;

  // Celebrate volume PR (personal record for recent history)
  if (latestVolume > 0 && previousVolume > 0 && latestVolume > previousVolume * 1.15) {
    return {
      type: 'good_session',
      priority: 'low',
      data: {
        volumeIncrease: Math.round(((latestVolume - previousVolume) / previousVolume) * 100),
        volume: latestVolume,
      },
    };
  }
  return null;
}

function detectMilestone(programDay: number): DetectedPattern | null {
  if (!MILESTONE_DAYS.includes(programDay)) return null;

  const milestone = MILESTONE_MESSAGES[programDay];
  if (!milestone) return null;

  return {
    type: 'milestone',
    priority: programDay >= 30 ? 'high' : 'medium',
    data: {
      day: programDay,
      message: milestone.message,
      emoji: milestone.emoji,
    },
  };
}

// ============================================================================
// Main Detection — Pure Function
// ============================================================================

export function detectPatterns(
  events: CoachEvent[],
  programDay?: number
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const restSkipper = detectRestSkipper(events);
  if (restSkipper) patterns.push(restSkipper);

  const lowSleep = detectLowSleep(events);
  if (lowSleep) patterns.push(lowSleep);

  const streak = detectTrainingStreak(events);
  if (streak) patterns.push(streak);

  const overtraining = detectOvertraining(events);
  if (overtraining) patterns.push(overtraining);

  const volumeProgression = detectVolumeProgression(events);
  if (volumeProgression) patterns.push(volumeProgression);

  const staleWorkout = detectStaleWorkout(events);
  if (staleWorkout) patterns.push(staleWorkout);

  // Positive reinforcement: celebrate a good session
  const goodSession = detectGoodSession(events);
  if (goodSession) patterns.push(goodSession);

  if (programDay) {
    const milestone = detectMilestone(programDay);
    if (milestone) patterns.push(milestone);
  }

  // Sort by priority: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  patterns.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return patterns;
}

// ============================================================================
// Auto-Adjustments — Pure Function
// ============================================================================

export function getAutoAdjustments(events: CoachEvent[]): AutoAdjustment {
  const adjustments: AutoAdjustment = {};

  // Rest time adjustment based on skip pattern
  const restSkipper = detectRestSkipper(events);
  if (restSkipper) {
    adjustments.restSeconds = 60;
  }

  // Lower intensity if overtraining detected
  const overtraining = detectOvertraining(events);
  if (overtraining) {
    adjustments.intensity = 'lower';
  }

  return adjustments;
}

// ============================================================================
// Static Fallback Messages — For when AI is unavailable
// ============================================================================

export const FALLBACK_MESSAGES: Record<string, string> = {
  rest_skipper: "Cutting rest time to 60s.",
  low_sleep: "Recovery happens when you rest.",
  training_streak: "Consistency building. Don't forget recovery.",
  overtraining: "Your body needs a break. Take a rest day.",
  volume_progression: "Volume trending up. Keep pushing.",
  stale_workout: "Same exercises 4 sessions in a row. Mix it up.",
  good_session: "Volume PR. You're getting stronger.",
  milestone: "", // Uses MILESTONE_MESSAGES directly
  workout_completed: "Session done. Recovery time.",
};

export function getFallbackMessage(pattern: DetectedPattern): string {
  if (pattern.type === 'milestone') {
    return (pattern.data.message as string) || "Keep going.";
  }
  if (pattern.type === 'training_streak') {
    const days = pattern.data.streakDays as number;
    return `${days} days this week. Don't forget recovery.`;
  }
  if (pattern.type === 'low_sleep') {
    const hrs = pattern.data.sleepHours as number;
    return `${hrs} hours sleep. Recovery happens when you rest.`;
  }
  if (pattern.type === 'good_session') {
    const pct = pattern.data.volumeIncrease as number;
    return `Volume up ${pct}%. You're getting stronger.`;
  }
  return FALLBACK_MESSAGES[pattern.type] || "Keep pushing.";
}
