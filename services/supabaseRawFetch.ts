/**
 * Raw fetch helpers for Supabase API calls
 * Bypasses the broken Supabase JS client which hangs on queries
 *
 * Features:
 * - Request timeout with AbortController
 * - Retry logic with exponential backoff
 * - Request deduplication for concurrent identical requests
 * - Development mode logging
 * - Proper TypeScript error types
 */

// ============================================================================
// Types
// ============================================================================

export type SupabaseErrorType =
  | 'network'
  | 'timeout'
  | 'auth'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'server_error'
  | 'unknown';

export interface SupabaseError {
  type: SupabaseErrorType;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  originalError?: unknown;
}

export interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
}

interface RequestLog {
  id: number;
  operation: string;
  endpoint: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error' | 'retrying';
  retryCount?: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_MODE = import.meta.env.DEV;
const DEFAULT_TIMEOUT_MS = 20000; // 20 seconds
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;
const MAX_LOG_ENTRIES = 50;

const TIMEOUTS = {
  get: 20000,
  insert: 20000,
  update: 20000,
  delete: 15000,
  upsert: 25000,
  rpc: 30000,
};

// ============================================================================
// Request Logging
// ============================================================================

let requestCounter = 0;
const requestLogs: RequestLog[] = [];

function logRequest(operation: string, endpoint: string, method: string): RequestLog {
  const log: RequestLog = {
    id: ++requestCounter,
    operation,
    endpoint,
    method,
    startTime: Date.now(),
    status: 'pending',
  };
  requestLogs.push(log);
  if (requestLogs.length > MAX_LOG_ENTRIES) {
    requestLogs.shift();
  }
  if (DEBUG_MODE) {
    console.log(`[Supabase #${log.id}] Starting: ${operation} ${method} ${endpoint}`);
  }
  return log;
}

function updateRequestLog(log: RequestLog, status: 'success' | 'error' | 'retrying', retryCount?: number) {
  log.endTime = Date.now();
  log.duration = log.endTime - log.startTime;
  log.status = status;
  if (retryCount !== undefined) log.retryCount = retryCount;

  if (DEBUG_MODE) {
    const durationStr = `${log.duration}ms`;
    const retryStr = retryCount ? ` (retry ${retryCount})` : '';
    if (status === 'success') {
      console.log(`[Supabase #${log.id}] Success: ${log.operation} (${durationStr})${retryStr}`);
    } else if (status === 'error') {
      console.error(`[Supabase #${log.id}] Error: ${log.operation} (${durationStr})${retryStr}`);
    } else {
      console.log(`[Supabase #${log.id}] Retrying: ${log.operation}${retryStr}`);
    }
  }
}

export function getRequestLogs(): RequestLog[] {
  return [...requestLogs];
}

// ============================================================================
// Request Deduplication
// ============================================================================

const pendingRequests = new Map<string, Promise<SupabaseResponse<unknown>>>();

function createRequestKey(method: string, endpoint: string, body?: unknown): string {
  return `${method}:${endpoint}:${body ? JSON.stringify(body) : ''}`;
}

// ============================================================================
// Error Classification
// ============================================================================

function classifyError(error: unknown, status?: number): SupabaseError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network error - please check your connection',
      retryable: true,
      originalError: error,
    };
  }

  // Timeout errors
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'Request timed out - please try again',
      retryable: true,
      originalError: error,
    };
  }

  // HTTP status-based classification
  if (status) {
    if (status === 401 || status === 403) {
      return {
        type: 'auth',
        message: 'Authentication failed - please log in again',
        code: status.toString(),
        retryable: false,
        originalError: error,
      };
    }
    if (status === 404) {
      return {
        type: 'not_found',
        message: 'Resource not found',
        code: status.toString(),
        retryable: false,
        originalError: error,
      };
    }
    if (status === 409) {
      return {
        type: 'conflict',
        message: 'Resource conflict - the item may already exist',
        code: status.toString(),
        retryable: false,
        originalError: error,
      };
    }
    if (status === 400 || status === 422) {
      return {
        type: 'validation',
        message: 'Invalid request data',
        code: status.toString(),
        retryable: false,
        originalError: error,
      };
    }
    if (status >= 500) {
      return {
        type: 'server_error',
        message: 'Server error - please try again later',
        code: status.toString(),
        retryable: true,
        originalError: error,
      };
    }
  }

  // Parse error object if it has message property
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      type: 'unknown',
      message: (error as { message: string }).message,
      retryable: false,
      originalError: error,
    };
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retryable: false,
    originalError: error,
  };
}

// ============================================================================
// Retry Logic
// ============================================================================

function calculateRetryDelay(attempt: number): number {
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
}

