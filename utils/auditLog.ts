/**
 * Audit Logging Foundation
 *
 * Features:
 * - Track all data modifications (CRUD)
 * - Record user actions with context
 * - Store audit entries locally (dev) or prepare for DB
 * - Filter and query audit log
 * - Change tracking with before/after values
 */

// ============================================================================
// Types
// ============================================================================

export type AuditAction = 'create' | 'read' | 'update' | 'delete';

export type AuditResource =
  | 'profile'
  | 'workout'
  | 'nutrition_log'
  | 'meal_entry'
  | 'progress_photo'
  | 'settings'
  | 'auth'
  | 'ai_request'
  | 'storage'
  | 'unknown';

export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId: string;
  changes?: AuditChange[];
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditFilters {
  userId?: string;
  resource?: AuditResource;
  action?: AuditAction;
  resourceId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface AuditConfig {
  /** Enable audit logging (default: true) */
  enabled?: boolean;
  /** Maximum entries to keep in memory (default: 500) */
  maxEntries?: number;
  /** Resources to exclude from logging */
  excludeResources?: AuditResource[];
  /** Actions to exclude from logging */
  excludeActions?: AuditAction[];
  /** Enable console logging in dev mode (default: true in DEV) */
  consoleLogging?: boolean;
  /** Custom handler for audit entries (for sending to backend) */
  onEntry?: (entry: AuditEntry) => void | Promise<void>;
}

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_MODE = import.meta.env.DEV;
const STORAGE_KEY = 'sloe_fit_audit_log';

const DEFAULT_CONFIG: Required<AuditConfig> = {
  enabled: true,
  maxEntries: 500,
  excludeResources: [],
  excludeActions: ['read'], // Don't log reads by default
  consoleLogging: DEBUG_MODE,
  onEntry: () => {},
};

// ============================================================================
// State
// ============================================================================

let config: Required<AuditConfig> = { ...DEFAULT_CONFIG };
let auditLog: AuditEntry[] = [];
let currentUserId: string | undefined;
let currentSessionId: string | undefined;
let isInitialized = false;

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getUserAgent(): string | undefined {
  return typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
}

function loadFromStorage(): AuditEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    if (DEBUG_MODE) {
      console.warn('[AuditLog] Failed to load from storage:', error);
    }
  }
  return [];
}

function saveToStorage(): void {
  try {
    // Only keep most recent entries
    const entriesToSave = auditLog.slice(-config.maxEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesToSave));
  } catch (error) {
    if (DEBUG_MODE) {
      console.warn('[AuditLog] Failed to save to storage:', error);
    }
  }
}

