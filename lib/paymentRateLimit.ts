/**
 * Payment Endpoint Rate Limiter
 *
 * Prevents checkout abuse: 5 req/min + 20 req/day per IP.
 * Uses Upstash Redis (same as lib/ai/rateLimit.ts), falls back to in-memory Map.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const MAX_PER_MINUTE = 5;
const MAX_PER_DAY = 20;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

let minuteLimiter: Ratelimit | null = null;
let dailyLimiter: Ratelimit | null = null;

if (USE_REDIS) {
  const redis = new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! });

  minuteLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_PER_MINUTE, '1m'),
    prefix: 'sloefit:payment:minute',
  });

  dailyLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_PER_DAY, '1d'),
    prefix: 'sloefit:payment:daily',
  });
}

// In-memory fallback
const memMinute = new Map<string, { count: number; resetAt: number }>();
const memDaily = new Map<string, { count: number; date: string }>();

function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-vercel-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp;
  return 'unknown';
}

/**
 * Check payment rate limit. Returns true if blocked (already sent 429).
 * Returns false if request is within limits and should proceed.
 */
export async function checkPaymentRateLimit(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const ip = getClientIP(req);
  const key = `payment:${ip}`;

  if (minuteLimiter && dailyLimiter) {
    const [minResult, dayResult] = await Promise.all([
      minuteLimiter.limit(key),
      dailyLimiter.limit(key),
    ]);

    if (!minResult.success) {
      const retryAfter = Math.ceil(Math.max(0, minResult.reset - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many checkout attempts. Please try again later.' });
      return true;
    }

    if (!dayResult.success) {
      const retryAfter = Math.ceil(Math.max(0, dayResult.reset - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Daily checkout limit reached. Please try again tomorrow.' });
      return true;
    }

    return false;
  }

  // In-memory fallback
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  // Per-minute check
  const minEntry = memMinute.get(key);
  if (!minEntry || minEntry.resetAt < now) {
    memMinute.set(key, { count: 1, resetAt: now + 60_000 });
  } else {
    minEntry.count++;
    if (minEntry.count > MAX_PER_MINUTE) {
      const retryAfter = Math.ceil((minEntry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many checkout attempts. Please try again later.' });
      return true;
    }
  }

  // Per-day check
  const dayEntry = memDaily.get(key);
  if (!dayEntry || dayEntry.date !== today) {
    memDaily.set(key, { count: 1, date: today });
  } else {
    dayEntry.count++;
    if (dayEntry.count > MAX_PER_DAY) {
      res.setHeader('Retry-After', '3600');
      res.status(429).json({ error: 'Daily checkout limit reached. Please try again tomorrow.' });
      return true;
    }
  }

  return false;
}
