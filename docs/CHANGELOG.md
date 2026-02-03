# Sloe Fit - Change Log

> All notable changes to this project are documented here.

---

## [Unreleased] - 2026-02-03

### Documentation
- **Updated** `docs/LLM_CONTEXT.md` with comprehensive project context
  - Full project structure with 35+ components documented
  - Complete architecture flows (Workout, Nutrition, BYOC, Onboarding)
  - Design system tokens and component classes
  - AI integration details with all OpenAI functions
  - Database schema overview with BYOC tables
  - Known issues and roadmap

---

## [2026-02-02] - BYOC & Progress Photos

### Added
- **Trainer Dashboard** (`TrainerDashboard.tsx`) - 1,632 lines
  - Client list with activity metrics
  - Invite link generation with usage tracking
  - Custom workout template builder
  - Client messaging system
  - Workout assignment functionality
  
- **Client Trainer View** (`ClientTrainerView.tsx`)
  - Assigned workouts display (pending/completed/skipped)
  - Two-way messaging with trainer
  - Workout status updates

- **Progress Photos** (`ProgressPhotos.tsx`)
  - Photo upload to Supabase Storage
  - Camera capture support
  - Before/after comparison slider
  - Weight logging per photo
  - Photo type categorization (front/side/back)

### Database Migrations
- `20260202_fix_trainer_signup.sql` - Fixed trainer role during signup
- `20260202_progress_photos.sql` - Progress photos table and storage bucket
- `20260202_trainer_client_management.sql` - Full BYOC schema:
  - `trainer_invites` - Invite codes
  - `trainer_templates` - Custom workouts
  - `assigned_workouts` - Client assignments
  - `trainer_messages` - Messaging

---

## [2026-02-01] - Documentation & Context

### Added
- Initial `docs/LLM_CONTEXT.md` for AI assistant handoff
- README link to LLM context documentation

---

## [2026-01] - Workout UI Overhaul

### Added
- **Workout Preview** (`WorkoutPreview.tsx`)
  - Full-screen workout details before starting
  - Exercise list with sets/reps
  - Volume and difficulty indicators
  
- **Workout Session** (`WorkoutSession.tsx`)
  - Active workout state management
  - Exercise tracking with set completion
  - View toggle between Active and Logger modes

- **Active Workout Timer** (`ActiveWorkoutTimer.tsx`)
  - Circular timer display
  - Current exercise and set info
  - Finish Set button to trigger rest

- **Rest Timer** (`RestTimer.tsx`)
  - Countdown between sets
  - Add/subtract time controls
  - Skip rest option

- **Workout Sets Logger** (`WorkoutSetsLogger.tsx`)
  - Weight and reps input per set
  - Set completion checkboxes
  - Add set functionality

- **Workout Summary** (`WorkoutSummary.tsx`)
  - Post-workout stats display
  - Volume and duration calculation
  - 1-5 emoji rating system

- **Recovery Check-In** (`RecoveryCheckIn.tsx`)
  - 3-step modal (Energy → Soreness → Sleep)
  - Recovery data passed to AI workout generation

### Changed
- **Dashboard** workout flow integration
  - New state machine: idle → recovery → generating → preview → active → completed
  - AI workout generation with recovery adjustment

### Improved
- OpenAI service with retry logic and error classification
- Workout generation prompts with recovery awareness

---

## [2026-01] - Nutrition Features

### Added
- **Weekly Nutrition Summary** (`WeeklyNutritionSummary.tsx`)
  - 7-day macro chart
  - Adherence scoring
  - AI-powered insights

- **Text Meal Input** (`TextMealInput.tsx`)
  - Voice input with Whisper API
  - Text parsing for meals
  - Multi-food detection

- **Quick Add Meal** (`QuickAddMeal.tsx`)
  - Saved meal favorites
  - One-tap logging

### Improved
- Meal photo analysis accuracy
- Macro validation and correction logic

---

## [2025-12] - Core Features

### Added
- **Onboarding Flow** (`Onboarding.tsx`)
  - Goal selection (Cut/Bulk/Recomp)
  - Physique estimation
  - Equipment access selection
  - Training frequency picker

- **Body Analysis** (`BodyAnalysis.tsx`)
  - AI photo analysis
  - Body fat estimation
  - Muscle development scoring

- **Meal Tracker** (`MealTracker.tsx`)
  - Photo-based meal analysis
  - Daily macro ring display
  - Goal-aware recommendations

- **Mindset** (`Mindset.tsx`)
  - 30-day mental conditioning program

### Infrastructure
- Supabase authentication setup
- Database schema (profiles, workouts, nutrition)
- PWA configuration with Workbox
- Shopify Buy Button integration
- Light/dark mode theming

---

## Component Inventory

### Main Components (35 total)
| Component | Lines | Purpose |
|-----------|-------|---------|
| TrainerDashboard | 1,632 | BYOC trainer management |
| Onboarding | 728 | User setup wizard |
| ProgressPhotos | 602 | Photo tracking |
| ClientTrainerView | 536 | Client trainer view |
| WeeklyNutritionSummary | 528 | Weekly nutrition |
| MealTracker | 467 | Meal tracking |
| Dashboard | 444 | Main hub |
| Settings | ~600 | User settings |
| WorkoutSession | 332 | Active workout |
| RecoveryCheckIn | ~224 | Pre-workout check |
| WorkoutHistory | ~300 | Past workouts |
| WorkoutSummary | ~200 | Post-workout |
| WorkoutPreview | 139 | Pre-workout preview |
| ActiveWorkoutTimer | ~115 | Workout timer |
| RestTimer | ~124 | Rest countdown |
| WorkoutSetsLogger | ~154 | Set logging |

### Services (5 total)
| Service | Lines | Purpose |
|---------|-------|---------|
| openaiService | 931 | All AI integrations |
| workoutService | ~178 | Workout templates |
| storageService | ~200 | Image uploads |
| supabaseRawFetch | ~150 | REST API calls |
| shopifyService | ~100 | Shopify API |

### Hooks (3 total)
| Hook | Lines | Purpose |
|------|-------|---------|
| useUserData | 597 | User data management |
| useLocalStorage | ~50 | Local storage |
| useOnlineStatus | ~30 | Network status |

### Contexts (5 total)
- AuthContext, ThemeContext, ToastContext, ShopifyContext, NotificationContext

### Icons (17 total)
- ArrowLeftIcon, ArrowRightIcon, BodyIcon, BrainIcon, CameraIcon, CartIcon, ChartIcon, CheckIcon, HomeIcon, ListIcon, LoaderIcon, MealIcon, MicrophoneIcon, PlusIcon, ShopIcon, TrashIcon

---

## Known Issues

### High Priority
1. **Pause button non-functional** in ActiveWorkoutTimer
2. **Mobile responsiveness** issues in RecoveryCheckIn and WorkoutSetsLogger
3. **Weight carry-over** not working when adding new sets

### Medium Priority
4. **Active/Logger view disconnect** - confusing navigation
5. **No exercise navigation** from Active view

### Low Priority
6. **WorkoutPreview hero** takes too much vertical space on mobile
