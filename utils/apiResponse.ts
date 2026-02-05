/**
 * Standard API Response Types and Utilities
 *
 * Features:
 * - Consistent response structure across all services
 * - Type-safe error handling
 * - Response transformation utilities
 * - Metadata support (timing, caching, etc.)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Standard error codes
 */
export type ApiErrorCode =
  // Client errors (4xx)
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  // Server errors (5xx)
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  // Custom errors
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

/**
 * Standard API error structure
 */
export interface ApiError {
  /** Machine-readable error code */
  code: ApiErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Suggested retry delay in ms (if retryable) */
  retryAfter?: number;
  /** Field-specific validation errors */
  fieldErrors?: Record<string, string[]>;
}

/**
 * Response metadata
 */
export interface ApiMeta {
  /** Response timestamp (ms since epoch) */
  timestamp: number;
  /** Request duration in ms */
  duration?: number;
  /** Whether the response was served from cache */
  cached?: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Pagination info */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  /** Rate limit info */
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: number;
  };
}

/**
 * Standard API response structure
 */
export interface ApiResponse<T> {
  /** Response data (null on error) */
  data: T | null;
  /** Error information (null on success) */
  error: ApiError | null;
  /** Response metadata */
  meta?: ApiMeta;
}

// ============================================================================
// Error Code Mapping
// ============================================================================

/**
 * Map HTTP status codes to error codes
 */
export function httpStatusToErrorCode(status: number): ApiErrorCode {
  const statusMap: Record<number, ApiErrorCode> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    502: 'GATEWAY_TIMEOUT',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT',
  };

  return statusMap[status] || (status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN');
}

/**
 * Map error codes to HTTP status
 */
export function errorCodeToHttpStatus(code: ApiErrorCode): number {
  const codeMap: Record<ApiErrorCode, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    VALIDATION_ERROR: 422,
    RATE_LIMITED: 429,
    PAYLOAD_TOO_LARGE: 413,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
    NETWORK_ERROR: 0, // Client-side error
    TIMEOUT: 408,
    PARSE_ERROR: 422,
    NOT_CONFIGURED: 500,
    UNKNOWN: 500,
  };

  return codeMap[code] || 500;
}

/**
 * Check if an error code is retryable by default
 */
export function isRetryableError(code: ApiErrorCode): boolean {
  const retryableCodes: ApiErrorCode[] = [
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
    'GATEWAY_TIMEOUT',
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMITED',
  ];

  return retryableCodes.includes(code);
}

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Create a successful API response
 */
export function success<T>(data: T, meta?: Partial<ApiMeta>): ApiResponse<T> {
  return {
    data,
    error: null,
    meta: {
      timestamp: Date.now(),
      ...meta,
    },
  };
}

/**
 * Create an error API response
 */
export function error<T = never>(
  code: ApiErrorCode,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    fieldErrors?: Record<string, string[]>;
    retryAfter?: number;
    meta?: Partial<ApiMeta>;
  }
): ApiResponse<T> {
  return {
    data: null,
    error: {
      code,
      message,
      retryable: isRetryableError(code),
      details: options?.details,
      fieldErrors: options?.fieldErrors,
      retryAfter: options?.retryAfter,
    },
    meta: {
      timestamp: Date.now(),
      ...options?.meta,
    },
  };
}

/**
 * Create a validation error response
 */
export function validationError<T = never>(
  fieldErrors: Record<string, string[]>,
  message?: string
): ApiResponse<T> {
  return error('VALIDATION_ERROR', message || 'Validation failed', {
    fieldErrors,
  });
}

/**
 * Create a not found error response
 */
export function notFound<T = never>(resource: string): ApiResponse<T> {
  return error('NOT_FOUND', `${resource} not found`);
}

/**
 * Create an unauthorized error response
 */
export function unauthorized<T = never>(message?: string): ApiResponse<T> {
  return error('UNAUTHORIZED', message || 'Authentication required');
}

/**
 * Create a rate limit error response
 */
export function rateLimited<T = never>(retryAfter: number): ApiResponse<T> {
  return error('RATE_LIMITED', 'Too many requests', {
    retryAfter,
  });
}

