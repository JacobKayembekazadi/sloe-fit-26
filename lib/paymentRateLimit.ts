/**
 * Rate limiting for payment endpoints.
 * Uses IP-based limiting to prevent checkout abuse.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 5;

// Simple in-memory store (resets per cold start, which is fine for abuse prevention)
const store = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Check rate limit for a payment request.
 * Returns true (and sends 429) if rate limited — caller should `return`.
 * Returns false if the request is allowed.
 */
export async function checkPaymentRateLimit(
  req: VercelRequest,
  res: VercelResponse
): Promise<boolean> {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return true;
  }

  return false;
}
