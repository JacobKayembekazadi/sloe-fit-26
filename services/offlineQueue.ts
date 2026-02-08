/**
 * Offline Queue Service
 *
 * Queues meal entries when offline and syncs them when connection returns.
 * Prevents silent data loss from failed saves.
 */

import { safeJSONParse, safeLocalStorageSet } from '../utils/safeStorage';

const QUEUE_KEY = 'offline_meal_queue';

// ============================================================================
// Types
// ============================================================================

export interface QueuedMeal {
  id: string;
  userId?: string; // FIX 6.1: Scope queued meals to user to prevent cross-user sync
  payload: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    inputMethod?: 'photo' | 'text' | 'quick_add';
    photoUrl?: string;
    date?: string; // YYYY-MM-DD - preserves original date when queued offline
  };
  timestamp: number;
  retryCount: number;
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Get all queued meals from localStorage
 */
export function getQueuedMeals(): QueuedMeal[] {
  try {
    return safeJSONParse<QueuedMeal[]>(localStorage.getItem(QUEUE_KEY), []);
  } catch {
    return [];
  }
}

/**
 * Generate an idempotency key from meal payload to prevent duplicate queuing
 */
function getMealHash(payload: QueuedMeal['payload']): string {
  return `${payload.description}|${payload.date || ''}|${payload.calories}|${payload.protein}|${payload.carbs}|${payload.fats}`;
}

/**
 * Add a meal to the offline queue (with deduplication).
 * FIX 1.4: Returns { queued, meal } so callers can check if write succeeded.
 * FIX 6.1: Accepts userId to scope meals to the correct user.
 */
export function queueMeal(payload: QueuedMeal['payload'], userId?: string): { queued: boolean; meal: QueuedMeal } {
  const entry: QueuedMeal = {
    id: crypto.randomUUID(),
    userId,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };

  try {
    const queue = getQueuedMeals();

    // Dedup: skip if a meal with the same hash was queued in the last 60s
    const hash = getMealHash(payload);
    const isDuplicate = queue.some(m => {
      const existingHash = getMealHash(m.payload);
      const ageMs = Date.now() - m.timestamp;
      return existingHash === hash && ageMs < 60_000;
    });

    if (isDuplicate) {
      console.warn('[offlineQueue] Skipping duplicate meal:', payload.description);
      const existing = queue.find(m => getMealHash(m.payload) === hash)!;
      return { queued: true, meal: existing };
    }

    queue.push(entry);
    const saved = safeLocalStorageSet(QUEUE_KEY, JSON.stringify(queue));
    if (!saved) {
      console.error('[offlineQueue] Failed to queue meal — localStorage full or unavailable');
    }
    return { queued: saved, meal: entry };
  } catch {
    console.error('[offlineQueue] Failed to queue meal');
    return { queued: false, meal: entry };
  }
}

/**
 * Remove a meal from the queue (after successful sync)
 */
export function removeFromQueue(id: string): void {
  try {
    const queue = getQueuedMeals();
    const filtered = queue.filter(m => m.id !== id);
    safeLocalStorageSet(QUEUE_KEY, JSON.stringify(filtered));
  } catch {
    console.error('[offlineQueue] Failed to remove meal from queue');
  }
}

/**
 * Update retry count for a queued meal
 */
export function incrementRetryCount(id: string): void {
  try {
    const queue = getQueuedMeals();
    const updated = queue.map(m =>
      m.id === id ? { ...m, retryCount: m.retryCount + 1 } : m
    );
    safeLocalStorageSet(QUEUE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

/**
 * Clear the entire queue
 */
export function clearQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Check if there are queued meals
 */
export function hasQueuedMeals(): boolean {
  return getQueuedMeals().length > 0;
}

/**
 * Get count of queued meals
 */
export function getQueuedCount(): number {
  return getQueuedMeals().length;
}

// ============================================================================
// FIX 23: Legacy Queue Migration — tag untagged entries with current user
// ============================================================================

/**
 * One-time migration per user: tag any legacy queue entries (without userId) with the
 * current user's ID. Prevents cross-user data leaks on shared devices.
 * Uses per-user flag so different users on the same device each get their migration.
 */
export function migrateQueueUserId(userId: string): void {
  try {
    const flagKey = `offline_meal_queue_migrated_${userId}`;
    if (localStorage.getItem(flagKey) === 'true') return;
    const queue = getQueuedMeals();
    let migrated = false;
    const updated = queue.map(m => {
      if (!m.userId) {
        migrated = true;
        return { ...m, userId };
      }
      return m;
    });
    if (migrated) {
      safeLocalStorageSet(QUEUE_KEY, JSON.stringify(updated));
    }
    localStorage.setItem(flagKey, 'true');
  } catch {
    // Non-critical — will retry next startup
  }
}

// ============================================================================
// Sync Logic
// ============================================================================

// Maximum retries before giving up on a meal
const MAX_RETRIES = 3;

// Callback type for saving a meal (injected from useUserData)
export type SaveMealCallback = (payload: QueuedMeal['payload']) => Promise<boolean>;

/**
 * Attempt to sync all queued meals.
 * FIX 1.6: Saves queue state AFTER each individual meal to prevent
 * duplicates if app crashes mid-sync. Exceeded-retry meals are notified.
 * FIX 6.1: Only syncs meals matching the given userId (prevents cross-user leaks).
 * Returns number of successfully synced meals.
 */
export async function syncQueuedMeals(saveMeal: SaveMealCallback, userId?: string): Promise<number> {
  if (!navigator.onLine) {
    return 0;
  }

  const allQueue = getQueuedMeals();
  // FIX 6.1 + FIX 23: Strict user filter (legacy untagged entries migrated on startup)
  const queue = userId
    ? allQueue.filter(m => m.userId === userId)
    : allQueue;
  if (queue.length === 0) {
    return 0;
  }

  let synced = 0;
  let dropped = 0;

  for (const meal of queue) {
    // Skip meals that have exceeded retry limit
    if (meal.retryCount >= MAX_RETRIES) {
      console.warn(`[offlineQueue] Meal "${meal.payload.description}" exceeded ${MAX_RETRIES} retries — dropped`);
      removeFromQueue(meal.id);
      dropped++;
      continue;
    }

    try {
      const success = await saveMeal(meal.payload);
      if (success) {
        // Remove immediately after confirmed DB save (atomic per-item)
        removeFromQueue(meal.id);
        synced++;
      } else {
        incrementRetryCount(meal.id);
      }
    } catch {
      incrementRetryCount(meal.id);
    }
  }

  if (dropped > 0) {
    console.warn(`[offlineQueue] ${dropped} meal(s) dropped after max retries`);
  }

  return synced;
}

// ============================================================================
// Network Status Utilities
// ============================================================================

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Register a callback to be called when network comes back online
 */
export function onOnline(callback: () => void): () => void {
  const handler = () => {
    if (navigator.onLine) {
      callback();
    }
  };

  window.addEventListener('online', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handler);
  };
}
