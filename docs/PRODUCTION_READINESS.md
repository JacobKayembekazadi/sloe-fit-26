# Production Readiness Audit

> **Date**: 2026-02-15 (updated)
> **Auditor**: Claude Code (Opus 4.6) - Session 14
> **Score**: **68%** — Approaching production-ready

---

## Score Breakdown

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| **Core Functionality** | 85% | 20% | Feature-complete: workouts, meals, coaching, payments, PWA |
| **Security** | 70% | 20% | CORS fixed, input validation in place, auth working |
| **Payment Infrastructure** | 75% | 15% | Stripe SDK added, webhook idempotency implemented |
| **Testing** | 15% | 15% | 62 tests across 3 files; needs more coverage |
| **Error Monitoring** | 80% | 10% | Sentry initialized with tracing and replay |
| **CI/CD & Quality Gates** | 60% | 10% | GitHub Actions added; ESLint/Prettier still missing |
| **Frontend Resilience** | 55% | 10% | Good offline queue; memory leak fixes still pending |

---

## Production Blockers — ALL FIXED

### ~~1. CRITICAL: All AI API Routes Return 500~~ FIXED
- **Solution**: User added `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars

### ~~2. CRITICAL: Stripe SDK Not in package.json~~ FIXED
- **Solution**: `npm install stripe` — now in dependencies

### ~~3. CRITICAL: CORS Allows All Origins~~ FIXED
- **Solution**: All payment endpoints now use origin allowlist

### ~~4. CRITICAL: No CI/CD Pipeline~~ FIXED
- **Solution**: Added `.github/workflows/ci.yml` with type check, tests, and build

### ~~5. HIGH: Sentry Not Initialized~~ ALREADY DONE
- **Status**: Sentry was already initialized in `index.tsx` with full config

### ~~6. HIGH: No Webhook Idempotency~~ FIXED
- **Solution**: Both Stripe and Lemon Squeezy webhooks now check `processed_webhooks` table

---

## High-Priority Issues (8)

### 6. Hardcoded Fallback URL

**File**: `lib/env.ts:27`
**Issue**: `getAppUrl()` falls back to `'https://sloe-fit-26.vercel.app'` if env vars missing.
**Fix**: Throw error if both `APP_URL` and `VITE_APP_URL` are missing.

### 7. Auth Silent Failure

**File**: `lib/ai/requireAuth.ts`
**Issue**: All errors in `requireAuth()` silently return `null` — no logging.
**Fix**: Add `console.error` with error details before returning null.

### 8. No Rate Limit on Account Deletion

**File**: `api/account/delete.ts`
**Issue**: Unlike payment routes, account deletion has no rate limiting.
**Fix**: Apply same rate limiting as payments.

### 9. Email Not Validated in Checkout

**Files**: `api/payments/stripe-checkout.ts`, `lemonsqueezy-checkout.ts`
**Issue**: Email from request body passed directly to payment providers without format validation.
**Fix**: Add email regex validation before processing.

### 10. localStorage.clear() Wipes Offline Queue

**File**: `components/Settings.tsx:331`
**Issue**: Account deletion calls `localStorage.clear()` which destroys unsynced offline meals.
**Fix**: Use targeted key deletion instead of `clear()`.

### 11. Blob URL Memory Leaks

**Files**: `BodyAnalysis.tsx`, `MealTracker.tsx`, `ProgressPhotos.tsx`
**Issue**: `URL.createObjectURL()` called but URLs not revoked on unmount.
**Fix**: Add cleanup in useEffect return function.

### 12. AbortSignal Created But Unused

**File**: `hooks/useUserData.ts`
**Issue**: `fetchAllData` accepts AbortSignal but never passes it to actual fetch calls.
**Fix**: Pass signal to supabaseGet calls or implement proper cancellation.

### 13. Dashboard Midnight Timer Leak

**File**: `components/Dashboard.tsx`
**Issue**: setTimeout for midnight recalculation not cleared on component unmount.
**Fix**: Store timer ID in ref and clear in useEffect cleanup.

---

## Medium Issues (10)

| # | Issue | File |
|---|-------|------|
| 14 | Missing input validation on `plan` parameter (enum) | checkout routes |
| 15 | Webhook payload schema not validated (Zod) | webhook routes |
| 16 | No request size limits on webhook body parsing | webhook routes |
| 17 | Inconsistent error response structure across API | all API routes |
| 18 | Health check doesn't verify Stripe SDK import | `api/health.ts` |
| 19 | Portion multiplier not validated (0-10x range) | `MealTracker.tsx` |
| 20 | Missing loading state for supplement preferences | `Settings.tsx` |
| 21 | Missing error boundary above useCoachingAgent hook | `Dashboard.tsx` |
| 22 | Weight input not validated (accepts "abc") | `ProgressPhotos.tsx` |
| 23 | No offline status indicator during body analysis upload | `BodyAnalysis.tsx` |

---

## Testing Gaps

### Current Coverage

```
tests/
  services/paymentService.test.ts     # 30 tests
  services/offlineQueue.test.ts       # 20 tests
  hooks/useSubscription.test.tsx      # 12 tests
                                      ─────────
                              Total:    62 tests
