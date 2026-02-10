/**
 * Rate limiter for API routes.
 *
 * Uses Upstash Redis for persistent rate limiting that survives Edge Function cold starts.
 * Falls back to in-memory limiting if Redis is not configured.
 *
 * FIX 2.1: Per-user daily AI call limit (50/day)
 * FIX 2.2: Per-user rate limiting (30 req/min) instead of per-IP
 * FIX 2.4: Uses x-vercel-forwarded-for (trusted) instead of x-forwarded-for (spoofable)
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_DAILY_AI_CALLS = 50;

// Check if Upstash is configured
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// Redis client (only created if configured)
let redis: Redis | null = null;
let minuteRateLimiter: Ratelimit | null = null;
let dailyRateLimiter: Ratelimit | null = null;

if (USE_REDIS) {
  redis = new Redis({
    url: UPSTASH_URL!,
    token: UPSTASH_TOKEN!,
  });

  // Per-minute rate limiter: 30 requests per minute sliding window
  minuteRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_MINUTE, '1m'),
    prefix: 'sloefit:ratelimit:minute',
    analytics: true,
  });

  // Daily rate limiter: 50 requests per day
  dailyRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_DAILY_AI_CALLS, '1d'),
    prefix: 'sloefit:ratelimit:daily',
    analytics: true,
  });
}

// Fallback in-memory stores (used when Redis not configured)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const minuteStore = new Map<string, RateLimitEntry>();
const dailyStore = new Map<string, { count: number; date: string }>();

// Cleanup stale entries periodically (only for in-memory fallback)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 300_000; // 5 minutes

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of minuteStore) {
    if (entry.resetAt < now) {
      minuteStore.delete(key);
    }
  }
}

/**
 * Extract client IP from TRUSTED headers only.
 * FIX 2.4: Prefer x-vercel-forwarded-for (set by Vercel, not spoofable).
 */
function getClientIP(req: Request): string {
  return (
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function make429Response(message: string, retryAfterMs: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        type: 'rate_limit',
        message,
        retryable: true,
        retryAfterMs,
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      },
    }
  );
}

/**
 * Check per-minute rate limit.
 * Uses Redis if configured, falls back to in-memory.
 * Returns null if within limits, or a 429 Response if exceeded.
 */
export async function checkRateLimit(req: Request, userId?: string): Promise<Response | null> {
  const key = userId || `ip:${getClientIP(req)}`;

  // Use Redis rate limiter if available
  if (minuteRateLimiter) {
    const { success, reset } = await minuteRateLimiter.limit(key);
    if (!success) {
      const retryAfterMs = Math.max(0, reset - Date.now());
      return make429Response('Too many requests. Please try again later.', retryAfterMs);
    }
    return null;
  }

  // Fallback to in-memory
  cleanup();
  const now = Date.now();
  const entry = minuteStore.get(key);

  if (!entry || entry.resetAt < now) {
    minuteStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS_PER_MINUTE) {
    return make429Response(
      'Too many requests. Please try again later.',
      entry.resetAt - now
    );
  }

  return null;
}

/**
 * Check daily AI call limit for a user.
 * Uses Redis if configured, falls back to in-memory.
 * Returns null if within limits, or a 429 Response if exceeded.
 */
export async function checkDailyLimit(userId: string): Promise<Response | null> {
  // Use Redis rate limiter if available
  if (dailyRateLimiter) {
    const { success, reset } = await dailyRateLimiter.limit(userId);
    if (!success) {
      const retryAfterMs = Math.max(0, reset - Date.now());
      return make429Response(
        `Daily AI limit reached (${MAX_DAILY_AI_CALLS} calls/day). Resets at midnight.`,
        retryAfterMs
      );
    }
    return null;
  }

  // Fallback to in-memory
  const today = new Date().toISOString().split('T')[0];
  const entry = dailyStore.get(userId);

  if (!entry || entry.date !== today) {
    dailyStore.set(userId, { count: 1, date: today });
    return null;
  }

  entry.count++;

  if (entry.count > MAX_DAILY_AI_CALLS) {
    return make429Response(
      `Daily AI limit reached (${MAX_DAILY_AI_CALLS} calls/day). Resets at midnight.`,
      86400000 - (Date.now() % 86400000)
    );
  }

  return null;
}

/**
 * Check if Redis rate limiting is active.
 * Useful for health checks and debugging.
 */
export function isRedisEnabled(): boolean {
  return USE_REDIS;
}
