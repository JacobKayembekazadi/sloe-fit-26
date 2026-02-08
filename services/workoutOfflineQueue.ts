/**
 * Offline Queue for Workouts
 *
 * Queues completed workouts when save fails (offline or server error).
 * Syncs when connection returns. Mirrors offlineQueue.ts pattern for meals.
 */

import { safeJSONParse, safeLocalStorageSet } from '../utils/safeStorage';
import type { ExerciseLog } from '../App';

const QUEUE_KEY = 'offline_workout_queue';

// ============================================================================
// Types
// ============================================================================

export interface QueuedWorkout {
  id: string;
  userId?: string; // FIX 6.1: Scope queued workouts to user
  payload: {
    title: string;
    exercises: ExerciseLog[];
    rating: number;
    completedAt: number; // timestamp when workout was finished
  };
  timestamp: number;
  retryCount: number;
  status: 'queued' | 'syncing';
}

// ============================================================================
// Queue Management
// ============================================================================

export function getQueuedWorkouts(): QueuedWorkout[] {
  try {
    return safeJSONParse<QueuedWorkout[]>(localStorage.getItem(QUEUE_KEY), []);
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedWorkout[]): boolean {
  return safeLocalStorageSet(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Add a workout to the offline queue.
 * Returns false if localStorage is full and write failed.
 */
export function queueWorkout(payload: QueuedWorkout['payload'], userId?: string): { queued: boolean; id: string } {
  const id = crypto.randomUUID();
  const entry: QueuedWorkout = {
    id,
    userId,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'queued',
  };

  const queue = getQueuedWorkouts();

  // Dedup: skip if same title + completedAt within 60s
  const isDuplicate = queue.some(w => {
    return w.payload.title === payload.title &&
      Math.abs(w.payload.completedAt - payload.completedAt) < 60_000;
  });

  if (isDuplicate) {
    return { queued: true, id: queue.find(w => w.payload.title === payload.title)!.id };
  }

  queue.push(entry);
  const saved = saveQueue(queue);

  if (!saved) {
    console.error('[workoutOfflineQueue] Failed to queue workout — localStorage full');
  }

  return { queued: saved, id };
}

export function removeFromQueue(id: string): void {
  const queue = getQueuedWorkouts().filter(w => w.id !== id);
  saveQueue(queue);
}

export function hasQueuedWorkouts(): boolean {
  return getQueuedWorkouts().length > 0;
}

export function getQueuedWorkoutCount(): number {
  return getQueuedWorkouts().length;
}

// ============================================================================
// Sync Logic
// ============================================================================

const MAX_RETRIES = 3;

export type SaveWorkoutCallback = (
  title: string,
  exercises: ExerciseLog[],
  rating?: number
) => Promise<boolean>;

/**
 * Sync all queued workouts. Saves queue after EACH item to prevent
 * duplicates if the app crashes mid-sync.
 */
/**
 * FIX 23: One-time migration — tag untagged workout entries with current userId.
 */
export function migrateWorkoutQueueUserId(userId: string): void {
  try {
    const flagKey = `offline_workout_queue_migrated_${userId}`;
    if (localStorage.getItem(flagKey) === 'true') return;
    const queue = getQueuedWorkouts();
    let migrated = false;
    const updated = queue.map(w => {
      if (!w.userId) {
        migrated = true;
        return { ...w, userId };
      }
      return w;
    });
    if (migrated) saveQueue(updated);
    localStorage.setItem(flagKey, 'true');
  } catch { /* non-critical */ }
}

export async function syncQueuedWorkouts(saveWorkout: SaveWorkoutCallback, userId?: string): Promise<number> {
  if (!navigator.onLine) return 0;

  const allQueue = getQueuedWorkouts();
  // FIX 6.1 + FIX 23: Strict user filter (legacy entries migrated on startup)
  const queue = userId
    ? allQueue.filter(w => w.userId === userId)
    : allQueue;
  if (queue.length === 0) return 0;

  let synced = 0;

  for (const workout of queue) {
    if (workout.retryCount >= MAX_RETRIES) {
      removeFromQueue(workout.id);
      continue;
    }

    // Mark as syncing before attempting
    const currentQueue = getQueuedWorkouts();
    const updated = currentQueue.map(w =>
      w.id === workout.id ? { ...w, status: 'syncing' as const } : w
    );
    saveQueue(updated);

    try {
      const success = await saveWorkout(
        workout.payload.title,
        workout.payload.exercises,
        workout.payload.rating
      );

      if (success) {
        // Remove from queue immediately after confirmed save
        removeFromQueue(workout.id);
        synced++;
      } else {
        // Increment retry and save queue state
        const q = getQueuedWorkouts();
        const retried = q.map(w =>
          w.id === workout.id ? { ...w, retryCount: w.retryCount + 1, status: 'queued' as const } : w
        );
        saveQueue(retried);
      }
    } catch {
      const q = getQueuedWorkouts();
      const retried = q.map(w =>
        w.id === workout.id ? { ...w, retryCount: w.retryCount + 1, status: 'queued' as const } : w
      );
      saveQueue(retried);
    }
  }

  return synced;
}

/**
 * Register callback for when network comes back online
 */
export function onOnlineWorkoutSync(callback: () => void): () => void {
  const handler = () => {
    if (navigator.onLine) callback();
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