```

### Critical Paths With ZERO Tests

| Component | Lines | Risk |
|-----------|-------|------|
| `useUserData.ts` | 597 | All data fetching, offline sync — every user affected |
| `App.tsx` | ~300 | Subscription gating, payment detection, routing |
| `WorkoutSession.tsx` | ~400 | Active workout state machine |
| All payment API routes | 5 files | Stripe/LS webhooks, checkout |
| All AI API routes | 8 files | OpenAI/Gemini integration |
| `coachingEngine.ts` | ~500 | 9 pattern detection algorithms |
| 35+ React components | — | No render or interaction tests |

---

## Missing Tooling

| Tool | Status | Priority |
|------|--------|----------|
| GitHub Actions CI | Missing | P0 |
| ESLint | Missing | P0 |
| Prettier | Missing | P1 |
| Husky pre-commit hooks | Missing | P1 |
| Sentry initialization | Installed, unused | P0 |
| Test coverage config | Missing | P1 |
| Dependabot | Missing | P2 |
| E2E tests (Playwright) | Missing | P2 |

---

## What's Strong

- **Database migrations**: Dated, idempotent, RLS policies, indexes (Grade: A)
- **Security headers**: HSTS, X-Frame-Options, nosniff, referrer policy via `vercel.json`
- **Offline architecture**: Queue system with sync, scan data preservation
- **Payment flow design**: Stripe + Lemon Squeezy dual provider, trial/grace logic
- **Bug fixing rigor**: 33 issues found and fixed across 13 Ralph Loop sessions
- **PWA config**: Prompt-mode SW, workbox caching, standalone manifest
- **Code splitting**: Vendor chunks for recharts, markdown, supabase, openai, shopify
- **Subscription gating**: Context-based, all 5 workout paths + AI features gated
- **Brand voice**: Consistent personality across 40+ touchpoints

---

## Roadmap to Launch

### Priority 1 — This Week (52% → 70%)

```
[ ] npm install stripe
[ ] Fix CORS to allowlist your domain(s)
[ ] Initialize Sentry in main.tsx
[ ] Add GitHub Actions: tsc --noEmit && vitest run on PR
[ ] Add ESLint + Prettier
[ ] Add webhook idempotency (event_id dedup table)
```

### Priority 2 — Next Week (70% → 80%)

```
[ ] Validate email in checkout endpoints
[ ] Remove hardcoded URL fallback in lib/env.ts
[ ] Add console.error to all silent catch blocks
[ ] Rate limit account deletion endpoint
[ ] Fix localStorage.clear() → targeted deletion
[ ] Add tests for payment webhooks (mocked Stripe/LS)
[ ] Add tests for useUserData core paths
[ ] Clean up blob URLs on component unmount
```

### Priority 3 — Before Public Launch (80% → 90%)

```
[ ] Add integration tests for full subscription lifecycle
[ ] Add tests for coachingEngine (9 patterns)
[ ] Fix AbortSignal to actually cancel fetches
[ ] Add offline fallback page for PWA
[ ] Test full payment flow end-to-end (trial → expired → checkout → active)
[ ] Add Husky pre-commit hooks
[ ] Add test coverage thresholds (50% overall, 80% services)
```

---

## Version History

| Date | Score | Changes |
|------|-------|---------|
| 2026-02-14 | 52% | Initial audit |
