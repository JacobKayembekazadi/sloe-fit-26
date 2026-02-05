# Ralph Loop Prompt: Backend Completeness Audit

## Objective
Systematically audit and fix all backend issues to bring the Sloe Fit application to production-ready status. Address security vulnerabilities, error handling gaps, and implement missing best practices.

## Completion Promise
`BACKEND AUDIT COMPLETE`

## Exit Criteria
- All 12 phases completed and verified
- Build passes without errors
- No critical security vulnerabilities remain
- Error handling is comprehensive across all services

---

## Phase 1: Supabase Service Hardening
**Files:** `services/supabaseRawFetch.ts`

### Tasks
- [ ] Add AbortController with configurable timeout (default 20s) to all fetch calls
- [ ] Add retry logic with exponential backoff (match OpenAI pattern)
- [ ] Add request/response logging in development mode
- [ ] Add proper TypeScript error types
- [ ] Add request deduplication for identical concurrent requests

### Success Criteria
```typescript
// All functions should have:
// 1. Timeout parameter with AbortController
// 2. Retry logic for retryable errors (5xx, network)
// 3. Dev mode logging
// 4. Consistent error structure
```

---

## Phase 2: Shopify Service Repair
**Files:** `services/shopifyService.ts`

### Tasks
- [ ] Add proper error handling to ALL catch blocks (6 empty catches)
- [ ] Add structured error logging with context
- [ ] Add request timeout handling
- [ ] Add retry logic for transient failures
- [ ] Return typed error objects instead of null
- [ ] Add type safety (remove `any` types)

### Success Criteria
```typescript
// Every catch block should:
// 1. Log the error with context
// 2. Return a structured error object, not null
// 3. Include error type classification
```

---

## Phase 3: Storage Service Enhancement
**Files:** `services/storageService.ts`

### Tasks
- [ ] Add proper error logging to catch blocks (lines 86-91, 125-130, 165-170, 181-186, 240-242)
- [ ] Add upload progress tracking callback
- [ ] Add image compression option (max dimension, quality)
- [ ] Add signed URL generation for private files
- [ ] Add file existence check before upload

### Success Criteria
```typescript
// All error handlers should log:
console.error(`[Storage] ${operation} failed:`, {
  userId, category, error: error.message
});
```

---

## Phase 4: Input Validation Layer
**Files:** Create `utils/validation.ts`

### Tasks
- [ ] Create validation utility functions
- [ ] Add meal description sanitization (XSS, prompt injection)
- [ ] Add workout JSON schema validation
- [ ] Add profile field validation
- [ ] Add file path validation for storage

### Required Validators
```typescript
export const validateMealDescription = (input: string): { valid: boolean; sanitized: string; error?: string }
export const validateWorkoutData = (data: unknown): { valid: boolean; errors: string[] }
export const validateProfileUpdate = (data: Partial<UserProfile>): { valid: boolean; errors: string[] }
export const validateImageUpload = (file: File): { valid: boolean; error?: string }
```

---

## Phase 5: Error Tracking Infrastructure
**Files:** Create `utils/errorTracking.ts`

### Tasks
- [ ] Create centralized error tracking utility
- [ ] Add error context enrichment (user, route, timestamp)
- [ ] Add error severity levels (debug, info, warn, error, fatal)
- [ ] Add error reporting queue for batch sending
- [ ] Prepare Sentry/Bugsnag integration hook (disabled in dev)

### Interface
```typescript
interface ErrorReport {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  context: Record<string, unknown>;
  timestamp: number;
  userId?: string;
  route?: string;
}

export const trackError = (error: Error | string, context?: Record<string, unknown>, level?: ErrorReport['level']) => void
export const trackWarning = (message: string, context?: Record<string, unknown>) => void
export const getErrorLog = () => ErrorReport[]
```

---

## Phase 6: Request Rate Limiting
**Files:** Create `utils/rateLimiter.ts`

### Tasks
- [ ] Implement client-side rate limiter
- [ ] Add per-operation limits (AI calls: 10/min, uploads: 20/min)
- [ ] Add queue system for rate-limited requests
- [ ] Add user feedback when rate limited
- [ ] Store limits in localStorage with expiry

### Interface
```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  queueOverflow?: boolean;
}

export const rateLimiter = {
  check: (operation: string, config: RateLimitConfig) => boolean,
  consume: (operation: string) => void,
  getRemaining: (operation: string) => number,
  reset: (operation: string) => void,
}
```

---

## Phase 7: Request Timeout Standardization
**Files:** All service files

