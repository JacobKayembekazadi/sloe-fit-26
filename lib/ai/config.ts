/**
 * AI Configuration for Sloe Fit
 *
 * Controls Gemini 3 Flash Agentic Vision feature rollout.
 * Set GEMINI_3_ENABLED=true in Vercel to enable code execution for vision tasks.
 */

export const AI_CONFIG = {
  // Feature flag for Gemini 3 with Agentic Vision
  gemini3Enabled: process.env.GEMINI_3_ENABLED === 'true',

  // Model identifiers
  gemini3Model: process.env.GEMINI_3_MODEL || 'gemini-3-flash-preview',
  gemini2Model: 'gemini-2.0-flash-001',  // Stable fallback

  // Timeouts (Agentic Vision is slower due to Think → Act → Observe loop)
  gemini3VisionTimeoutMs: 60000,  // 60s for agentic loop
  gemini2VisionTimeoutMs: 30000,  // 30s for single-pass
  textTimeoutMs: 30000,           // 30s for text-only tasks

  // Circuit breaker settings
  circuitBreaker: {
    failureThreshold: 3,          // Open circuit after 3 failures
    recoveryTimeMs: 60000,        // Try again after 60s
  },
};

// Import circuit breaker (lazy to avoid circular deps)
let _shouldBypassGemini3: (() => boolean) | null = null;

function getBypassCheck(): () => boolean {
  if (!_shouldBypassGemini3) {
    // Dynamic import to avoid circular dependency
    try {
      const cb = require('./circuitBreaker');
      _shouldBypassGemini3 = cb.shouldBypassGemini3;
    } catch {
      _shouldBypassGemini3 = () => false;
    }
  }
  return _shouldBypassGemini3;
}

/**
 * Check if Gemini 3 is available (enabled and not circuit-broken)
 */
export function isGemini3Available(): boolean {
  if (!AI_CONFIG.gemini3Enabled) return false;
  const bypassCheck = getBypassCheck();
  return !bypassCheck();
}

/**
 * Get the appropriate model for a task
 */
export function getModelForTask(isVisionTask: boolean): string {
  if (isVisionTask && isGemini3Available()) {
    return AI_CONFIG.gemini3Model;
  }
  return AI_CONFIG.gemini2Model;
}

/**
 * Get the appropriate timeout for a task
 */
export function getTimeoutForTask(isVisionTask: boolean): number {
  if (isVisionTask && isGemini3Available()) {
    return AI_CONFIG.gemini3VisionTimeoutMs;
  }
  if (isVisionTask) {
    return AI_CONFIG.gemini2VisionTimeoutMs;
  }
  return AI_CONFIG.textTimeoutMs;
}

/**
 * Check if code execution should be enabled for this request
 */
export function shouldEnableCodeExecution(isVisionTask: boolean): boolean {
  return isVisionTask && isGemini3Available();
}