function shouldRetry(error: SupabaseError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  return error.retryable;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Token Management
// ============================================================================

import { supabase } from '../supabaseClient';

// Helper to check if a JWT token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    // Validate JWT structure: must have exactly 3 dot-separated parts
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    // Validate exp is a number
    if (typeof payload.exp !== 'number') return true;
    // Expire 60 seconds early to avoid in-flight failures from clock skew
    return payload.exp * 1000 < Date.now() + 60000;
  } catch {
    return true; // If we can't parse it, assume it's invalid
  }
};

// Helper to get auth token — attempts session refresh when stored token is expired
export const getAuthToken = async (): Promise<string> => {
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  try {
    const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
    const storageKey = `sb-${projectId}-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const accessToken = parsed?.access_token;
      // Return token if it exists, is a string, and isn't expired
      if (accessToken && typeof accessToken === 'string' && !isTokenExpired(accessToken)) {
        return accessToken;
      }
      // Token is expired — attempt refresh via Supabase client (triggers autoRefreshToken)
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          return data.session.access_token;
        }
      } catch {
        // Refresh failed — fall through to anon key
      }
    }
  } catch {
    // Failed to parse token
  }
  return supabaseKey;
};

// Get common headers for Supabase requests
export const getSupabaseHeaders = async (prefer?: string): Promise<Record<string, string>> => {
  const authToken = await getAuthToken();
  return {
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'Prefer': prefer || 'return=representation',
  };
};

// ============================================================================
// Core Fetch Wrapper with Timeout and Retry
// ============================================================================

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  operation: string,
  endpoint: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<SupabaseResponse<T>> {
  const log = logRequest(operation, endpoint, options.method || 'GET');
  let lastError: SupabaseError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        lastError = classifyError(errorData, response.status);
        lastError.details = errorData;

        // FIX 4.5 + FIX 18: Emit event on 401 so AuthContext can trigger session refresh/logout
        // Guard: window doesn't exist in Edge Runtime (API routes) or SSR
        if (response.status === 401 && typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('supabase-auth-error', { detail: { status: 401, endpoint } }));
          } catch { /* safety fallback */ }
        }

        if (shouldRetry(lastError, attempt)) {
          updateRequestLog(log, 'retrying', attempt + 1);
          await sleep(calculateRetryDelay(attempt));
          continue;
        }

        updateRequestLog(log, 'error', attempt);
        return { data: null, error: lastError };
      }

      // Handle empty responses (204, etc.)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        updateRequestLog(log, 'success', attempt);
        return { data: null, error: null };
      }

      const data = await response.json();
      updateRequestLog(log, 'success', attempt);
      return { data, error: null };

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = classifyError(error);

      if (shouldRetry(lastError, attempt)) {
        updateRequestLog(log, 'retrying', attempt + 1);
        await sleep(calculateRetryDelay(attempt));
        continue;
      }

      updateRequestLog(log, 'error', attempt);
      return { data: null, error: lastError };
    }
  }

  // Should not reach here, but just in case
  return { data: null, error: lastError || classifyError(new Error('Max retries exceeded')) };
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * GET request with optional deduplication
 */
export const supabaseGet = async <T = unknown>(
  endpoint: string,
  options?: { dedupe?: boolean; timeout?: number }
): Promise<SupabaseResponse<T>> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/rest/v1/${endpoint}`;
  const requestKey = createRequestKey('GET', endpoint);

  // Check for pending duplicate request
  if (options?.dedupe !== false) {
    const pending = pendingRequests.get(requestKey);
    if (pending) {
      if (DEBUG_MODE) {
        console.log(`[Supabase] Deduplicating GET request: ${endpoint}`);
      }
      return pending as Promise<SupabaseResponse<T>>;
    }
  }

  const headers = await getSupabaseHeaders();
  const requestPromise = fetchWithRetry<T>(
    url,
    { headers },
    'GET',
    endpoint,
    options?.timeout ?? TIMEOUTS.get
  );

  if (options?.dedupe !== false) {
    pendingRequests.set(requestKey, requestPromise as Promise<SupabaseResponse<unknown>>);
    requestPromise.finally(() => pendingRequests.delete(requestKey));
  }

  return requestPromise;
};

/**
 * GET single row
 */
export const supabaseGetSingle = async <T = unknown>(
  endpoint: string,
  options?: { dedupe?: boolean; timeout?: number }
): Promise<SupabaseResponse<T>> => {
  const result = await supabaseGet<T[]>(endpoint, options);
  if (result.error) return { data: null, error: result.error };
  return { data: Array.isArray(result.data) ? result.data[0] || null : result.data as T, error: null };
};

/**
 * POST/INSERT request
 */
export const supabaseInsert = async <T = unknown>(
  table: string,
  data: unknown,
  options?: { timeout?: number }
): Promise<SupabaseResponse<T>> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/rest/v1/${table}`;

  const headers = await getSupabaseHeaders('return=representation');
  const result = await fetchWithRetry<T | T[]>(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    },
    'INSERT',
    table,
    options?.timeout ?? TIMEOUTS.insert
  );

  if (result.error) return { data: null, error: result.error };
  return { data: Array.isArray(result.data) ? result.data[0] as T : result.data as T, error: null };
};

/**
 * PATCH/UPDATE request
 */
export const supabaseUpdate = async (
  endpoint: string,
  data: unknown,
  options?: { timeout?: number }
): Promise<{ error: SupabaseError | null }> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/rest/v1/${endpoint}`;

  const headers = await getSupabaseHeaders('return=minimal');
  const result = await fetchWithRetry<unknown>(
    url,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    },
    'UPDATE',
    endpoint,
    options?.timeout ?? TIMEOUTS.update
  );

  return { error: result.error };
};

