/**
 * Offline Queue Service
 *
 * Queues meal entries when offline and syncs them when connection returns.
 * Prevents silent data loss from failed saves.
 */

const QUEUE_KEY = 'offline_meal_queue';

// ============================================================================
// Types
// ============================================================================

export interface QueuedMeal {
  id: string;
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
    const stored = localStorage.getItem(QUEUE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Add a meal to the offline queue
 */
export function queueMeal(payload: QueuedMeal['payload']): QueuedMeal {
  const queued: QueuedMeal = {
    id: crypto.randomUUID(),
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };

  try {
    const queue = getQueuedMeals();
    queue.push(queued);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage failed - meal will be lost
    console.error('[offlineQueue] Failed to queue meal');
  }

  return queued;
}

/**
 * Remove a meal from the queue (after successful sync)
 */
export function removeFromQueue(id: string): void {
  try {
    const queue = getQueuedMeals();
    const filtered = queue.filter(m => m.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
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
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
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
// Sync Logic
// ============================================================================

// Maximum retries before giving up on a meal
const MAX_RETRIES = 3;

// Callback type for saving a meal (injected from useUserData)
export type SaveMealCallback = (payload: QueuedMeal['payload']) => Promise<boolean>;

/**
 * Attempt to sync all queued meals
 * Returns number of successfully synced meals
 */
export async function syncQueuedMeals(saveMeal: SaveMealCallback): Promise<number> {
  if (!navigator.onLine) {
    return 0;
  }

  const queue = getQueuedMeals();
  if (queue.length === 0) {
    return 0;
  }

  let synced = 0;

  for (const meal of queue) {
    // Skip meals that have exceeded retry limit
    if (meal.retryCount >= MAX_RETRIES) {
      console.warn(`[offlineQueue] Meal ${meal.id} exceeded max retries, removing`);
      removeFromQueue(meal.id);
      continue;
    }

    try {
      const success = await saveMeal(meal.payload);
      if (success) {
        removeFromQueue(meal.id);
        synced++;
      } else {
        incrementRetryCount(meal.id);
      }
    } catch {
      incrementRetryCount(meal.id);
    }
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