// ============================================================================
// Response Transformers
// ============================================================================

/**
 * Transform a response's data
 */
export function transformData<T, U>(
  response: ApiResponse<T>,
  transformer: (data: T) => U
): ApiResponse<U> {
  if (response.error || response.data === null) {
    return response as unknown as ApiResponse<U>;
  }

  return {
    data: transformer(response.data),
    error: null,
    meta: response.meta,
  };
}

/**
 * Transform a Supabase-style response to standard format
 */
export function fromSupabaseResponse<T>(response: {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
}): ApiResponse<T> {
  if (response.error) {
    const code = httpStatusToErrorCode(
      parseInt(response.error.code || '500', 10) || 500
    );
    return error(code, response.error.message, {
      details: response.error.details ? { details: response.error.details } : undefined,
    });
  }

  return success(response.data as T);
}

/**
 * Transform a fetch result to standard format
 */
export function fromFetchResult<T>(result: {
  data: T | null;
  error: { type: string; message: string; retryable: boolean } | null;
  status?: number;
  duration?: number;
}): ApiResponse<T> {
  if (result.error) {
    const code = result.status
      ? httpStatusToErrorCode(result.status)
      : (result.error.type.toUpperCase() as ApiErrorCode);

    return error(code, result.error.message, {
      meta: result.duration ? { duration: result.duration } : undefined,
    });
  }

  return success(result.data as T, {
    duration: result.duration,
  });
}

// ============================================================================
// Response Utilities
// ============================================================================

/**
 * Check if a response is successful
 */
export function isSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T; error: null } {
  return response.error === null && response.data !== null;
}

/**
 * Check if a response is an error
 */
export function isError<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: null; error: ApiError } {
  return response.error !== null;
}

/**
 * Unwrap a response, throwing on error
 */
export function unwrap<T>(response: ApiResponse<T>): T {
  if (isError(response)) {
    throw new ApiResponseError(response.error);
  }
  return response.data as T;
}

/**
 * Unwrap a response with default value on error
 */
export function unwrapOr<T>(response: ApiResponse<T>, defaultValue: T): T {
  if (isError(response) || response.data === null) {
    return defaultValue;
  }
  return response.data;
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(response: ApiResponse<unknown>): string | null {
  if (!response.error) return null;

  // Use custom message if available
  if (response.error.message) {
    return response.error.message;
  }

  // Fallback to generic messages
  const defaultMessages: Record<ApiErrorCode, string> = {
    BAD_REQUEST: 'Invalid request. Please check your input.',
    UNAUTHORIZED: 'Please log in to continue.',
    FORBIDDEN: 'You don\'t have permission to do this.',
    NOT_FOUND: 'The requested resource was not found.',
    METHOD_NOT_ALLOWED: 'This action is not allowed.',
    CONFLICT: 'This conflicts with existing data.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    RATE_LIMITED: 'Too many requests. Please wait and try again.',
    PAYLOAD_TOO_LARGE: 'The data is too large. Please reduce the size.',
    INTERNAL_ERROR: 'Something went wrong. Please try again.',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable.',
    GATEWAY_TIMEOUT: 'Request took too long. Please try again.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    TIMEOUT: 'Request timed out. Please try again.',
    PARSE_ERROR: 'Failed to process the response.',
    NOT_CONFIGURED: 'Service is not configured.',
    UNKNOWN: 'An unexpected error occurred.',
  };

  return defaultMessages[response.error.code] || 'An error occurred.';
}

// ============================================================================
// Error Class
// ============================================================================

/**
 * Error class for API response errors
 */
export class ApiResponseError extends Error {
  public readonly code: ApiErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly fieldErrors?: Record<string, string[]>;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiResponseError';
    this.code = error.code;
    this.details = error.details;
    this.fieldErrors = error.fieldErrors;
    this.retryable = error.retryable;
    this.retryAfter = error.retryAfter;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ApiError
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'retryable' in value
  );
}

/**
 * Type guard for ApiResponse
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'error' in value
  );
}
