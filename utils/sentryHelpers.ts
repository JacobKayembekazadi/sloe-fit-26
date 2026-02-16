/**
 * Sentry Error Reporting Helpers
 *
 * Centralized error reporting that captures context for debugging.
 * Use these helpers in catch blocks instead of just console.error.
 */

import * as Sentry from '@sentry/react';

/**
 * Error severity levels for categorization
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Error categories for grouping in Sentry
 */
export type ErrorCategory =
  | 'auth'           // Authentication/session errors
  | 'data_save'      // Failed to save user data (critical)
  | 'data_fetch'     // Failed to fetch data
  | 'ai'             // AI/ML operation failures
  | 'payment'        // Shopify/payment errors
  | 'storage'        // File storage errors
  | 'network'        // General network errors
  | 'ui'             // UI/rendering errors
  | 'offline_sync'   // Offline queue sync errors
  | 'pwa'            // Service worker / PWA errors
  | 'unknown';       // Uncategorized

interface ReportErrorOptions {
  /** Error category for grouping */
  category: ErrorCategory;
  /** Operation that failed (e.g., 'saveMeal', 'loginUser') */
  operation: string;
  /** Severity level - defaults to 'error' */
  severity?: ErrorSeverity;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** User ID if available */
  userId?: string;
  /** Should also log to console? Defaults to true */
  consoleLog?: boolean;
}

/**
 * Report an error to Sentry with structured context.
 *
 * @example
 * catch (err) {
 *   reportError(err, {
 *     category: 'data_save',
 *     operation: 'saveMealEntry',
 *     context: { mealId, date },
 *   });
 *   showToast('Failed to save meal', 'error');
 * }
 */
export function reportError(
  error: unknown,
  options: ReportErrorOptions
): void {
  const {
    category,
    operation,
    severity = 'error',
    context = {},
    userId,
    consoleLog = true,
  } = options;

  // Log to console in development
  if (consoleLog) {
    console.error(`[${category}] ${operation} failed:`, error);
  }

  // Ensure error is an Error object
  const errorObj = error instanceof Error ? error : new Error(String(error));

  // Set Sentry context
  Sentry.withScope((scope) => {
    // Set tags for filtering
    scope.setTag('category', category);
    scope.setTag('operation', operation);
    scope.setLevel(severity);

    // Set user if available
    if (userId) {
      scope.setUser({ id: userId });
    }

    // Add extra context
    scope.setExtras({
      ...context,
      timestamp: new Date().toISOString(),
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    });

    // Capture the exception
    Sentry.captureException(errorObj);
  });
}

/**
 * Report a warning (non-critical issue) to Sentry.
 * Use for recoverable errors that don't need user notification.
 */
export function reportWarning(
  message: string,
  options: Omit<ReportErrorOptions, 'severity'>
): void {
  Sentry.withScope((scope) => {
    scope.setTag('category', options.category);
    scope.setTag('operation', options.operation);
    scope.setLevel('warning');

    if (options.userId) {
      scope.setUser({ id: options.userId });
    }

    scope.setExtras({
      ...options.context,
      timestamp: new Date().toISOString(),
    });

    Sentry.captureMessage(message, 'warning');
  });

  if (options.consoleLog !== false) {
    console.warn(`[${options.category}] ${options.operation}: ${message}`);
  }
}

/**
 * Create a scoped reporter for a specific category.
 * Useful in hooks/services to reduce boilerplate.
 *
 * @example
 * const report = createScopedReporter('data_save', userId);
 *
 * catch (err) {
 *   report(err, 'saveMeal', { mealId });
 *   showToast('Failed to save', 'error');
 * }
 */
export function createScopedReporter(
  category: ErrorCategory,
  userId?: string
) {
  return (
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ) => {
    reportError(error, { category, operation, context, userId });
  };
}

/**
 * Breadcrumb for tracking user actions leading up to errors.
 * Call this before critical operations.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for all subsequent error reports.
 * Call this after successful authentication.
 */
export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({
    id: userId,
    email,
  });
}

/**
 * Clear user context on logout.
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}
