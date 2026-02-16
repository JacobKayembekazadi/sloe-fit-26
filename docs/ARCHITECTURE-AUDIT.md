# Sloe Fit — System Architecture Audit
# Generated: 2026-02-16
# Status: 60% → Launch-Ready Plan

---

## LAYER 1: System Map (State + Features)

### Features → State → Connections

```
Feature: Auth (INIT — must run first)
├── Reads: supabase.auth.session
├── Writes: user, session, profile
└── Connections: ALL features depend on this

Feature: Onboarding (INIT — second)
├── Reads: profile.onboarding_complete
├── Writes: profile (goal, height, weight, age, gender, activity_level, training_experience, equipment_access, days_per_week)
└── Connections: Dashboard, WorkoutGeneration, MealTracking

Feature: Dashboard
├── Reads: workouts, nutritionLogs, weeklyPlan, coachInsights, userProfile
├── Writes: workoutStatus, activeTab
└── Connections: TrainTab, MealTracker, BodyAnalysis

Feature: Workout Generation (AI)
├── Reads: userProfile, recovery state, recentWorkouts, weeklyPlan
├── Writes: aiWorkout, workoutLog, workoutTitle
└── Connections: WorkoutSession, WorkoutSummary, WorkoutHistory
└── API: POST /api/ai/generate-workout

Feature: Workout Session
├── Reads: workoutLog, startTime, activeDraft
├── Writes: completedLog, endTime, localStorage draft
└── Connections: WorkoutSummary, offline queue

Feature: Meal Tracking (AI)
├── Reads: nutritionLogs, mealEntries, favorites, nutritionTargets
├── Writes: nutrition_logs, meal_entries, favorite_foods
└── API: POST /api/ai/analyze-meal, POST /api/ai/analyze-meal-photo

Feature: Body Analysis (AI)
├── Reads: progress_photos, userProfile
├── Writes: analysis results (ephemeral)
└── API: POST /api/ai/analyze-body

Feature: Weekly Plan (AI)
├── Reads: userProfile, workouts, completed_days
├── Writes: weekly_plans, completed_days
└── API: POST /api/ai/generate-weekly-plan

Feature: Payments
├── Reads: profile.subscription_status, profile.stripe_customer_id
├── Writes: profile (subscription_status, subscription_provider, subscription_plan, subscription_ends_at)
└── API: POST /api/payments/stripe-checkout, POST /api/payments/stripe-webhook

Feature: Coaching Agent (client-side)
├── Reads: workout events, recovery events, program day
├── Writes: coachInsights (localStorage)
└── Connections: Dashboard (insight cards)

Feature: Shopify Store
├── Reads: product catalog, cart
├── Writes: cart state
└── Status: PLACEHOLDER — product IDs not configured
```

### Shared State (touched by 3+ features)
- `userProfile` — 8 features read it
- `workouts` — 5 features
- `nutritionLogs` — 4 features
- `goal` — 4 features

---

## LAYER 2: Journey Map

### User States

```
State: Unauthenticated
├── Entry: First visit or logged out
├── Available: Login (email/password, Google OAuth)
├── Blocked: Everything else
└── Exit: Successful auth → check onboarding

State: Onboarding
├── Entry: Auth complete + onboarding_complete = false
├── Available: Multi-step quiz (goal, physique, hurdles, trajectory)
├── Blocked: All app features
└── Exit: Quiz complete → Dashboard

State: Trial (7 days)
├── Entry: Onboarding complete, no subscription
├── Available: ALL features (full access)
├── Blocked: Nothing during trial
└── Exit: 7 days expire → Paywall | Subscribe → Active

State: Active (Subscribed)
├── Entry: Stripe checkout complete
├── Available: ALL features
├── Blocked: Nothing
└── Exit: Subscription cancel → Expired

State: Expired
├── Entry: Trial expired + no subscription, or subscription cancelled
├── Available: View-only (history, settings)
├── Blocked: AI features (workout gen, meal analysis, body analysis)
└── Exit: Subscribe → Active
```

### Critical Path (Day 1 User)
```
Login → Onboarding Quiz (4 steps) → Dashboard → Start Workout →
Recovery Check → AI Generates Workout → Preview → Active Session →
Complete → Rate → Summary → History
```

---

## LAYER 3: Failure Map

### CRITICAL Failures

