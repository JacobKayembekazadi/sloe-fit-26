/**
 * Client-Side Rate Limiter
 *
 * Features:
 * - Per-operation rate limiting
 * - Configurable limits (max requests per time window)
 * - Request queuing for overflow
 * - User feedback when rate limited
 * - Persistent limits in localStorage with expiry
 * - Sliding window algorithm
 */

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** If true, queue requests that exceed the limit (default: false) */
  queueOverflow?: boolean;
  /** Maximum queue size (default: 10) */
  maxQueueSize?: number;
}

export interface RateLimitStatus {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Number of remaining requests in current window */
  remaining: number;
  /** Time until rate limit resets (ms) */
  resetIn: number;
  /** If queued, estimated wait time (ms) */
  queueWaitTime?: number;
  /** Human-readable message */
  message?: string;
}

interface StoredRateLimit {
  timestamps: number[];
  lastCleanup: number;
}

interface QueuedRequest {
  id: string;
  operation: string;
  resolve: (value: boolean) => void;
  reject: (reason: Error) => void;
  timestamp: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_MODE = import.meta.env.DEV;
const STORAGE_KEY_PREFIX = 'sloe_fit_ratelimit_';
const CLEANUP_INTERVAL_MS = 60000; // 1 minute

// Default rate limits for different operations
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // AI operations (expensive)
  'ai_meal_analysis': { maxRequests: 10, windowMs: 60000, queueOverflow: true },
  'ai_workout_generation': { maxRequests: 5, windowMs: 60000, queueOverflow: true },
  'ai_body_analysis': { maxRequests: 5, windowMs: 60000, queueOverflow: true },
  'ai_transcription': { maxRequests: 10, windowMs: 60000, queueOverflow: true },

  // Upload operations
  'upload_image': { maxRequests: 20, windowMs: 60000, queueOverflow: false },
  'upload_progress_photos': { maxRequests: 5, windowMs: 60000, queueOverflow: false },

  // Database operations (more lenient)
  'db_read': { maxRequests: 100, windowMs: 60000, queueOverflow: false },
  'db_write': { maxRequests: 50, windowMs: 60000, queueOverflow: false },

  // Shopify operations
  'shopify_api': { maxRequests: 30, windowMs: 60000, queueOverflow: true },

  // General purpose
  'default': { maxRequests: 60, windowMs: 60000, queueOverflow: false },
};

// ============================================================================
// State
// ============================================================================

const requestQueues = new Map<string, QueuedRequest[]>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Utility Functions
// ============================================================================

function getStorageKey(operation: string): string {
  return `${STORAGE_KEY_PREFIX}${operation}`;
}

function loadFromStorage(operation: string): StoredRateLimit {
  try {
    const stored = localStorage.getItem(getStorageKey(operation));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    if (DEBUG_MODE) {
      console.warn(`[RateLimiter] Failed to load ${operation} from storage:`, error);
    }
  }
  return { timestamps: [], lastCleanup: Date.now() };
}

function saveToStorage(operation: string, data: StoredRateLimit): void {
  try {
    localStorage.setItem(getStorageKey(operation), JSON.stringify(data));
  } catch (error) {
    if (DEBUG_MODE) {
      console.warn(`[RateLimiter] Failed to save ${operation} to storage:`, error);
    }
  }
}

function cleanupExpiredTimestamps(
  timestamps: number[],
  windowMs: number,
  now: number
): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter(ts => ts > cutoff);
}

function getConfig(operation: string): RateLimitConfig {
  return DEFAULT_RATE_LIMITS[operation] || DEFAULT_RATE_LIMITS['default'];
}

