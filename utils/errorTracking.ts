/**
 * Error Tracking Utilities
 *
 * Features:
 * - Centralized error tracking
 * - Error context enrichment (user, route, timestamp)
 * - Severity levels (debug, info, warn, error, fatal)
 * - Error reporting queue for batch sending
 * - Sentry/Bugsnag integration hook (disabled in dev)
 * - Local error log for debugging
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorSeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface ErrorReport {
  id: string;
  level: ErrorSeverity;
  message: string;
  context: Record<string, unknown>;
  timestamp: number;
  userId?: string;
  route?: string;
  stack?: string;
  userAgent?: string;
  url?: string;
}

export interface ErrorTrackingConfig {
  /** Enable error tracking (default: true) */
  enabled?: boolean;
  /** Maximum number of errors to keep in memory (default: 100) */
  maxLogSize?: number;
  /** Batch size for reporting queue (default: 10) */
  batchSize?: number;
  /** Flush interval in ms (default: 30000) */
  flushIntervalMs?: number;
  /** Minimum severity to log to console (default: 'warn') */
  consoleLogLevel?: ErrorSeverity;
  /** Custom error reporter function (for Sentry, Bugsnag, etc.) */
  reporter?: (errors: ErrorReport[]) => Promise<void>;
}

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_MODE = import.meta.env.DEV;
const DEFAULT_CONFIG: Required<ErrorTrackingConfig> = {
  enabled: true,
  maxLogSize: 100,
  batchSize: 10,
  flushIntervalMs: 30000,
  consoleLogLevel: 'warn',
  reporter: async () => {}, // No-op default
};

const SEVERITY_LEVELS: Record<ErrorSeverity, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ============================================================================
// State
// ============================================================================

let config: Required<ErrorTrackingConfig> = { ...DEFAULT_CONFIG };
const errorLog: ErrorReport[] = [];
const reportQueue: ErrorReport[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let currentUserId: string | undefined;
let currentRoute: string | undefined;

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function shouldLog(level: ErrorSeverity): boolean {
  return SEVERITY_LEVELS[level] >= SEVERITY_LEVELS[config.consoleLogLevel];
}

function getContext(): Record<string, unknown> {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    timestamp: Date.now(),
    environment: DEBUG_MODE ? 'development' : 'production',
  };
}