/**
 * DELETE request
 */
export const supabaseDelete = async (
  endpoint: string,
  options?: { timeout?: number }
): Promise<{ error: SupabaseError | null }> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/rest/v1/${endpoint}`;

  const headers = await getSupabaseHeaders('return=minimal');
  const result = await fetchWithRetry<unknown>(
    url,
    {
      method: 'DELETE',
      headers,
    },
    'DELETE',
    endpoint,
    options?.timeout ?? TIMEOUTS.delete
  );

  return { error: result.error };
};

/**
 * UPSERT request with fallback logic
 */
export const supabaseUpsert = async <T = unknown>(
  table: string,
  data: Record<string, unknown>,
  onConflict?: string,
  options?: { timeout?: number }
): Promise<SupabaseResponse<T>> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const timeoutMs = options?.timeout ?? TIMEOUTS.upsert;

  // For upsert, we need the resolution=merge-duplicates preference
  const headers = await getSupabaseHeaders();
  headers['Prefer'] = 'return=representation,resolution=merge-duplicates';

  // Build URL with on_conflict if specified
  let url = `${supabaseUrl}/rest/v1/${table}`;
  if (onConflict) {
    url += `?on_conflict=${onConflict}`;
  }

  const result = await fetchWithRetry<T | T[]>(
    url,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    },
    'UPSERT',
    table,
    timeoutMs
  );

  // If upsert succeeded
  if (!result.error) {
    return { data: Array.isArray(result.data) ? result.data[0] as T : result.data as T, error: null };
  }

  // If upsert failed with validation error and we have conflict columns, try fallback
  if (result.error.type === 'validation' && onConflict && data.user_id && data.date) {
    if (DEBUG_MODE) {
      console.log(`[Supabase] Upsert failed, trying update/insert fallback for ${table}`);
    }

    // Try update first
    const fallbackHeaders = await getSupabaseHeaders('return=representation');
    const updateResult = await fetchWithRetry<T | T[]>(
      `${supabaseUrl}/rest/v1/${table}?user_id=eq.${data.user_id}&date=eq.${data.date}`,
      {
        method: 'PATCH',
        headers: fallbackHeaders,
        body: JSON.stringify(data),
      },
      'UPSERT_FALLBACK_UPDATE',
      table,
      timeoutMs
    );

    if (!updateResult.error && updateResult.data) {
      return { data: Array.isArray(updateResult.data) ? updateResult.data[0] as T : updateResult.data as T, error: null };
    }

    // If update didn't match anything, try insert
    const insertResult = await fetchWithRetry<T | T[]>(
      `${supabaseUrl}/rest/v1/${table}`,
      {
        method: 'POST',
        headers: fallbackHeaders,
        body: JSON.stringify(data),
      },
      'UPSERT_FALLBACK_INSERT',
      table,
      timeoutMs
    );

    if (!insertResult.error) {
      return { data: Array.isArray(insertResult.data) ? insertResult.data[0] as T : insertResult.data as T, error: null };
    }

    return insertResult as SupabaseResponse<T>;
  }

  return { data: null, error: result.error };
};

/**
 * RPC call helper
 */
export const supabaseRpc = async <T = unknown>(
  functionName: string,
  params?: unknown,
  options?: { timeout?: number }
): Promise<SupabaseResponse<T>> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`;

  const headers = await getSupabaseHeaders();
  return fetchWithRetry<T>(
    url,
    {
      method: 'POST',
      headers,
      body: params ? JSON.stringify(params) : undefined,
    },
    'RPC',
    functionName,
    options?.timeout ?? TIMEOUTS.rpc
  );
};