### Tasks
- [ ] Create reusable fetch wrapper with timeout
- [ ] Apply to supabaseRawFetch.ts (all functions)
- [ ] Apply to shopifyService.ts (all functions)
- [ ] Apply to storageService.ts (all async operations)
- [ ] Add configurable timeout per operation type

### Timeouts Configuration
```typescript
const TIMEOUTS = {
  database: 20000,    // 20s for Supabase
  ai: 45000,          // 45s for OpenAI (already done)
  storage: 60000,     // 60s for file uploads
  shopify: 15000,     // 15s for Shopify API
  default: 30000,     // 30s default
};
```

---

## Phase 8: API Response Standardization
**Files:** All service files

### Tasks
- [ ] Create standard API response type
- [ ] Update supabaseRawFetch to use standard response
- [ ] Update shopifyService to use standard response
- [ ] Update storageService to use standard response
- [ ] Add response transformation utilities

### Standard Response Type
```typescript
interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  meta?: {
    timestamp: number;
    duration?: number;
    cached?: boolean;
  };
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}
```

---

## Phase 9: Audit Logging Foundation
**Files:** Create `utils/auditLog.ts`

### Tasks
- [ ] Create audit log interface
- [ ] Add logging for profile updates
- [ ] Add logging for workout CRUD operations
- [ ] Add logging for nutrition log changes
- [ ] Store audit entries in localStorage (dev) / prepare DB table schema

### Audit Log Structure
```typescript
interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  resource: string;
  resourceId: string;
  changes?: { field: string; from: unknown; to: unknown }[];
  metadata?: Record<string, unknown>;
}

export const logAudit = (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void
export const getAuditLog = (filters?: { userId?: string; resource?: string }) => AuditEntry[]
```

---

## Phase 10: Security Headers & CSP
**Files:** `index.html`, `vite.config.ts`

### Tasks
- [ ] Add Content Security Policy meta tag
- [ ] Add X-Content-Type-Options header
- [ ] Add X-Frame-Options header
- [ ] Add Referrer-Policy header
- [ ] Document CSP configuration for production

### CSP Configuration
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https://*.supabase.co;
  connect-src 'self' https://*.supabase.co https://api.openai.com https://*.myshopify.com;
">
```

---

## Phase 11: Documentation
**Files:** Create `docs/API.md`, `docs/DATABASE.md`

### Tasks
- [ ] Document all Supabase endpoints used
- [ ] Document database schema with ERD
- [ ] Document authentication flow
- [ ] Document error codes and handling
- [ ] Document rate limits and quotas

### API Documentation Template
```markdown
## Endpoint: `profiles?id=eq.{userId}`

### Method: GET
### Auth: Required (JWT)
### RLS: Users can only read own profile

### Response
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | User ID |
| full_name | string | Display name |
...
```

---

## Phase 12: Build Verification & Cleanup
**Files:** All modified files

### Tasks
- [ ] Run `npm run build` and fix any TypeScript errors
- [ ] Run `npm run lint` and fix any lint errors
- [ ] Remove unused imports
- [ ] Remove console.log statements (except DEV mode)
- [ ] Update .env.example with all required variables
- [ ] Verify all services work in production mode

### Final Checklist
```
[ ] Build passes without errors
[ ] No TypeScript errors
[ ] No unused variables/imports
[ ] All console.logs gated by DEV check
[ ] .env.example is complete
[ ] README updated with setup instructions
```

---

## Execution Notes

### Order of Operations
1. Phase 1-3: Service hardening (can be parallel)
2. Phase 4-6: Infrastructure utilities (sequential)
3. Phase 7-9: Apply utilities across codebase
4. Phase 10-11: Security and documentation
5. Phase 12: Final verification

### Testing Each Phase
After completing each phase:
1. Run `npm run build` to verify no breaks
2. Test affected functionality manually
3. Check browser console for errors

### Rollback Strategy
If a phase causes issues:
1. Git stash changes
2. Identify breaking change
3. Fix incrementally

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Empty catch blocks | 12+ | 0 |
| Functions without timeout | 15+ | 0 |
| Services with retry logic | 1 | 4 |
| Input validation | 0% | 100% |
| Build errors | ? | 0 |
| Console.logs (prod) | Many | 0 |

---

## Notes for Ralph Loop

- Start with Phase 1 and proceed sequentially
- Each phase should end with a working build
- Document any blockers or decisions made
- If a phase requires significant refactoring, note it and continue
- The goal is FUNCTIONAL improvement, not perfection
- Skip creating actual test files (Phase exists in analysis but not prompt)
- Focus on hardening existing code over new features
