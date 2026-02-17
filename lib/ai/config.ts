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
 * Estimated cost per vision analysis call by provider (USD).
 * Used for spend tracking and alerts — not billing.
 */
export const COST_PER_VISION_CALL: Record<string, number> = {
  google: 0.015,   // Gemini 2.5 Flash vision
  openai: 0.03,    // GPT-4o-mini vision
  anthropic: 0.05, // Claude vision
};

/** Daily spend warning threshold (USD). Log warning if exceeded. */
export const DAILY_SPEND_WARN_USD = parseFloat(process.env.AI_DAILY_SPEND_WARN || '5');

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
