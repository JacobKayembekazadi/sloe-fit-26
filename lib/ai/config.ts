/**
 * AI Configuration for Sloe Fit
 */

export const AI_CONFIG = {
  model: 'gemini-2.5-flash',
  visionTimeoutMs: 30000,
  textTimeoutMs: 30000,
};

/**
 * Get the appropriate model for a task
 */
export function getModelForTask(): string {
  return AI_CONFIG.model;
}

/**
 * Get the appropriate timeout for a task
 */
export function getTimeoutForTask(isVisionTask: boolean): number {
  return isVisionTask ? AI_CONFIG.visionTimeoutMs : AI_CONFIG.textTimeoutMs;
}
