/**
 * Workout utility functions for consistent calculations across the app.
 */

/**
 * Parse reps string into estimated total reps per set.
 * Handles various formats:
 * - "10" → 10
 * - "8-12" → 10 (midpoint)
 * - "10-12-15" (drop sets) → 12.33 (average)
 * - "8,8,6" (per-set) → 7.33 (average)
 * - "AMRAP" → 12 (estimated)
 * - "failure" → 10 (estimated)
 * - "max" → 10 (estimated)
 * - "30s" or "30 sec" → 10 (time-based, estimate)
 *
 * @param reps - The reps string from an exercise
 * @returns Estimated reps per set as a number
 */
export function parseReps(reps: string | undefined | null): number {
  if (!reps || typeof reps !== 'string') return 10;

  const cleaned = reps.trim().toLowerCase();

  // Handle special keywords
  if (cleaned === 'amrap' || cleaned === 'max' || cleaned === 'failure' || cleaned === 'to failure') {
    return 12; // Estimate high-effort sets
  }

  // Handle time-based (e.g., "30s", "45 sec", "1 min")
  if (cleaned.includes('s') || cleaned.includes('sec') || cleaned.includes('min')) {
    return 10; // Default estimate for time-based exercises
  }

  // Handle comma-separated (per-set reps: "8,8,6")
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(p => parseInt(p.trim())).filter(n => !isNaN(n));
    if (parts.length > 0) {
      return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
    }
  }

  // Handle range or drop sets (e.g., "8-12" or "10-12-15")
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-').map(p => parseInt(p.trim())).filter(n => !isNaN(n));
    if (parts.length > 0) {
      return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
    }
  }

  // Handle "+" suffix (e.g., "5+" for AMRAP final set)
  if (cleaned.includes('+')) {
    const base = parseInt(cleaned.replace('+', ''));
    return isNaN(base) ? 10 : base + 2; // Estimate 2 extra reps
  }

  // Simple number
  const parsed = parseInt(cleaned);
  return isNaN(parsed) ? 10 : parsed;
}

/**
 * Parse sets string into number.
 * Handles:
 * - "3" → 3
 * - "4-5" → 4 (take lower for conservative estimate)
 * - "3x" → 3
 *
 * @param sets - The sets string
 * @returns Number of sets
 */
export function parseSets(sets: string | number | undefined | null): number {
  if (typeof sets === 'number') return sets;
  if (!sets || typeof sets !== 'string') return 3;

  const cleaned = sets.trim().toLowerCase().replace('x', '');

  // Handle range (e.g., "3-4")
  if (cleaned.includes('-')) {
    const first = parseInt(cleaned.split('-')[0]);
    return isNaN(first) ? 3 : first;
  }

  const parsed = parseInt(cleaned);
  return isNaN(parsed) ? 3 : parsed;
}

/**
 * Calculate total volume for a set of exercise logs.
 * Volume = Sets × Reps × Weight
 *
 * @param exercises - Array of exercise objects with sets, reps, weight
 * @returns Total volume in lbs
 */
export function calculateTotalVolume(
  exercises: Array<{ sets: string | number; reps: string; weight?: string | number }>
): number {
  return exercises.reduce((total, ex) => {
    const sets = parseSets(ex.sets);
    const reps = parseReps(ex.reps);
    const weight = typeof ex.weight === 'number'
      ? ex.weight
      : parseFloat(String(ex.weight || '0')) || 0;

    return total + (sets * reps * weight);
  }, 0);
}

/**
 * Calculate rep volume (sets × reps, no weight).
 * Useful for bodyweight exercises or plan comparison.
 *
 * @param exercises - Array of exercise objects with sets and reps
 * @returns Total rep volume
 */
export function calculateRepVolume(
  exercises: Array<{ sets: string | number; reps: string }>
): number {
  return exercises.reduce((total, ex) => {
    const sets = parseSets(ex.sets);
    const reps = parseReps(ex.reps);
    return total + (sets * reps);
  }, 0);
}