```
Failure: AI provider down (all 3 providers)
├── Detection: withFallback() exhausts all providers
├── Fallback: Static workout from getTodaysWorkout(), toast "AI's resting"
├── User Message: "AI's resting. Using backup workout."
├── Recovery: Automatic on next request
└── Status: ✅ HANDLED

Failure: Supabase down
├── Detection: supabaseRawFetch returns error
├── Fallback: Error state with retry button
├── User Message: "Connection Issue" + retry
├── Recovery: Manual retry
└── Status: ✅ HANDLED

Failure: Stripe webhook fails
├── Detection: Webhook returns non-200
├── Fallback: User paid but profile not updated
├── User Message: None (silent failure)
├── Recovery: Manual DB update required
└── Status: ⚠️ PARTIAL — no retry/alerting

Failure: Stripe API version mismatch
├── Detection: TypeScript compilation error
├── Fallback: NONE — payment routes won't compile correctly
├── User Message: Checkout may fail at runtime
├── Recovery: Update apiVersion string
└── Status: ❌ BROKEN — must fix

Failure: Missing lib/env module
├── Detection: Import error in stripe-webhook, stripe-portal, lemonsqueezy-*
├── Fallback: NONE — routes crash on import
├── User Message: 500 error on payment endpoints
├── Recovery: Create the module
└── Status: ❌ BROKEN — must fix

Failure: Offline during workout
├── Detection: useOnlineStatus hook
├── Fallback: OfflineBanner + workoutOfflineQueue
├── User Message: "Saved offline. Will sync later."
├── Recovery: Auto-sync when online
└── Status: ✅ HANDLED

Failure: Stale deploy (chunk not found)
├── Detection: Dynamic import fails
├── Fallback: lazyWithRetry — auto-reload
├── User Message: Brief loading flash, then loads
├── Recovery: Automatic
└── Status: ✅ HANDLED
```

---

## LAYER 4: Rules Engine

```
Rule: Trial Expiry
├── Trigger: 7 days after trial_started_at
├── Condition: subscription_status = 'trial'
├── Action: Show PaywallModal on premium feature access
├── Side Effects: None (no background check — computed on read)
└── Status: ✅ Implemented in useSubscription

Rule: Workout Recovery Check
├── Trigger: User clicks "Start Workout"
├── Condition: Always
├── Action: Show RecoveryCheckIn or QuickRecoveryCheck
├── Side Effects: Coaching agent captures recovery event
└── Status: ✅ Implemented

Rule: Draft Recovery
├── Trigger: App load
├── Condition: localStorage has draft < 2hrs old AND same day
├── Action: Show resume/discard prompt
├── Side Effects: None
└── Status: ✅ Implemented

Rule: Offline Workout Sync
├── Trigger: Network reconnects
├── Condition: hasQueuedWorkouts() = true
├── Action: syncQueuedWorkouts() → toast success
├── Side Effects: Adds workouts to history
└── Status: ✅ Implemented
```

---

## LAYER 5: Dependency Map

| Service | Purpose | Criticality | Status |
|---------|---------|-------------|--------|
| Supabase Auth | Login, session, JWT | CRITICAL | ✅ Working |
| Supabase DB | All user data | CRITICAL | ✅ Working |
| Supabase Storage | Progress photos | DEGRADED | ✅ Working |
| OpenAI API | Primary AI provider | DEGRADED | ✅ Working (server-side) |
| Gemini API | Fallback AI provider | DEGRADED | ✅ Working (server-side) |
| Anthropic API | Fallback AI provider | OPTIONAL | ✅ Config ready (no key set) |
| Stripe | Payments | CRITICAL for revenue | ❌ BROKEN (type mismatch + missing modules) |
| LemonSqueezy | Alt payments | OPTIONAL | ❌ Not configured (missing env vars) |
| Upstash Redis | Rate limiting | DEGRADED | ✅ Connected |
| Shopify | Supplement store | OPTIONAL | ❌ Placeholder IDs |
| Sentry | Error tracking | DEGRADED | ✅ Installed |
| Inngest | Background jobs | OPTIONAL | ⚠️ Configured but not verified |

---

## LAYER 6: Validation Schema

