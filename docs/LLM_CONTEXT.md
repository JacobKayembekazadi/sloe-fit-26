# Sloe Fit - LLM Context & Handoff

> **Last Updated:** 2026-02-03
> **Status:** Active Development | Production-Ready Core

---

## Project Overview

Sloe Fit is a mobile-first AI fitness coaching application. It combines body analysis, nutrition tracking, mindset coaching, and guided workouts into a unified premium experience. The brand identity centers on "Sloe Volt" (#D4FF00) with a dark, athletic aesthetic inspired by King Kay's high-energy coaching style.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 6.2, TypeScript 5.8 |
| **Styling** | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| **Icons** | Material Symbols Outlined (Google Fonts) |
| **Typography** | Lexend (display/numerals), Inter (body) |
| **Backend** | Supabase (Auth, PostgreSQL, Storage) |
| **AI** | OpenAI GPT-4o-mini (workout gen, body analysis, meal tracking) |
| **State** | React Context (5 contexts) |
| **PWA** | vite-plugin-pwa with Workbox caching |
| **Commerce** | Shopify Buy Button integration |

---

## Project Structure

```
sloe-fit-3/
├── App.tsx                    # Main app router & context providers
├── index.tsx                  # React DOM entry point
├── index.html                 # PWA meta, fonts, Material Symbols
├── index.css                  # Tailwind v4 @theme tokens, global styles
├── tailwind.config.js         # Custom xs breakpoint, Sloe Volt colors
├── vite.config.ts             # Vite config with PWA plugin
├── supabaseClient.ts          # Supabase client initialization
├── prompts.ts                 # All AI prompt templates (894 lines)
│
├── components/                # 35 React components
│   ├── Dashboard.tsx          # Central hub, workout flow orchestration
│   ├── WorkoutSession.tsx     # Active workout controller
│   ├── WorkoutPreview.tsx     # Pre-workout review screen
│   ├── WorkoutSetsLogger.tsx  # Set/rep/weight logging
│   ├── ActiveWorkoutTimer.tsx # Workout timer with exercise display
│   ├── RestTimer.tsx          # Between-set rest countdown
│   ├── WorkoutSummary.tsx     # Post-workout stats & rating
│   ├── WorkoutHistory.tsx     # Past workouts with volume trends
│   ├── RecoveryCheckIn.tsx    # 3-step recovery assessment modal
│   ├── MealTracker.tsx        # Photo/text meal analysis
│   ├── TextMealInput.tsx      # Voice/text meal logging
│   ├── WeeklyNutritionSummary.tsx # Weekly nutrition charts & AI insights
│   ├── DailyNutritionRing.tsx # Circular macro progress display
│   ├── BodyAnalysis.tsx       # AI body composition analysis
│   ├── ProgressPhotos.tsx     # Before/after photo comparison
│   ├── Mindset.tsx            # 30-day mental conditioning program
│   ├── TrainerDashboard.tsx   # BYOC trainer management (1632 lines)
│   ├── ClientTrainerView.tsx  # Client view of assigned trainer
│   ├── Onboarding.tsx         # Multi-step user setup wizard
│   ├── Settings.tsx           # User preferences & profile
│   ├── LoginScreen.tsx        # Auth (Supabase)
│   ├── Header.tsx             # Top navigation bar
│   ├── BottomNav.tsx          # Main tab navigation
│   ├── LoadingScreen.tsx      # Branded splash screen
│   ├── ErrorBoundary.tsx      # Error handling wrapper
│   ├── icons/                 # 17 custom SVG icon components
│   └── onboarding/            # 5 onboarding step components
│
├── contexts/                  # React Context providers
│   ├── AuthContext.tsx        # Supabase auth state
│   ├── ThemeContext.tsx       # Light/dark mode toggle
│   ├── ToastContext.tsx       # Toast notifications
│   ├── ShopifyContext.tsx     # Shopify cart & products
│   └── NotificationContext.tsx # PWA push notifications
│
├── hooks/                     # Custom React hooks
│   ├── useUserData.ts         # User profile, nutrition, workouts (597 lines)
│   ├── useLocalStorage.ts     # Persistent local state
│   └── useOnlineStatus.ts     # Network connectivity
│
├── services/                  # API & business logic
│   ├── openaiService.ts       # GPT-4o-mini API calls (931 lines)
│   ├── workoutService.ts      # Workout templates & fallbacks
│   ├── storageService.ts      # Supabase Storage uploads
│   ├── supabaseRawFetch.ts    # Direct REST API calls
│   └── shopifyService.ts      # Shopify Storefront API
│
├── supabase/                  # Database migrations
│   ├── FULL_SETUP.sql         # Complete schema
│   ├── migration_001-006_*.sql # Incremental migrations
│   └── migrations/            # 2026 migrations
│       ├── 20260202_fix_trainer_signup.sql
│       ├── 20260202_progress_photos.sql
│       └── 20260202_trainer_client_management.sql
│
├── utils/
│   └── fileUtils.ts           # File handling utilities
│
├── data/
│   └── [data files]           # Static data
│
└── docs/
    └── LLM_CONTEXT.md         # This file
```

---

## Key Architecture & Flows

### 1. Workout Flow (Dashboard → Active Session)

```
Dashboard.tsx
    ↓ "Start Today's Workout"
RecoveryCheckIn.tsx (modal)
    ↓ Energy → Soreness → Sleep
handleRecoveryComplete() → generateWorkout() [OpenAI]
    ↓
WorkoutPreview.tsx (full-screen)
    ↓ "START WORKOUT"
WorkoutSession.tsx (active workout)
    ├── ActiveWorkoutTimer.tsx (main timer view)
    ├── WorkoutSetsLogger.tsx (set logging view)
    └── RestTimer.tsx (between sets)
    ↓ "LOG WORKOUT"
WorkoutSummary.tsx (stats + rating)
    ↓
Dashboard.tsx (idle state)
```

**State Machine (workoutStatus):**
`idle` → `recovery` → `generating` → `preview` → `active` → `completed` → `idle`

### 2. Nutrition Flow

```
MealTracker.tsx
    ├── Photo mode → analyzeMealPhoto() [OpenAI Vision]
    ├── Text mode → TextMealInput.tsx → analyzeTextMeal() [OpenAI]
    └── Quick Add → QuickAddMeal.tsx (saved meals)
    ↓
DailyNutritionRing.tsx (real-time macro display)
    ↓
WeeklyNutritionSummary.tsx (charts + AI insights)
```

### 3. BYOC (Bring Your Own Coach) Flow

**Trainer Side:**
```
TrainerDashboard.tsx
    ├── Client list with activity stats
    ├── Invite link generation
    ├── Workout template creation
    ├── Client messaging
    └── Client workout/nutrition monitoring
```

**Client Side:**
```
ClientTrainerView.tsx
    ├── Trainer info
    ├── Assigned workouts (pending/completed)
    └── Messaging with trainer
```

### 4. Onboarding Flow

```
Onboarding.tsx
    ├── GoalSelector.tsx (Cut/Bulk/Recomp)
    ├── PhysiqueEstimator.tsx
    ├── HurdleIdentifier.tsx
    ├── OnboardingQuiz.tsx
    └── TrajectoryGraph.tsx
    ↓
Dashboard.tsx (main app)
```

---

## Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#D4FF00` (Sloe Volt) | Primary actions, accents |
| `--bg-app` (dark) | `#000000` | App background |
| `--bg-app` (light) | `#F2F2F7` | App background |
| `--bg-card` (dark) | `#1C1C1E` | Card backgrounds |
| `--bg-card` (light) | `#FFFFFF` | Card backgrounds |
| `--color-background-dark` | `#101922` | Deep slate (workout UI) |
| `--color-background-light` | `#f5f7f8` | Light mode (workout UI) |

### Typography
- **Display:** Lexend (headers, numerals, timers)
- **Body:** Inter (paragraphs, labels)

### Breakpoints
- `xs`: 375px (small phones)
- `sm`: 640px (large phones)
- `md`: 768px (tablets)
- `lg`: 1024px (laptops)

### Component Classes (index.css)
- `.card` - Premium card with backdrop blur
- `.btn-primary` - Sloe Volt button with glow
- `.btn-secondary` - Glass/translucent button
- `.input-field` - Dark input with primary focus ring
- `.nav-item` - Bottom nav button

---

## AI Integration (openaiService.ts)

### Available Functions

| Function | Purpose | Model |
|----------|---------|-------|
| `generateWorkout()` | Creates personalized workout from recovery + profile | GPT-4o-mini |
| `analyzeBodyPhoto()` | Body composition, BF%, muscle assessment | GPT-4o-mini Vision |
| `analyzeMealPhoto()` | Macro estimation from food photo | GPT-4o-mini Vision |
| `analyzeTextMeal()` | Parse text/voice meal description | GPT-4o-mini |
| `analyzeProgress()` | Compare before/after photos | GPT-4o-mini Vision |
| `analyzeWeeklyNutrition()` | Weekly adherence insights | GPT-4o-mini |

### Prompt Templates (prompts.ts)
- `BODY_ANALYSIS_PROMPT` - Comprehensive body analysis protocol
- `MEAL_ANALYSIS_PROMPT` - Photo-based meal analysis
- `TEXT_MEAL_ANALYSIS_PROMPT` - Text meal parsing
- `WORKOUT_GENERATION_PROMPT` - Recovery-aware workout creation
- `PROGRESS_ANALYSIS_PROMPT` - Before/after comparison
- `WEEKLY_NUTRITION_PROMPT` - Weekly nutrition insights

### Error Handling
- Retry logic with exponential backoff
- Error classification (rate limit, auth, network, etc.)
- Request logging for debugging

---

## Database Schema (Supabase)

### Core Tables
- `profiles` - User profiles with goals, metrics, trainer_id
- `workout_logs` - Completed workouts with exercises
- `nutrition_logs` - Daily macro entries
- `progress_photos` - Photo URLs with weight tracking
- `meal_entries` - Detailed meal data

### BYOC Tables (migration_006)
- `trainer_invites` - Invite codes with usage limits
- `trainer_templates` - Custom workout templates
- `assigned_workouts` - Workouts assigned to clients
- `trainer_messages` - Trainer-client messaging

### Recent Migrations (Feb 2026)
- `20260202_fix_trainer_signup.sql` - Trainer role fix
- `20260202_progress_photos.sql` - Photo storage schema
- `20260202_trainer_client_management.sql` - Full BYOC schema

---

## Environment Variables

```env
VITE_OPENAI_API_KEY=sk-...         # OpenAI API key
VITE_SUPABASE_URL=https://...      # Supabase project URL
VITE_SUPABASE_ANON_KEY=eyJ...      # Supabase anon key
VITE_SHOPIFY_STORE_DOMAIN=...      # Shopify store domain
VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN=... # Shopify API token
```

---

## Current State & Known Issues

### Completed Features ✅
- [x] Full workout flow (preview → session → summary)
- [x] AI workout generation with recovery adjustment
- [x] Meal tracking (photo, text, voice, quick-add)
- [x] Weekly nutrition insights with AI
- [x] Progress photo upload & comparison
- [x] Light/dark mode theming
- [x] PWA with install prompt
- [x] Trainer Dashboard (BYOC Phase A)
- [x] Client-Trainer messaging
- [x] Trainer invite links
- [x] Assigned workouts system

### Known Issues 🐛
1. **WorkoutSession Navigation:** Active/Logger views feel disconnected; users struggle to navigate between exercises
2. **Pause Button:** Non-functional in `ActiveWorkoutTimer.tsx`
3. **Mobile Responsiveness:** Some components cramped on small phones (RecoveryCheckIn energy buttons, WorkoutSetsLogger inputs)
4. **Weight Carry-Over:** New sets don't inherit previous set's weight/reps

### In Progress 🔄
- Workout flow UX refinement
- Mobile responsiveness improvements

---

## Next Steps (Roadmap)

1. **Workout UX Overhaul:** Merge Active/Logger views, fix navigation
2. **BYOC Phase B:** Client workout completion sync, trainer analytics
3. **Push Notifications:** PWA push for check-ins and reminders
4. **Next.js Migration:** Server-side API routes for secure key handling
5. **React Native:** Future mobile app using same API layer

---

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## File Size Reference (Large Files)

| File | Lines | Purpose |
|------|-------|---------|
| `TrainerDashboard.tsx` | 1,632 | Complete trainer management UI |
| `openaiService.ts` | 931 | All OpenAI API integrations |
| `prompts.ts` | 894 | AI prompt templates |
| `Onboarding.tsx` | 728 | Multi-step onboarding wizard |
| `useUserData.ts` | 597 | User data hook with Supabase |
| `ProgressPhotos.tsx` | 602 | Photo upload & comparison |
| `ClientTrainerView.tsx` | 536 | Client-side trainer view |
| `WeeklyNutritionSummary.tsx` | 528 | Weekly nutrition charts |
| `MealTracker.tsx` | 467 | Multi-mode meal tracking |
| `Dashboard.tsx` | 444 | Main app dashboard |

---

## Context for AI Assistants

When working on this codebase:

1. **Styling:** Use Tailwind CSS v4 with `@theme` tokens in `index.css`. Prefer design system classes (`.card`, `.btn-primary`) over raw utilities.

2. **Icons:** Use Material Symbols Outlined via `<span className="material-symbols-outlined">icon_name</span>`. Font is loaded in `index.html`.

3. **State:** User data flows through `useUserData` hook. Auth via `useAuth` context. Most component state is local.

4. **AI Calls:** All OpenAI interactions go through `openaiService.ts`. Never expose API keys client-side in production.

5. **Mobile-First:** Design for 375px first. Use `xs:` breakpoint for small phone adjustments.

6. **Safe Areas:** Respect iOS notch/home indicator with `env(safe-area-inset-*)` CSS variables.

7. **Error Handling:** Use `showToast()` from `ToastContext` for user feedback.

8. **Supabase:** Use `supabaseRawFetch.ts` functions for type-safe API calls.