function formatWaitTime(ms: number): string {
  if (ms < 1000) {
    return 'less than a second';
  }
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Queue Management
// ============================================================================

function processQueue(operation: string): void {
  const queue = requestQueues.get(operation);
  if (!queue || queue.length === 0) return;

  const config = getConfig(operation);
  const status = checkRateLimit(operation, config);

  if (status.allowed) {
    const request = queue.shift();
    if (request) {
      consumeRateLimit(operation);
      request.resolve(true);

      if (DEBUG_MODE) {
        console.log(`[RateLimiter] Processed queued request for ${operation}`);
      }

      // Process next item after a small delay
      if (queue.length > 0) {
        setTimeout(() => processQueue(operation), 100);
      }
    }
  } else {
    // Schedule next check
    setTimeout(() => processQueue(operation), Math.min(status.resetIn, 1000));
  }
}

function enqueue(operation: string, config: RateLimitConfig): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const queue = requestQueues.get(operation) || [];

    if (queue.length >= (config.maxQueueSize || 10)) {
      reject(new Error('Rate limit queue is full'));
      return;
    }

    const request: QueuedRequest = {
      id: generateRequestId(),
      operation,
      resolve,
      reject,
      timestamp: Date.now(),
    };

    queue.push(request);
    requestQueues.set(operation, queue);

    if (DEBUG_MODE) {
      console.log(`[RateLimiter] Queued request for ${operation}, queue size: ${queue.length}`);
    }

    // Start queue processing if not already running
    processQueue(operation);
  });
}

// ============================================================================
// Core Rate Limiting Functions
// ============================================================================

function checkRateLimit(operation: string, config: RateLimitConfig): RateLimitStatus {
  const now = Date.now();
  const stored = loadFromStorage(operation);

  // Clean up old timestamps
  const validTimestamps = cleanupExpiredTimestamps(
    stored.timestamps,
    config.windowMs,
    now
  );

  const count = validTimestamps.length;
  const remaining = Math.max(0, config.maxRequests - count);
  const allowed = count < config.maxRequests;

  // Calculate reset time
  let resetIn = 0;
  if (validTimestamps.length > 0) {
    const oldestTimestamp = Math.min(...validTimestamps);
    resetIn = Math.max(0, oldestTimestamp + config.windowMs - now);
  }

  // Calculate queue wait time if applicable
  const queue = requestQueues.get(operation) || [];
  const queueWaitTime = queue.length > 0
    ? (queue.length + 1) * (config.windowMs / config.maxRequests)
    : undefined;

  let message: string | undefined;
  if (!allowed) {
    message = `Rate limit exceeded. Try again in ${formatWaitTime(resetIn)}.`;
  }

  return {
    allowed,
    remaining,
    resetIn,
    queueWaitTime,
    message,
  };
}

function consumeRateLimit(operation: string): void {
  const config = getConfig(operation);
  const now = Date.now();
  const stored = loadFromStorage(operation);

  // Clean up old timestamps
  const validTimestamps = cleanupExpiredTimestamps(
    stored.timestamps,
    config.windowMs,
    now
  );

  // Add current timestamp
  validTimestamps.push(now);

  // Save back to storage
  saveToStorage(operation, {
    timestamps: validTimestamps,
    lastCleanup: now,
  });

  if (DEBUG_MODE) {
    const remaining = config.maxRequests - validTimestamps.length;
    console.log(`[RateLimiter] Consumed ${operation}, ${remaining} remaining`);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Rate limiter instance with methods for checking and consuming rate limits
 */
export const rateLimiter = {
  /**
   * Check if an operation is allowed under rate limits
   */
  check(operation: string, config?: RateLimitConfig): RateLimitStatus {
    const effectiveConfig = config || getConfig(operation);
    return checkRateLimit(operation, effectiveConfig);
  },

  /**
   * Consume a rate limit slot for an operation
   */
  consume(operation: string): void {
    consumeRateLimit(operation);
  },

  /**
   * Get remaining requests for an operation
   */
  getRemaining(operation: string): number {
    const config = getConfig(operation);
    const status = checkRateLimit(operation, config);
    return status.remaining;
  },

  /**
   * Reset rate limit for an operation
   */
  reset(operation: string): void {
    try {
      localStorage.removeItem(getStorageKey(operation));
      requestQueues.delete(operation);
      if (DEBUG_MODE) {
        console.log(`[RateLimiter] Reset rate limit for ${operation}`);
      }
    } catch (error) {
      if (DEBUG_MODE) {
        console.warn(`[RateLimiter] Failed to reset ${operation}:`, error);
      }
    }
  },

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      requestQueues.clear();
      if (DEBUG_MODE) {
        console.log(`[RateLimiter] Reset all rate limits (${keysToRemove.length} cleared)`);
      }
    } catch (error) {
      if (DEBUG_MODE) {
        console.warn('[RateLimiter] Failed to reset all:', error);
      }
    }
  },

  /**
   * Get status of all rate limits
   */
  getStatus(): Record<string, RateLimitStatus> {
    const status: Record<string, RateLimitStatus> = {};
    for (const operation of Object.keys(DEFAULT_RATE_LIMITS)) {
      status[operation] = this.check(operation);
    }
    return status;
  },

  /**
   * Get queue length for an operation
   */
  getQueueLength(operation: string): number {
    const queue = requestQueues.get(operation);
    return queue ? queue.length : 0;
  },
};

