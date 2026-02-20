/**
 * Body Check-in Insights — pure functions for delta calculations and trend text.
 * No React, no API calls. Deterministic and testable.
 */

export interface BodyCheckin {
  id: string;
  user_id: string;
  weight_lbs: number | null;
  body_fat_pct: number | null;
  muscle_mass_lbs: number | null;
  waist_inches: number | null;
  notes: string | null;
  source: 'manual' | 'scale' | 'ai';
  created_at: string;
}

export type BodyMetric = 'weight_lbs' | 'body_fat_pct' | 'muscle_mass_lbs' | 'waist_inches';

export interface DeltaResult {
  value: number;
  direction: 'up' | 'down' | 'flat';
  isPositive: boolean; // contextual: weight down = positive for cut goal
}

const METRIC_LABELS: Record<BodyMetric, string> = {
  weight_lbs: 'Weight',
  body_fat_pct: 'Body Fat',
  muscle_mass_lbs: 'Muscle Mass',
  waist_inches: 'Waist',
};

const METRIC_UNITS: Record<BodyMetric, string> = {
  weight_lbs: 'lbs',
  body_fat_pct: '%',
  muscle_mass_lbs: 'lbs',
  waist_inches: 'in',
};

/** Find the check-in with a non-null metric closest to N days ago */
function findClosestCheckin(
  checkins: BodyCheckin[],
  metric: BodyMetric,
  daysAgo: number,
): BodyCheckin | null {
  const targetTime = Date.now() - daysAgo * 86_400_000;
  const maxWindow = daysAgo * 2 * 86_400_000; // allow 2x window tolerance

  let best: BodyCheckin | null = null;
  let bestDiff = Infinity;

  for (const c of checkins) {
    if (c[metric] == null) continue;
    const t = new Date(c.created_at).getTime();
    const diff = Math.abs(t - targetTime);
    if (diff < bestDiff && diff <= maxWindow) {
      bestDiff = diff;
      best = c;
    }
  }

  return best;
}

/** Is a goal "cutting" oriented? */
function isCutGoal(goal: string | null): boolean {
  if (!goal) return true; // default: weight down = good
  const g = goal.toLowerCase();
  return g.includes('cut') || g.includes('lose') || g.includes('lean') || g.includes('fat') || g.includes('tone');
}

/**
 * Calculate delta between latest and N-days-ago value for a given metric.
 * Returns null if insufficient data.
 */
export function calculateDelta(
  checkins: BodyCheckin[],
  metric: BodyMetric,
  daysAgo: number,
  goal: string | null,
): DeltaResult | null {
  // Latest with this metric
  const latest = checkins.find(c => c[metric] != null);
  if (!latest) return null;

  const past = findClosestCheckin(checkins, metric, daysAgo);
  if (!past || past.id === latest.id) return null;

  const latestVal = latest[metric] as number;
  const pastVal = past[metric] as number;
  const delta = latestVal - pastVal;

  const direction: DeltaResult['direction'] =
    Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down';

  // Determine if the change is contextually positive
  let isPositive: boolean;
  if (metric === 'body_fat_pct' || metric === 'waist_inches') {
    isPositive = delta <= 0; // down is always good
  } else if (metric === 'muscle_mass_lbs') {
    isPositive = delta >= 0; // up is always good
  } else {
    // weight: depends on goal
    isPositive = isCutGoal(goal) ? delta <= 0 : delta >= 0;
  }

  return { value: Math.round(delta * 10) / 10, direction, isPositive };
}

/** Format a delta value for display: "+2.3" or "-1.5" */
export function formatDelta(delta: DeltaResult, metric: BodyMetric): string {
  const sign = delta.value > 0 ? '+' : '';
  return `${sign}${delta.value} ${METRIC_UNITS[metric]}`;
}

/** Generate a text insight from check-in trends. No LLM — just template interpolation. */
export function generateBodyInsight(
  checkins: BodyCheckin[],
  goal: string | null,
): string | null {
  if (checkins.length < 2) return null;

  const parts: string[] = [];

  const weightDelta7 = calculateDelta(checkins, 'weight_lbs', 7, goal);
  const weightDelta30 = calculateDelta(checkins, 'weight_lbs', 30, goal);
  const bfDelta30 = calculateDelta(checkins, 'body_fat_pct', 30, goal);

  if (weightDelta7) {
    const dir = weightDelta7.direction === 'up' ? 'up' : weightDelta7.direction === 'down' ? 'down' : 'stable';
    if (dir !== 'stable') {
      parts.push(`Weight is ${dir} ${Math.abs(weightDelta7.value)} lbs this week.`);
    } else {
      parts.push('Weight is holding steady this week.');
    }
  }

  if (weightDelta30 && weightDelta30.direction !== 'flat') {
    const dir = weightDelta30.value > 0 ? 'gained' : 'lost';
    parts.push(`You've ${dir} ${Math.abs(weightDelta30.value)} lbs over the past month.`);
  }

  if (bfDelta30 && bfDelta30.direction !== 'flat') {
    const dir = bfDelta30.value > 0 ? 'up' : 'down';
    parts.push(`Body fat is ${dir} ${Math.abs(bfDelta30.value)}% in 30 days.`);
  }

  if (parts.length === 0) return null;

  // Add goal-context encouragement
  if (weightDelta7?.isPositive || bfDelta30?.isPositive) {
    parts.push('You\'re trending in the right direction. Keep it up!');
  }

  return parts.join(' ');
}

export { METRIC_LABELS, METRIC_UNITS };
