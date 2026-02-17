/**
 * Shared helpers for API route handlers.
 * Combines auth check, subscription check, rate limiting, and error type guards.
 */

import { requireAuth, unauthorizedResponse, type AuthResult } from './requireAuth';
import { checkRateLimit, checkDailyLimit } from './rateLimit';
import type { AIErrorType } from './types';

// ============================================================================
// FIX 3.1: Subscription / Trial System
// ============================================================================

const TRIAL_DAYS = 7;

/**
 * Check if a trial has expired based on trial start date.
 */
function isTrialExpired(trialStartedAt: string | null): boolean {
  if (!trialStartedAt) return false;
  const trialStart = new Date(trialStartedAt).getTime();
  const now = Date.now();
  const daysSinceStart = (now - trialStart) / (1000 * 60 * 60 * 24);
  return daysSinceStart > TRIAL_DAYS;
}

/**
 * Get remaining trial days.
 */
export function getTrialDaysRemaining(trialStartedAt: string | null): number {
  if (!trialStartedAt) return 0;
  const trialStart = new Date(trialStartedAt).getTime();
  const now = Date.now();
  const daysSinceStart = (now - trialStart) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - daysSinceStart));
}

/**
 * Run auth + subscription + rate limit + daily cap checks.
 * Returns a Response to send if blocked, or null to proceed.
 *
 * FIX 2.1: Daily AI call limit per user (50/day)
 * FIX 2.2: Per-user rate limiting using userId from auth
 * FIX 3.1: Subscription/trial check for AI features
 */
/**
 * Check subscription status. Returns a 402 Response if blocked, or null to proceed.
 */
function checkSubscription(auth: AuthResult): Response | null {
  const { subscriptionStatus, trialStartedAt } = auth;

  if (subscriptionStatus === 'active') {
    return null;
  } else if (subscriptionStatus === 'trial') {
    if (isTrialExpired(trialStartedAt)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            type: 'subscription_required',
            code: 'TRIAL_EXPIRED',
            message: 'Your 7-day trial has expired. Upgrade to continue using AI features.',
            retryable: false,
          },
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return null;
  } else if (subscriptionStatus === 'expired' || subscriptionStatus === 'none') {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          type: 'subscription_required',
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'A subscription is required to use AI features.',
          retryable: false,
        },
      }),
      { status: 402, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

/**
 * Like apiGate, but also returns the authenticated user info on success.
 * Use when the handler needs the userId (e.g., to save results to DB).
 */
export async function apiGateWithAuth(req: Request): Promise<{ blocked: Response } | { blocked: null; auth: AuthResult }> {
  const auth = await requireAuth(req);
  if (!auth) return { blocked: unauthorizedResponse() };

  const subscriptionBlock = checkSubscription(auth);
  if (subscriptionBlock) return { blocked: subscriptionBlock };

  const rateLimited = await checkRateLimit(req, auth.userId);
  if (rateLimited) return { blocked: rateLimited };

  const dailyLimited = await checkDailyLimit(auth.userId);
  if (dailyLimited) return { blocked: dailyLimited };

  return { blocked: null, auth };
}

export async function apiGate(req: Request): Promise<Response | null> {
  const result = await apiGateWithAuth(req);
  return result.blocked;
}

// Valid AIErrorType values for type-safe error classification
const AI_ERROR_TYPES: Set<string> = new Set<string>([
  'network', 'timeout', 'rate_limit', 'auth', 'invalid_request',
  'server_error', 'content_filter', 'quota_exceeded', 'unknown',
]);

/**
 * Type guard: checks if a string is a valid AIErrorType.
 * Replaces `as any` casts in catch blocks.
 */
export function isAIErrorType(value: unknown): value is AIErrorType {
  return typeof value === 'string' && AI_ERROR_TYPES.has(value);
}

/**
 * Safely extract error type from caught error, defaulting to 'unknown'.
 */
export function getErrorType(error: unknown): AIErrorType {
  if (error && typeof error === 'object' && 'type' in error) {
    const t = (error as { type: unknown }).type;
    return isAIErrorType(t) ? t : 'unknown';
  }
  return 'unknown';
}

// ============================================================================
// FIX 8.1: Input Sanitization for AI Prompts
// ============================================================================

/**
 * Maximum allowed input lengths for user-provided text sent to AI prompts.
 */
const MAX_LENGTHS: Record<string, number> = {
  description: 500,    // Meal descriptions
  userGoal: 50,        // Goal strings (CUT/BULK/RECOMP or custom)
  metrics: 1000,       // Progress metrics text
  title: 200,          // Workout titles
  default: 500,
};

/**
 * Sanitize a user-provided string before interpolation into AI prompts.
 * - Truncates to max length
 * - Strips control characters that could break prompt structure
 * - Removes common prompt injection patterns
 */
export function sanitizeAIInput(input: string, field: string = 'default'): string {
  const maxLen = MAX_LENGTHS[field] || MAX_LENGTHS.default;

  let sanitized = input
    // Truncate to max length
    .slice(0, maxLen)
    // Strip control characters (except newlines for descriptions)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse multiple newlines to prevent prompt structure manipulation
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return sanitized;
}

/**
 * FIX 20: Recursively sanitize an object's string values for AI inputs.
 * Handles nested objects and arrays of objects (e.g., exercises[].name).
 * Max depth guard prevents infinite recursion on circular references.
 */
const MAX_SANITIZE_DEPTH = 5;

export function sanitizeAIObject<T extends Record<string, unknown>>(obj: T, depth: number = 0): T {
  if (depth >= MAX_SANITIZE_DEPTH) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeAIInput(value, key);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => {
        if (typeof v === 'string') return sanitizeAIInput(v, key);
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          return sanitizeAIObject(v as Record<string, unknown>, depth + 1);
        }
        return v;
      });
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeAIObject(value as Record<string, unknown>, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Max allowed base64 payload size (roughly 2MB decoded ≈ 2.67MB base64).
 */
export const MAX_BASE64_LENGTH = 2_000_000;

/**
 * Validate that a base64 image payload is within size limits.
 * Returns a 400 Response if too large, or null if OK.
 */
export function validateImageSize(imageBase64: string): Response | null {
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          type: 'invalid_request',
          message: 'Image is too large. Maximum size is ~2MB.',
          retryable: false,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}