/**
 * Execute a function with rate limiting
 * If rate limited and queueOverflow is true, queues the request
 */
export async function withRateLimit<T>(
  operation: string,
  fn: () => Promise<T>,
  config?: RateLimitConfig
): Promise<T> {
  const effectiveConfig = config || getConfig(operation);
  const status = rateLimiter.check(operation, effectiveConfig);

  if (status.allowed) {
    rateLimiter.consume(operation);
    return fn();
  }

  // Check if we should queue
  if (effectiveConfig.queueOverflow) {
    if (DEBUG_MODE) {
      console.log(`[RateLimiter] Queuing ${operation}, wait time: ${formatWaitTime(status.queueWaitTime || 0)}`);
    }

    const allowed = await enqueue(operation, effectiveConfig);
    if (allowed) {
      return fn();
    }
  }

  // Rate limited and not queued
  throw new RateLimitError(operation, status);
}

/**
 * Higher-order function to wrap an async function with rate limiting
 */
export function createRateLimitedFunction<T extends (...args: unknown[]) => Promise<unknown>>(
  operation: string,
  fn: T,
  config?: RateLimitConfig
): T {
  return (async (...args: Parameters<T>) => {
    return withRateLimit(operation, () => fn(...args), config);
  }) as T;
}

// ============================================================================
// Error Class
// ============================================================================

export class RateLimitError extends Error {
  public readonly operation: string;
  public readonly status: RateLimitStatus;
  public readonly retryAfter: number;

  constructor(operation: string, status: RateLimitStatus) {
    super(status.message || `Rate limit exceeded for ${operation}`);
    this.name = 'RateLimitError';
    this.operation = operation;
    this.status = status;
    this.retryAfter = status.resetIn;
  }
}

// ============================================================================
// Cleanup
// ============================================================================

function cleanupAllExpired(): void {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const operation = key.replace(STORAGE_KEY_PREFIX, '');
        const config = getConfig(operation);
        const stored = loadFromStorage(operation);
        const now = Date.now();

        const validTimestamps = cleanupExpiredTimestamps(
          stored.timestamps,
          config.windowMs,
          now
        );

        if (validTimestamps.length !== stored.timestamps.length) {
          saveToStorage(operation, {
            timestamps: validTimestamps,
            lastCleanup: now,
          });
        }
      }
    }
  } catch (error) {
    if (DEBUG_MODE) {
      console.warn('[RateLimiter] Cleanup failed:', error);
    }
  }
}

// Start cleanup timer
if (typeof window !== 'undefined') {
  cleanupTimer = setInterval(cleanupAllExpired, CLEANUP_INTERVAL_MS);

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
    }
  });
}

/**
 * Cleanup function for tests or manual cleanup
 */
export function stopRateLimiterCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
