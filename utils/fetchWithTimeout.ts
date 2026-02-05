/**
 * Fetch with Timeout Utility
 *
 * Features:
 * - Configurable timeout per request type
 * - Automatic AbortController management
 * - Retry logic with exponential backoff
 * - Request/response logging in dev mode
 * - Standardized error handling
 */

// ============================================================================
// Types
// ============================================================================

export type RequestType = 'database' | 'ai' | 'storage' | 'shopify' | 'default';

export interface FetchConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts (default: 0) */
  retries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryDelay?: number;
  /** Maximum retry delay in ms (default: 10000) */
  maxRetryDelay?: number;
  /** Request type for default timeout selection */
  requestType?: RequestType;
  /** Custom headers to merge */
  headers?: Record<string, string>;
  /** Enable request logging (default: DEV mode only) */
  logging?: boolean;
}

export interface FetchResult<T> {
  data: T | null;
  error: FetchError | null;
  status?: number;
  headers?: Headers;
  duration?: number;
}

export type FetchErrorType =
  | 'timeout'
  | 'network'
  | 'abort'
  | 'parse'
  | 'http'
  | 'unknown';

export interface FetchError {
  type: FetchErrorType;
  message: string;
  status?: number;
  retryable: boolean;
  originalError?: unknown;
}

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_MODE = import.meta.env.DEV;

/**
 * Default timeouts per request type
 */
export const TIMEOUTS: Record<RequestType, number> = {
  database: 20000,   // 20s for Supabase
  ai: 45000,         // 45s for AI operations
  storage: 60000,    // 60s for file uploads
  shopify: 15000,    // 15s for Shopify API
  default: 30000,    // 30s default
};

const DEFAULT_RETRY_CONFIG = {
  retries: 0,
  retryDelay: 1000,
  maxRetryDelay: 10000,
};

// ============================================================================
// Logging
// ============================================================================

let requestCounter = 0;

function logRequest(method: string, url: string, config: FetchConfig): number {
  if (!config.logging && !DEBUG_MODE) return 0;

  const id = ++requestCounter;
  console.log(`[Fetch #${id}] ${method} ${url}`, {
    timeout: config.timeout,
    type: config.requestType,
  });
  return id;
}

function logResponse(id: number, status: number, duration: number, config: FetchConfig): void {
  if (!config.logging && !DEBUG_MODE) return;
  console.log(`[Fetch #${id}] Response: ${status} (${duration}ms)`);
}

function logError(id: number, error: FetchError, config: FetchConfig): void {
  if (!config.logging && !DEBUG_MODE) return;
  console.error(`[Fetch #${id}] Error:`, error.message, { type: error.type, retryable: error.retryable });
}

// ============================================================================
// Error Classification
// ============================================================================

function classifyError(error: unknown, status?: number): FetchError {
  // Timeout errors
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'Request timed out',
      retryable: true,
      originalError: error,
    };
  }

  // Network errors
  if (error instanceof TypeError) {
    return {
      type: 'network',
      message: 'Network error - please check your connection',
      retryable: true,
      originalError: error,
    };
  }

  // HTTP errors
  if (status && status >= 400) {
    const retryable = status >= 500 || status === 429;
    return {
      type: 'http',
      message: `HTTP error ${status}`,
      status,
      retryable,
      originalError: error,
    };
  }

  // Parse errors
  if (error instanceof SyntaxError) {
    return {
      type: 'parse',
      message: 'Failed to parse response',
      retryable: false,
      originalError: error,
    };
  }

  // Unknown errors
  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    type: 'unknown',
    message,
    retryable: false,
    originalError: error,
  };
}

// ============================================================================
// Retry Logic
// ============================================================================

function calculateRetryDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

