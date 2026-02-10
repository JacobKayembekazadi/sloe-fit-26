/**
 * Inngest AI Functions
 *
 * Long-running AI operations that benefit from:
 * - 15-minute timeout (vs 30s Edge limit)
 * - Built-in retry with exponential backoff
 * - Observability in Inngest dashboard
 *
 * These functions use the existing withFallback infrastructure
 * which already handles provider fallback and cost control.
 */

import { inngest } from './client';
import { withFallback } from '../ai';

/**
 * Analyze meal photo with provider fallback.
 * Retries up to 3 times with exponential backoff.
 */
export const analyzeMealPhoto = inngest.createFunction(
  {
    id: 'analyze-meal-photo',
    retries: 3,
    concurrency: {
      limit: 5, // Match plan limit
    },
  },
  { event: 'ai/photo.analyze' },
  async ({ event, step }) => {
    const { imageBase64, userGoal } = event.data;

    // Use step.run for durability - if this fails, Inngest will retry
    const result = await step.run('analyze-photo', async () => {
      const { data, provider } = await withFallback(
        p => p.analyzeMealPhoto(imageBase64, userGoal),
        r => r?.markdown?.startsWith('Error:') ?? false
      );
      return { data, provider };
    });

    return {
      success: true,
      data: result.data,
      provider: result.provider,
    };
  }
);

/**
 * Generate weekly training plan.
 * This is a complex operation that can take 30-60 seconds.
 */
export const generateWeeklyPlan = inngest.createFunction(
  {
    id: 'generate-weekly-plan',
    retries: 2,
    concurrency: {
      limit: 5, // Limit concurrent plan generations
    },
  },
  { event: 'ai/weekly-plan.generate' },
  async ({ event, step }) => {
    const { profile, recentWorkouts, recoveryPatterns, preferredSchedule } = event.data;

    const result = await step.run('generate-plan', async () => {
      const { data, provider } = await withFallback(
        p => p.planWeek({
          profile: profile as any,
          recentWorkouts: recentWorkouts as any,
          recoveryPatterns: recoveryPatterns as any,
          preferredSchedule,
        }),
        r => r === null
      );
      return { data, provider };
    });

    return {
      success: true,
      data: result.data,
      provider: result.provider,
    };
  }
);

/**
 * Analyze body composition photo.
 */
export const analyzeBodyPhoto = inngest.createFunction(
  {
    id: 'analyze-body-photo',
    retries: 3,
    concurrency: {
      limit: 5, // Match plan limit
    },
  },
  { event: 'ai/body.analyze' },
  async ({ event, step }) => {
    const { imageBase64 } = event.data;

    const result = await step.run('analyze-body', async () => {
      const { data, provider } = await withFallback(
        p => p.analyzeBodyPhoto(imageBase64),
        r => typeof r === 'string' && r.startsWith('Error:')
      );
      return { data, provider };
    });

    return {
      success: true,
      data: result.data,
      provider: result.provider,
    };
  }
);

// Export all functions for the serve endpoint
export const functions = [
  analyzeMealPhoto,
  generateWeeklyPlan,
  analyzeBodyPhoto,
];
