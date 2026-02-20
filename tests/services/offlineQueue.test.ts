import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  queueMeal,
  getQueuedMeals,
  removeFromQueue,
  incrementRetryCount,
  clearQueue,
  hasQueuedMeals,
  getQueuedCount,
  syncQueuedMeals,
} from '../../services/offlineQueue';

const makeMeal = (desc = 'Chicken breast', overrides = {}) => ({
  description: desc,
  calories: 300,
  protein: 30,
  carbs: 10,
  fats: 8,
  ...overrides,
});

describe('offlineQueue', () => {
  beforeEach(() => {
    clearQueue();
  });

  it('queues and retrieves a meal', () => {
    const { queued, meal } = queueMeal(makeMeal());
    expect(queued).toBe(true);
    expect(meal.payload.description).toBe('Chicken breast');

    const meals = getQueuedMeals();
    expect(meals).toHaveLength(1);
    expect(meals[0].id).toBe(meal.id);
  });

  it('deduplicates meals within 60s window', () => {
    const payload = makeMeal();
    queueMeal(payload);
    queueMeal(payload); // duplicate

    expect(getQueuedCount()).toBe(1);
  });

  it('allows same meal after different dates', () => {
    queueMeal(makeMeal('Rice', { date: '2026-01-01' }));
    queueMeal(makeMeal('Rice', { date: '2026-01-02' }));

    expect(getQueuedCount()).toBe(2);
  });

  it('removes a meal from the queue', () => {
    const { meal } = queueMeal(makeMeal());
    expect(hasQueuedMeals()).toBe(true);

    removeFromQueue(meal.id);
    expect(hasQueuedMeals()).toBe(false);
  });

  it('increments retry count', () => {
    const { meal } = queueMeal(makeMeal());
    expect(getQueuedMeals()[0].retryCount).toBe(0);

    incrementRetryCount(meal.id);
    expect(getQueuedMeals()[0].retryCount).toBe(1);

    incrementRetryCount(meal.id);
    expect(getQueuedMeals()[0].retryCount).toBe(2);
  });

  it('clears the entire queue', () => {
    queueMeal(makeMeal('A'));
    queueMeal(makeMeal('B'));
    expect(getQueuedCount()).toBe(2);

    clearQueue();
    expect(getQueuedCount()).toBe(0);
  });

  it('handles corrupted JSON gracefully', () => {
    localStorage.setItem('offline_meal_queue', '{invalid json');
    expect(getQueuedMeals()).toEqual([]);
  });

  it('scopes meals by userId', () => {
    queueMeal(makeMeal('User A meal'), 'user-a');
    queueMeal(makeMeal('User B meal'), 'user-b');

    const all = getQueuedMeals();
    expect(all).toHaveLength(2);
    expect(all[0].userId).toBe('user-a');
    expect(all[1].userId).toBe('user-b');
  });

  describe('syncQueuedMeals', () => {
    it('syncs meals and removes from queue on success', async () => {
      queueMeal(makeMeal('Sync me'), 'user-1');
      const saveMeal = vi.fn().mockResolvedValue(true);

      const synced = await syncQueuedMeals(saveMeal, 'user-1');

      expect(synced).toBe(1);
      expect(saveMeal).toHaveBeenCalledOnce();
      expect(getQueuedCount()).toBe(0);
    });

    it('only syncs meals for the given userId', async () => {
      queueMeal(makeMeal('User A'), 'user-a');
      queueMeal(makeMeal('User B'), 'user-b');
      const saveMeal = vi.fn().mockResolvedValue(true);

      await syncQueuedMeals(saveMeal, 'user-a');

      expect(saveMeal).toHaveBeenCalledOnce();
      expect(getQueuedCount()).toBe(1); // user-b's meal remains
    });

    it('drops meals after max retries', async () => {
      const { meal } = queueMeal(makeMeal('Retry me'), 'user-1');
      // Simulate 3 failed retries
      incrementRetryCount(meal.id);
      incrementRetryCount(meal.id);
      incrementRetryCount(meal.id);

      const saveMeal = vi.fn();
      await syncQueuedMeals(saveMeal, 'user-1');

      expect(saveMeal).not.toHaveBeenCalled();
      expect(getQueuedCount()).toBe(0); // dropped
    });

    it('increments retry on save failure', async () => {
      queueMeal(makeMeal('Fail me'), 'user-1');
      const saveMeal = vi.fn().mockResolvedValue(false);

      await syncQueuedMeals(saveMeal, 'user-1');

      expect(getQueuedMeals()[0].retryCount).toBe(1);
    });
  });
});
