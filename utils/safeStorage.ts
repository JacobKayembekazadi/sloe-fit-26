/**
 * Safe localStorage and JSON utilities.
 * Handles QuotaExceededError, corrupted JSON, and unavailable storage.
 */

/**
 * Safely parse JSON with fallback.
 * Returns fallback if JSON is invalid or null.
 */
export function safeJSONParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    console.warn('[safeJSONParse] Failed to parse JSON, using fallback');
    return fallback;
  }
}

/**
 * Safely set a localStorage item.
 * Returns true if successful, false if quota exceeded or unavailable.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      console.warn(`[safeStorage] localStorage quota exceeded for key "${key}". Attempting cleanup.`);
      // Try to clear old cache entries and retry once
      try {
        evictOldestCacheEntries();
        localStorage.setItem(key, value);
        return true;
      } catch {
        console.error(`[safeStorage] Still cannot write after cleanup for key "${key}"`);
      }
    } else {
      console.error(`[safeStorage] Failed to write key "${key}":`, e);
    }
    return false;
  }
}

/**
 * Safely get and parse a localStorage JSON item.
 */
export function safeLocalStorageGetJSON<T>(key: string, fallback: T): T {
  try {
    return safeJSONParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

/**
 * Keys that must NEVER be evicted — contain user data that cannot be recovered.
 */
const NEVER_EVICT_KEYS = new Set([
  'offline_meal_queue',
  'offline_workout_queue',
  'sloefit_workout_draft',
]);

/**
 * Evict oldest sloefit_ cache entries to free space.
 * Removes cached plans and analysis data first (least critical).
 * Never evicts offline queues or workout drafts.
 *
 * FIX 1.3: Builds key list before iterating to avoid index skipping
 * during removal. Protects critical data from eviction.
 */
function evictOldestCacheEntries(): void {
  const evictionPriority = [
    'sloefit_body_analysis',
    'sloefit_weekly_nutrition',
    'sloefit_weekly_plan_',
  ];

  for (const prefix of evictionPriority) {
    // Build key list first to avoid index mutation during removal
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix) && !NEVER_EVICT_KEYS.has(key)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}