function shouldRetry(error: FetchError, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  return error.retryable;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Core Fetch Function
// ============================================================================

/**
 * Fetch with timeout and retry support
 */
export async function fetchWithTimeout<T = unknown>(
  url: string,
  options: RequestInit = {},
  config: FetchConfig = {}
): Promise<FetchResult<T>> {
  const {
    timeout = TIMEOUTS[config.requestType || 'default'],
    retries = DEFAULT_RETRY_CONFIG.retries,
    retryDelay = DEFAULT_RETRY_CONFIG.retryDelay,
    maxRetryDelay = DEFAULT_RETRY_CONFIG.maxRetryDelay,
    headers: extraHeaders,
    logging,
    requestType,
  } = config;

  const method = options.method || 'GET';
  const requestId = logRequest(method, url, { ...config, timeout });
  const startTime = Date.now();

  let lastError: FetchError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...extraHeaders,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      logResponse(requestId, response.status, duration, { logging, requestType });

      if (!response.ok) {
        const errorData = await response.text().catch(() => response.statusText);
        lastError = classifyError(errorData, response.status);
        lastError.message = errorData || `HTTP ${response.status}`;

        if (shouldRetry(lastError, attempt, retries)) {
          const delay = calculateRetryDelay(attempt, retryDelay, maxRetryDelay);
          if (DEBUG_MODE) {
            console.log(`[Fetch #${requestId}] Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          }
          await sleep(delay);
          continue;
        }

        logError(requestId, lastError, { logging, requestType });
        return {
          data: null,
          error: lastError,
          status: response.status,
          headers: response.headers,
          duration,
        };
      }

      // Parse response based on content type
      const contentType = response.headers.get('content-type');
      let data: T | null = null;

      if (contentType?.includes('application/json')) {
        data = await response.json() as T;
      } else if (contentType?.includes('text/')) {
        data = await response.text() as unknown as T;
      } else if (response.status !== 204) {
        // For non-JSON, non-text responses, return raw response
        data = response as unknown as T;
      }

      return {
        data,
        error: null,
        status: response.status,
        headers: response.headers,
        duration,
      };

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = classifyError(error);

      if (shouldRetry(lastError, attempt, retries)) {
        const delay = calculateRetryDelay(attempt, retryDelay, maxRetryDelay);
        if (DEBUG_MODE) {
          console.log(`[Fetch #${requestId}] Retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        }
        await sleep(delay);
        continue;
      }

      logError(requestId, lastError, { logging, requestType });
      return {
        data: null,
        error: lastError,
        duration: Date.now() - startTime,
      };
    }
  }

  // Shouldn't reach here, but handle gracefully
  return {
    data: null,
    error: lastError || classifyError(new Error('Max retries exceeded')),
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * GET request with timeout
 */
export async function get<T = unknown>(
  url: string,
  config: FetchConfig = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(url, { method: 'GET' }, config);
}

/**
 * POST request with timeout
 */
export async function post<T = unknown>(
  url: string,
  body: unknown,
  config: FetchConfig = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    config
  );
}

/**
 * PUT request with timeout
 */
export async function put<T = unknown>(
  url: string,
  body: unknown,
  config: FetchConfig = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(
    url,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    config
  );
}

/**
 * PATCH request with timeout
 */
export async function patch<T = unknown>(
  url: string,
  body: unknown,
  config: FetchConfig = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(
    url,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    config
  );
}

/**
 * DELETE request with timeout
 */
export async function del<T = unknown>(
  url: string,
  config: FetchConfig = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(url, { method: 'DELETE' }, config);
}

// ============================================================================
// Specialized Fetch Functions
// ============================================================================

/**
 * Fetch for database operations (Supabase)
 */
export async function fetchDatabase<T = unknown>(
  url: string,
  options: RequestInit = {},
  extraConfig: Omit<FetchConfig, 'requestType'> = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(url, options, {
    ...extraConfig,
    requestType: 'database',
    retries: extraConfig.retries ?? 2,
  });
}

/**
 * Fetch for AI operations
 */
export async function fetchAI<T = unknown>(
  url: string,
  options: RequestInit = {},
  extraConfig: Omit<FetchConfig, 'requestType'> = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(url, options, {
    ...extraConfig,
    requestType: 'ai',
    retries: extraConfig.retries ?? 1,
  });
}

/**
 * Fetch for storage operations
 */
export async function fetchStorage<T = unknown>(
  url: string,
  options: RequestInit = {},
  extraConfig: Omit<FetchConfig, 'requestType'> = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(url, options, {
    ...extraConfig,
    requestType: 'storage',
    retries: extraConfig.retries ?? 2,
  });
}

/**
 * Fetch for Shopify operations
 */
export async function fetchShopify<T = unknown>(
  url: string,
  options: RequestInit = {},
  extraConfig: Omit<FetchConfig, 'requestType'> = {}
): Promise<FetchResult<T>> {
  return fetchWithTimeout<T>(url, options, {
    ...extraConfig,
    requestType: 'shopify',
    retries: extraConfig.retries ?? 2,
  });
}

// ============================================================================
// Exports
// ============================================================================

export const httpClient = {
  get,
  post,
  put,
  patch,
  delete: del,
  fetch: fetchWithTimeout,
  database: fetchDatabase,
  ai: fetchAI,
  storage: fetchStorage,
  shopify: fetchShopify,
};

export default httpClient;