```
Entry Point: Meal Text Input
├── Validations: sanitizeForAI() strips injection attempts
├── Server-side: AI provider validates format
└── Status: ✅ Implemented

Entry Point: Meal Photo Upload
├── Validations: File type (jpeg/png/webp), size (10MB max)
├── Server-side: AI validates image content
└── Status: ✅ Implemented

Entry Point: Workout Rating
├── Validations: 1-5 range (DB check constraint)
└── Status: ✅ Implemented

Entry Point: Profile Data (Onboarding)
├── Validations: DB CHECK constraints on all enums
└── Status: ✅ DB-level validation

Entry Point: Stripe Webhook
├── Validations: Signature verification via constructEvent
└── Status: ✅ Implemented (but route has import errors)
```

---

## LAYER 7: Cost Model

| Operation | Trigger | Frequency | Unit Cost | Monthly (1K users) |
|-----------|---------|-----------|-----------|---------------------|
| Workout Generation | Start workout | 4x/week/user | ~$0.01 | ~$160 |
| Meal Photo Analysis | Photo upload | 2x/day/user | ~$0.02 | ~$1,200 |
| Meal Text Analysis | Text entry | 3x/day/user | ~$0.005 | ~$450 |
| Body Analysis | Photo upload | 1x/week/user | ~$0.02 | ~$80 |
| Weekly Plan | Weekly | 1x/week/user | ~$0.02 | ~$80 |
| Coach Messages | On-demand | 2x/day/user | ~$0.003 | ~$180 |
| Supabase DB | Always | N/A | ~$25/mo | $25 |
| Supabase Storage | Photo uploads | 5x/week | ~$0.023/GB | ~$5 |
| Vercel | Hosting + Functions | N/A | ~$20/mo | $20 |
| Upstash Redis | Rate limits | Per request | ~$10/mo | $10 |
| **Total** | | | | **~$2,210/mo** |

Revenue at 1K users ($9.99/mo): **$9,990/mo**
Margin: **~78%**

---

## LAYER 8: Persistence

| Data | Storage | Sync | Conflict |
|------|---------|------|----------|
| Auth session | Supabase + localStorage | Real-time listener | Server wins |
| Profile | Supabase | On change | Last write wins |
| Workouts | Supabase + offline queue | Online: immediate, Offline: queue | Queue replays on reconnect |
| Nutrition | Supabase | On change | Upsert (user_id + date unique) |
| Meal entries | Supabase | On change | Server wins |
| Progress photos | Supabase Storage | Upload only | N/A |
| Workout draft | localStorage only | N/A | Local only, expires 2hrs |
| Coach insights | localStorage only | N/A | Local only |
| Templates | localStorage only | N/A | Local only |
| Weekly plan | Supabase | On change | Server wins |

---

## LAYER 9: Security

