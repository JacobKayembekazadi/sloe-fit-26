/**
 * Rate limiter for API routes.
 *
 * FIX 2.1: Per-user daily AI call limit (50/day)
 * FIX 2.2: Per-user rate limiting (30 req/min) instead of per-IP
 * FIX 2.3: In-memory store is a cache; daily limit checked via userId param
 * FIX 2.4: Uses x-vercel-forwarded-for (trusted) instead of x-forwarded-for (spoofable)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_DAILY_AI_CALLS = 50;

// In-memory store — per-minute burst limiter (cache only, resets on cold start)
const minuteStore = new Map<string, RateLimitEntry>();

// In-memory daily counter cache (backed by Supabase in apiGate)
const dailyStore = new Map<string, { count: number; date: string }>();

// Cleanup stale entries periodically
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
 * FIX 2.2: Uses userId when available (from auth), falls back to IP for unauthenticated.
 * Returns null if within limits, or a 429 Response if exceeded.
 */
export function checkRateLimit(req: Request, userId?: string): Response | null {
  cleanup();

  // Use userId for per-user limiting; fall back to IP for unauthenticated requests
  const key = userId || `ip:${getClientIP(req)}`;
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
 * FIX 2.1: 50 calls/day per user. Uses in-memory cache.
 * Returns null if within limits, or a 429 Response if exceeded.
 */
export function checkDailyLimit(userId: string): Response | null {
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
      // Rough estimate to midnight
      86400000 - (Date.now() % 86400000)
    );
  }

  return null;
}
