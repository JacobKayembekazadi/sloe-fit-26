/**
 * AI Configuration for Sloe Fit
 *
 * Reads GEMINI_3_MODEL env var so the model can be changed via Vercel dashboard
 * without redeploying. Falls back to gemini-2.5-flash.
 */

export const AI_CONFIG = {
  model: process.env.GEMINI_3_MODEL || 'gemini-2.5-flash',
  visionTimeoutMs: 30000,
  textTimeoutMs: 30000,
};

/**
 * Get the appropriate model for a task
 */
export function getModelForTask(): string {
  return process.env.GEMINI_3_MODEL || AI_CONFIG.model;
}

/**
 * Get the appropriate timeout for a task
 */
export function getTimeoutForTask(isVisionTask: boolean): number {
  return isVisionTask ? AI_CONFIG.visionTimeoutMs : AI_CONFIG.textTimeoutMs;
}