function formatForConsole(report: ErrorReport): string {
  const parts = [
    `[${report.level.toUpperCase()}]`,
    report.message,
  ];

  if (report.route) {
    parts.push(`(route: ${report.route})`);
  }

  return parts.join(' ');
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configure the error tracking system
 */
export function configureErrorTracking(options: ErrorTrackingConfig): void {
  config = { ...DEFAULT_CONFIG, ...options };

  // Restart flush timer with new interval
  if (flushTimer) {
    clearInterval(flushTimer);
  }

  if (config.enabled && config.reporter !== DEFAULT_CONFIG.reporter) {
    flushTimer = setInterval(flushReportQueue, config.flushIntervalMs);
  }
}

/**
 * Set the current user for error context
 */
export function setErrorTrackingUser(userId: string | undefined): void {
  currentUserId = userId;
}

/**
 * Set the current route for error context
 */
export function setErrorTrackingRoute(route: string): void {
  currentRoute = route;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create an error report
 */
function createReport(
  error: Error | string,
  level: ErrorSeverity,
  context?: Record<string, unknown>
): ErrorReport {
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  const report: ErrorReport = {
    id: generateId(),
    level,
    message,
    context: { ...getContext(), ...context },
    timestamp: Date.now(),
    userId: currentUserId,
    route: currentRoute,
    stack,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };

  return report;
}

/**
 * Add report to log and queue
 */
function addReport(report: ErrorReport): void {
  // Add to in-memory log
  errorLog.push(report);
  if (errorLog.length > config.maxLogSize) {
    errorLog.shift();
  }

  // Add to report queue for batch sending
  if (config.enabled) {
    reportQueue.push(report);
    if (reportQueue.length >= config.batchSize) {
      flushReportQueue();
    }
  }

  // Console output in dev mode or if severity warrants it
  if (DEBUG_MODE || shouldLog(report.level)) {
    const consoleMethod = report.level === 'fatal' || report.level === 'error'
      ? console.error
      : report.level === 'warn'
        ? console.warn
        : report.level === 'info'
          ? console.info
          : console.log;

    consoleMethod(formatForConsole(report), report.context);
    if (report.stack && (report.level === 'error' || report.level === 'fatal')) {
      console.error(report.stack);
    }
  }
}

/**
 * Flush the report queue to the external reporter
 */
async function flushReportQueue(): Promise<void> {
  if (reportQueue.length === 0 || !config.reporter) {
    return;
  }

  const errors = [...reportQueue];
  reportQueue.length = 0;

  try {
    await config.reporter(errors);
  } catch (err) {
    // Don't use trackError here to avoid infinite loop
    if (DEBUG_MODE) {
      console.error('[ErrorTracking] Failed to report errors:', err);
    }
    // Re-add failed reports to queue (up to a limit)
    const reAddCount = Math.min(errors.length, config.maxLogSize - reportQueue.length);
    reportQueue.push(...errors.slice(0, reAddCount));
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Track an error
 */
export function trackError(
  error: Error | string,
  context?: Record<string, unknown>,
  level: ErrorSeverity = 'error'
): void {
  const report = createReport(error, level, context);
  addReport(report);
}

/**
 * Track a warning
 */
export function trackWarning(message: string, context?: Record<string, unknown>): void {
  const report = createReport(message, 'warn', context);
  addReport(report);
}

/**
 * Track an info message
 */
export function trackInfo(message: string, context?: Record<string, unknown>): void {
  const report = createReport(message, 'info', context);
  addReport(report);
}

/**
 * Track a debug message
 */
export function trackDebug(message: string, context?: Record<string, unknown>): void {
  if (DEBUG_MODE) {
    const report = createReport(message, 'debug', context);
    addReport(report);
  }
}

/**
 * Track a fatal error
 */
export function trackFatal(error: Error | string, context?: Record<string, unknown>): void {
  const report = createReport(error, 'fatal', context);
  addReport(report);

  // Immediately flush for fatal errors
  flushReportQueue();
}

/**
 * Get the error log
 */
export function getErrorLog(filters?: {
  userId?: string;
  level?: ErrorSeverity;
  route?: string;
  since?: number;
}): ErrorReport[] {
  let result = [...errorLog];

  if (filters?.userId) {
    result = result.filter(r => r.userId === filters.userId);
  }

  if (filters?.level) {
    const minLevel = SEVERITY_LEVELS[filters.level];
    result = result.filter(r => SEVERITY_LEVELS[r.level] >= minLevel);
  }

  if (filters?.route) {
    result = result.filter(r => r.route === filters.route);
  }

  if (filters?.since) {
    result = result.filter(r => r.timestamp >= filters.since);
  }

  return result;
}

/**
 * Clear the error log
 */
export function clearErrorLog(): void {
  errorLog.length = 0;
}

/**
 * Get error statistics
 */
export function getErrorStats(): Record<ErrorSeverity, number> {
  const stats: Record<ErrorSeverity, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0,
  };

  for (const report of errorLog) {
    stats[report.level]++;
  }

  return stats;
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Create a Sentry-compatible reporter
 */
export function createSentryReporter(sentryClient: {
  captureException: (error: Error) => void;
  captureMessage: (message: string, level: string) => void;
  setUser: (user: { id: string }) => void;
}): (errors: ErrorReport[]) => Promise<void> {
  return async (errors: ErrorReport[]) => {
    for (const report of errors) {
      if (report.userId) {
        sentryClient.setUser({ id: report.userId });
      }

      if (report.level === 'error' || report.level === 'fatal') {
        const error = new Error(report.message);
        error.stack = report.stack;
        sentryClient.captureException(error);
      } else {
        sentryClient.captureMessage(report.message, report.level);
      }
    }
  };
}

/**
 * Create a webhook reporter (for Slack, Discord, etc.)
 */
export function createWebhookReporter(webhookUrl: string): (errors: ErrorReport[]) => Promise<void> {
  return async (errors: ErrorReport[]) => {
    // Only send errors and fatals via webhook
    const criticalErrors = errors.filter(e => e.level === 'error' || e.level === 'fatal');

    if (criticalErrors.length === 0) return;

    const payload = {
      text: `⚠️ ${criticalErrors.length} error(s) reported`,
      errors: criticalErrors.map(e => ({
        level: e.level,
        message: e.message,
        route: e.route,
        timestamp: new Date(e.timestamp).toISOString(),
      })),
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };
}

// ============================================================================
// Global Error Handler
// ============================================================================

/**
 * Install global error handlers
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // Unhandled errors
  window.addEventListener('error', (event) => {
    trackError(event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'unhandled_error',
    }, 'error');
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : String(event.reason);

    trackError(error, {
      type: 'unhandled_rejection',
    }, 'error');
  });

  if (DEBUG_MODE) {
    console.log('[ErrorTracking] Global error handlers installed');
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Cleanup function (call before unmounting/unloading)
 */
export async function cleanupErrorTracking(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  // Flush any remaining reports
  await flushReportQueue();
}

// Auto-install in browser environment
if (typeof window !== 'undefined' && !DEBUG_MODE) {
  installGlobalErrorHandlers();
}