function formatEntryForConsole(entry: AuditEntry): string {
  const action = entry.action.toUpperCase().padEnd(6);
  const resource = entry.resource.padEnd(15);
  const changes = entry.changes?.length ? ` (${entry.changes.length} changes)` : '';
  return `[Audit] ${action} ${resource} ${entry.resourceId}${changes}`;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the audit log system
 */
export function initAuditLog(options?: AuditConfig): void {
  config = { ...DEFAULT_CONFIG, ...options };

  // Generate session ID
  currentSessionId = generateSessionId();

  // Load existing entries from storage
  if (typeof localStorage !== 'undefined') {
    auditLog = loadFromStorage();
  }

  isInitialized = true;

  if (DEBUG_MODE) {
    console.log('[AuditLog] Initialized', {
      existingEntries: auditLog.length,
      sessionId: currentSessionId,
    });
  }
}

/**
 * Configure the audit log system
 */
export function configureAuditLog(options: AuditConfig): void {
  config = { ...config, ...options };
}

/**
 * Set the current user for audit context
 */
export function setAuditUser(userId: string | undefined): void {
  currentUserId = userId;

  if (userId) {
    // Log the auth action
    logAudit({
      action: 'update',
      resource: 'auth',
      resourceId: userId,
      metadata: { event: 'user_set' },
    });
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Log an audit entry
 */
export function logAudit(
  entry: Omit<AuditEntry, 'id' | 'timestamp' | 'userId' | 'sessionId' | 'userAgent'>
): void {
  if (!config.enabled) return;
  if (!isInitialized) initAuditLog();

  // Check exclusions
  if (config.excludeResources.includes(entry.resource)) return;
  if (config.excludeActions.includes(entry.action)) return;

  const fullEntry: AuditEntry = {
    id: generateId(),
    timestamp: Date.now(),
    userId: currentUserId || 'anonymous',
    sessionId: currentSessionId,
    userAgent: getUserAgent(),
    ...entry,
  };

  // Add to log
  auditLog.push(fullEntry);

  // Trim if exceeds max
  if (auditLog.length > config.maxEntries) {
    auditLog = auditLog.slice(-config.maxEntries);
  }

  // Save to storage
  saveToStorage();

  // Console logging
  if (config.consoleLogging) {
    console.log(formatEntryForConsole(fullEntry));
  }

  // Custom handler
  try {
    config.onEntry(fullEntry);
  } catch (error) {
    if (DEBUG_MODE) {
      console.warn('[AuditLog] onEntry handler failed:', error);
    }
  }
}

/**
 * Log a create action
 */
export function logCreate(
  resource: AuditResource,
  resourceId: string,
  data?: Record<string, unknown>,
  metadata?: Record<string, unknown>
): void {
  const changes: AuditChange[] | undefined = data
    ? Object.entries(data).map(([field, value]) => ({
        field,
        from: undefined,
        to: value,
      }))
    : undefined;

  logAudit({
    action: 'create',
    resource,
    resourceId,
    changes,
    metadata,
  });
}

/**
 * Log a read action
 */
export function logRead(
  resource: AuditResource,
  resourceId: string,
  metadata?: Record<string, unknown>
): void {
  logAudit({
    action: 'read',
    resource,
    resourceId,
    metadata,
  });
}

/**
 * Log an update action with change tracking
 */
export function logUpdate(
  resource: AuditResource,
  resourceId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  metadata?: Record<string, unknown>
): void {
  const changes: AuditChange[] = [];

  // Find changed fields
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    const fromValue = before[key];
    const toValue = after[key];

    // Deep comparison for objects
    const changed = JSON.stringify(fromValue) !== JSON.stringify(toValue);
    if (changed) {
      changes.push({
        field: key,
        from: fromValue,
        to: toValue,
      });
    }
  }

  // Only log if there were actual changes
  if (changes.length > 0) {
    logAudit({
      action: 'update',
      resource,
      resourceId,
      changes,
      metadata,
    });
  }
}

/**
 * Log a delete action
 */
export function logDelete(
  resource: AuditResource,
  resourceId: string,
  deletedData?: Record<string, unknown>,
  metadata?: Record<string, unknown>
): void {
  const changes: AuditChange[] | undefined = deletedData
    ? Object.entries(deletedData).map(([field, value]) => ({
        field,
        from: value,
        to: undefined,
      }))
    : undefined;

  logAudit({
    action: 'delete',
    resource,
    resourceId,
    changes,
    metadata,
  });
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get audit log entries with optional filters
 */
export function getAuditLog(filters?: AuditFilters): AuditEntry[] {
  let result = [...auditLog];

  if (filters?.userId) {
    result = result.filter(e => e.userId === filters.userId);
  }

  if (filters?.resource) {
    result = result.filter(e => e.resource === filters.resource);
  }

  if (filters?.action) {
    result = result.filter(e => e.action === filters.action);
  }

  if (filters?.resourceId) {
    result = result.filter(e => e.resourceId === filters.resourceId);
  }

  if (filters?.startDate) {
    result = result.filter(e => e.timestamp >= filters.startDate!);
  }

  if (filters?.endDate) {
    result = result.filter(e => e.timestamp <= filters.endDate!);
  }

  // Sort by timestamp descending (most recent first)
  result.sort((a, b) => b.timestamp - a.timestamp);

  // Apply pagination
  if (filters?.offset) {
    result = result.slice(filters.offset);
  }

  if (filters?.limit) {
    result = result.slice(0, filters.limit);
  }

  return result;
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  total: number;
  byAction: Record<AuditAction, number>;
  byResource: Record<string, number>;
  recentActivity: { hour: number; count: number }[];
} {
  const byAction: Record<AuditAction, number> = {
    create: 0,
    read: 0,
    update: 0,
    delete: 0,
  };

  const byResource: Record<string, number> = {};

  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recentByHour: Record<number, number> = {};

  for (const entry of auditLog) {
    byAction[entry.action]++;
    byResource[entry.resource] = (byResource[entry.resource] || 0) + 1;

    if (entry.timestamp >= hourAgo) {
      const hourBucket = Math.floor((Date.now() - entry.timestamp) / (5 * 60 * 1000)); // 5-min buckets
      recentByHour[hourBucket] = (recentByHour[hourBucket] || 0) + 1;
    }
  }

  const recentActivity = Object.entries(recentByHour)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => a.hour - b.hour);

  return {
    total: auditLog.length,
    byAction,
    byResource,
    recentActivity,
  };
}

/**
 * Get changes for a specific resource
 */
export function getResourceHistory(
  resource: AuditResource,
  resourceId: string
): AuditEntry[] {
  return getAuditLog({
    resource,
    resourceId,
  });
}

/**
 * Get recent activity for current user
 */
export function getMyRecentActivity(limit: number = 20): AuditEntry[] {
  if (!currentUserId) return [];

  return getAuditLog({
    userId: currentUserId,
    limit,
  });
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export audit log as JSON
 */
export function exportAuditLog(filters?: AuditFilters): string {
  const entries = getAuditLog(filters);
  return JSON.stringify(entries, null, 2);
}

/**
 * Export audit log as CSV
 */
export function exportAuditLogCsv(filters?: AuditFilters): string {
  const entries = getAuditLog(filters);

  const headers = ['id', 'timestamp', 'userId', 'action', 'resource', 'resourceId', 'changes'];
  const rows = entries.map(entry => [
    entry.id,
    new Date(entry.timestamp).toISOString(),
    entry.userId,
    entry.action,
    entry.resource,
    entry.resourceId,
    entry.changes ? JSON.stringify(entry.changes) : '',
  ]);

  return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clear all audit log entries
 */
export function clearAuditLog(): void {
  auditLog = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    if (DEBUG_MODE) {
      console.warn('[AuditLog] Failed to clear storage:', error);
    }
  }

  if (DEBUG_MODE) {
    console.log('[AuditLog] Cleared all entries');
  }
}

/**
 * Clear old audit log entries
 */
export function pruneAuditLog(olderThan: number): number {
  const cutoff = Date.now() - olderThan;
  const originalLength = auditLog.length;

  auditLog = auditLog.filter(entry => entry.timestamp >= cutoff);
  saveToStorage();

  const pruned = originalLength - auditLog.length;

  if (DEBUG_MODE) {
    console.log(`[AuditLog] Pruned ${pruned} entries older than ${olderThan}ms`);
  }

  return pruned;
}

// ============================================================================
// Database Schema (for future use)
// ============================================================================

/**
 * SQL schema for audit log table (for reference/migration)
 */
export const AUDIT_LOG_SQL_SCHEMA = `
-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    action TEXT NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete')),
    resource TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    changes JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource, resource_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- Partition by month for large datasets (optional)
-- CREATE TABLE audit_log_y2024m01 PARTITION OF audit_log
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
`;

// Auto-initialize in browser
if (typeof window !== 'undefined' && !isInitialized) {
  initAuditLog();
}