| Control | Status | Notes |
|---------|--------|-------|
| API keys server-side | ✅ FIXED | aiService.ts routes through /api/* |
| Dead openaiService.ts (browser key) | ⚠️ CLEANUP | File exists but nothing imports it |
| RLS on all tables | ✅ | Proper user isolation |
| JWT validation | ✅ | Supabase handles |
| Input sanitization | ✅ | sanitizeForAI() for AI inputs |
| Rate limiting | ✅ | Upstash Redis per-user |
| CORS | ⚠️ | Payment routes use `*` — should restrict |
| CSP headers | ⚠️ | Only X-Frame-Options and X-Content-Type in vercel.json |
| Stripe signature verification | ✅ | constructEvent in webhook |
| MFA | ❌ | Not implemented |
| Brute force protection | ❌ | Supabase default only |

---

## LAYER 10: Resilience

| Feature | Offline Support | Queue | Retry |
|---------|----------------|-------|-------|
| Workout logging | ✅ Full | workoutOfflineQueue.ts | Auto on reconnect |
| Meal logging | ❌ None | — | — |
| AI workout gen | ✅ Fallback | Static workout | 3 provider fallback |
| AI meal analysis | ❌ None | — | — |
| Photo upload | ❌ None | — | — |
| Auth | ✅ Cached session | — | Auto refresh |
| Network detection | ✅ | useOnlineStatus | OfflineBanner shown |

---

## LAYER 11: Observability

| Component | Status | Tool |
|-----------|--------|------|
| Error tracking | ✅ | Sentry (@sentry/react) |
| Error boundaries | ✅ | ErrorBoundary + SectionErrorBoundary per tab |
| AI request logging | ✅ | Console logs with provider + duration |
| Health endpoint | ✅ | /api/health (shows env var status) |
| Performance monitoring | ❌ | Not configured |
| User analytics | ❌ | Not configured |
| Audit logging | ❌ | Not configured |
| Alerting | ❌ | Not configured |

---

## LAYER 12: Accessibility

| Control | Status |
|---------|--------|
| Dark mode | ✅ Default (ThemeContext) |
| aria-labels | ⚠️ Partial (some buttons) |
| Keyboard nav | ⚠️ Partial |
| Motion reduction | ✅ motion-reduce:animate-none |
| Focus indicators | ✅ focus-visible:ring-2 |
| Screen reader | ⚠️ Not tested |
| Color contrast | ⚠️ Not audited |

---

## LAYER 13: Evolution

| Component | Status |
|-----------|--------|
| DB migrations | ✅ 8 migration files |
| Feature flags | ❌ None |
| API versioning | ❌ None (no public API) |
| PWA updates | ✅ UpdatePrompt.tsx with service worker |
| Lazy loading | ✅ lazyWithRetry for all heavy components |
| Code splitting | ✅ Via lazy imports |

---

## LAYER 14: Experience

| Metric | Status |
|--------|--------|
| Lazy loading | ✅ All heavy components |
| Loading states | ✅ LoadingScreen, LazyFallback, skeleton |
| Error states | ✅ Per-section error boundaries |
| Toast notifications | ✅ ToastContext |
| Offline indicator | ✅ OfflineBanner |
| Install prompt | ✅ PWA InstallPrompt |
| Animations | ✅ animate-slide-up, motion-reduce safe |
| Mobile-first | ✅ max-w-lg, bottom nav, touch targets |

---

## EXECUTABLE FIX PLAN

### Sprint 1: Ship Blockers (23 TS errors → 0)
**Estimated effort: 2-3 hours**

#### Fix 1.1: Create missing `lib/env.ts`
```
File: lib/env.ts
Purpose: Safe env var access for serverless functions
Used by: stripe-webhook, stripe-portal, lemonsqueezy-webhook, lemonsqueezy-checkout
```

#### Fix 1.2: Create missing `lib/paymentRateLimit.ts`
```
File: lib/paymentRateLimit.ts
Purpose: Rate limit payment endpoints
Used by: stripe-portal, lemonsqueezy-checkout
```

#### Fix 1.3: Fix Stripe API version
```
Files: api/payments/stripe-checkout.ts, stripe-portal.ts, stripe-webhook.ts
Problem: apiVersion '2024-12-18.acacia' doesn't match installed stripe@20.3.1
Fix: Update to match the installed package's expected version, or use `as any`
```

#### Fix 1.4: Fix coach.ts chat() call
```
File: api/ai/coach.ts
Problem: Passing { messages: [...] } object but chat() expects ChatMessage[] directly
         Accessing response.content but chat() returns string directly
Fix: Change to provider.chat([...messages], { maxTokens, temperature })
     Change response.content → response (it's already the string)
```

#### Fix 1.5: Fix UpdatePrompt.tsx error category
```
File: components/UpdatePrompt.tsx
Problem: Using 'pwa' as ErrorCategory, not in the union type
Fix: Use closest valid category or extend the type
```

#### Fix 1.6: Add @vercel/node types
```
Fix: npm install --save-dev @vercel/node
```

#### Fix 1.7: Fix stripe-webhook subscription property access
```
File: api/payments/stripe-webhook.ts
Problem: current_period_end not on Response<Subscription>
Fix: Type assertion or access through correct property path
```

### Sprint 2: Environment + Health (15 min)
- Set `APP_URL=https://sloe-fit-26.vercel.app` in Vercel env
- Either set LemonSqueezy keys or remove from health checks
- Delete dead `services/openaiService.ts` (931 lines, 0 importers)

### Sprint 3: Shopify Decision (5 min decision, 30 min if yes)
- Either: Set real Shopify product IDs
- Or: Remove ShopifyProvider + CartDrawer + ProductCard (cleaner launch)

### Sprint 4: CORS Hardening (15 min)
- Replace `Access-Control-Allow-Origin: *` in payment routes with actual domain

### Not Required for Launch (backlog):
- Tests (important but not blocking launch)
- Analytics
- LemonSqueezy integration
- MFA
- Audit logging
- Meal offline queue
