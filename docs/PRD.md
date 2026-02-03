# Sloe Fit AI Coach - Product Requirements Document (PRD)

> **Version:** 2.0.0  
> **Last Updated:** 2026-02-03  
> **Status:** Active Development  
> **Product Owner:** King Kay

---

## 1. Executive Summary

**Sloe Fit** is an AI-powered mobile-first fitness coaching application that empowers users to achieve their body composition goals through personalized workouts, intelligent nutrition tracking, and mental conditioning. The product is designed for individuals seeking a premium, data-driven fitness experience without the cost of a full-time personal trainer.

### Core Value Proposition
> *"Your AI-powered personal trainer in your pocket — generating custom workouts based on how YOU feel, analyzing your meals from photos, and keeping you mentally sharp."*

### Target Audience
- **Primary:** Adults 18-45 seeking body transformation (fat loss, muscle gain, or recomposition)
- **Secondary:** Personal trainers seeking a platform to manage clients digitally (BYOC)

---

## 2. Product Vision & Goals

### Vision Statement
To democratize elite-level fitness coaching by combining AI-driven personalization with an immersive, gamified user experience.

### Success Metrics (KPIs)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users (DAU) | 10K+ | Supabase analytics |
| Workout Completion Rate | >70% | (completed / started) |
| Meal Logging Frequency | 2+ meals/day | Daily avg per user |
| 7-Day Retention | >40% | Cohort analysis |
| NPS Score | >50 | In-app survey |

---

## 3. Feature Specifications

### 3.1 AI Workout Generation (Core Feature)

**Description:** Users complete a 60-second recovery check-in (energy, soreness, sleep), and the AI generates a personalized workout plan that adapts to their current state.

**User Story:** *As a user, I want my workout to adjust based on how I feel today, so I can train optimally without overtraining.*

**Flow:**
1. User taps "Start Today's Workout" on Dashboard
2. Modal: Recovery Check-In (Energy → Soreness → Sleep)
3. Loading state: "GENERATING WORKOUT..."
4. AI generates workout via `openaiService.generateWorkout()`
5. WorkoutPreview displays: title, exercises, sets/reps, estimated duration
6. User taps "START WORKOUT"
7. WorkoutSession begins with ActiveWorkoutTimer and WorkoutSetsLogger
8. RestTimer between sets (adjustable, skippable)
9. User logs workout → WorkoutSummary (volume, duration, rating)

**Technical Notes:**
- OpenAI GPT-4o-mini with structured JSON response
- Recovery data modifies workout volume/intensity
- Fallback templates in `workoutService.ts` if API fails

---

### 3.2 Meal Tracking & AI Nutrition Analysis

**Description:** Users log meals via photo, voice, text, or quick-add. AI analyzes food and estimates macros (calories, protein, carbs, fats) in real-time.

**User Story:** *As a user, I want to snap a photo of my meal and instantly see the macros, so I can stay on track without manual calorie counting.*

**Input Methods:**
1. **Photo Mode:** Camera capture → `analyzeMealPhoto()` (Vision API)
2. **Text Mode:** Typed description → `analyzeTextMeal()`
3. **Voice Mode:** Speech-to-text → `analyzeTextMeal()`
4. **Quick Add:** Saved meals for one-tap logging

**Output:**
- Parsed food items with portions
- Macro breakdown (kcal, P/C/F)
- Goal-aware feedback ("Great protein hit!" / "Low on carbs today")

**Technical Notes:**
- GPT-4o-mini Vision for photo analysis
- Multi-food detection in single image
- Weekly insights via `WeeklyNutritionSummary.tsx`

---

### 3.3 Body Analysis (AI Vision)

**Description:** Users upload a body photo for AI-powered composition analysis including estimated body fat percentage, muscle development assessment, and personalized recommendations.

**User Story:** *As a user, I want to understand my current body composition from a photo, so I can set realistic goals and track visual progress.*

**Output:**
- Estimated body fat percentage
- Muscle group assessment (upper/lower, symmetry)
- Posture observations
- Goal-appropriate training recommendations

---

### 3.4 Progress Photo Tracking

**Description:** Users capture and store progress photos (front/side/back) with weight logging. AI can compare before/after images for transformation analysis.

**User Story:** *As a user, I want to compare my before and after photos side-by-side, so I can visualize my progress over time.*

**Features:**
- Photo categorization (front, side, back)
- Weight logging per photo
- Before/after slider comparison
- AI transformation analysis

---

### 3.5 Mindset Coaching (30-Day Program)

**Description:** Daily mental conditioning content designed to build discipline, motivation, and positive fitness habits over 30 days.

**User Story:** *As a user, I want daily mindset tips to keep me motivated, so I don't fall off my fitness journey.*

**Content Format:**
- Daily quote/principle
- Actionable challenge
- Reflection prompt

---

### 3.6 BYOC - Bring Your Own Coach (Trainer Platform)

**Description:** Personal trainers can onboard their existing clients onto Sloe Fit, assign custom workouts, track client progress, and communicate via in-app messaging.

**Trainer Features:**
- Invite link generation with usage limits
- Client list with activity metrics (last workout, adherence)
- Custom workout template builder
- Client messaging system
- Workout assignment with pending/completed/skipped status

**Client Features:**
- View assigned trainer profile
- See pending workouts from trainer
- Message trainer
- Complete trainer-assigned workouts

**Database Schema:**
- `trainer_invites` - Invite codes
- `trainer_templates` - Custom workouts
- `assigned_workouts` - Assignments with status
- `trainer_messages` - Two-way messaging

---

### 3.7 Onboarding Flow

**Description:** New user setup wizard that captures goals, physique baseline, experience level, and equipment access to personalize the experience.

**Steps:**
1. **GoalSelector** - Cut / Bulk / Recomp
2. **PhysiqueEstimator** - Current body assessment
3. **HurdleIdentifier** - Potential blockers
4. **OnboardingQuiz** - Experience & preferences
5. **TrajectoryGraph** - Projected progress visualization

---

## 4. Information Architecture

### Navigation Structure
```
┌─────────────────────────────────────┐
│            Header Bar               │
├─────────────────────────────────────┤
│                                     │
│         Main Content Area           │
│      (Scrollable, Full Height)      │
│                                     │
├─────────────────────────────────────┤
│   Home  │  Body  │  Meals  │ Mind   │  ← BottomNav
└─────────────────────────────────────┘
```

### Screen Hierarchy
- **Dashboard** (Home)
  - Today's overview
  - Nutrition progress ring
  - Workout status / Start button
  - Quick actions (Log Meal, Check In)
  - Trainer card (if assigned)
  - Supplements store link
- **Body Analysis**
  - Photo upload
  - AI analysis results
  - Progress photos
- **Meal Tracker**
  - Input method selection
  - Meal history
  - Weekly summary
- **Mindset**
  - Daily content card
  - 30-day progress

---

## 5. Design System

### Brand Identity: "Sloe Volt"
| Element | Value |
|---------|-------|
| Primary Color | `#D4FF00` (Neon Lime Green) |
| Mode | Dark-first (deep blacks) |
| Aesthetic | Premium gym, elite performance, HUD/scanner effects |
| Typography | Lexend (display), Inter (body) |

### Color Tokens
| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--bg-app` | `#000000` | `#F2F2F7` |
| `--bg-card` | `#1C1C1E` | `#FFFFFF` |
| `--color-primary` | `#D4FF00` | `#D4FF00` |
| `--color-background-dark` | `#101922` | `#f5f7f8` |

### Breakpoints
- `xs`: 375px (small phones)
- `sm`: 640px (large phones)
- `md`: 768px (tablets)
- `lg`: 1024px+

### Component Classes
- `.card` - Premium glass card with blur
- `.btn-primary` - Sloe Volt glow button
- `.btn-secondary` - Translucent glass button
- `.input-field` - Dark input with primary focus ring

---

## 6. Technical Architecture

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 6.2, TypeScript 5.8 |
| Styling | Tailwind CSS v4 |
| State | React Context + Custom Hooks |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| AI | OpenAI GPT-4o-mini |
| PWA | vite-plugin-pwa + Workbox |
| Commerce | Shopify Buy Button |

### Database Schema (Supabase)
**Core Tables:**
- `profiles` - User data, goals, trainer_id
- `workout_logs` - Completed workouts
- `nutrition_logs` - Daily macros
- `progress_photos` - Photo URLs + weight
- `meal_entries` - Detailed meal data

**BYOC Tables:**
- `trainer_invites`
- `trainer_templates`
- `assigned_workouts`
- `trainer_messages`

### AI Services
| Function | Purpose |
|----------|---------|
| `generateWorkout()` | Recovery-aware workout creation |
| `analyzeBodyPhoto()` | Body composition analysis |
| `analyzeMealPhoto()` | Photo-based macro estimation |
| `analyzeTextMeal()` | Text/voice meal parsing |
| `analyzeProgress()` | Before/after comparison |
| `analyzeWeeklyNutrition()` | Weekly insights |

---

## 7. Security & Privacy

- **Authentication:** Supabase Auth (email/password)
- **Authorization:** Row Level Security (RLS) on all tables
- **API Keys:** Stored in environment variables, never exposed client-side
- **Data Retention:** User-controlled photo deletion
- **GDPR:** Data export and deletion capabilities (planned)

---

## 8. Known Issues & Technical Debt

| Issue | Priority | Description |
|-------|----------|-------------|
| Pause button broken | High | Non-functional in ActiveWorkoutTimer |
| Active/Logger disconnect | High | Confusing navigation between views |
| Mobile responsiveness | Medium | Cramped UI on 375px screens |
| Weight carry-over | Medium | New sets don't inherit previous values |

---

## 9. Roadmap

### Phase 1: Workout UX Refinement (Current)
- [ ] Fix pause button
- [ ] Improve Active/Logger navigation
- [ ] Add exercise navigation from timer view
- [ ] Mobile responsiveness improvements

### Phase 2: BYOC Phase B
- [ ] Client workout completion sync to trainer dashboard
- [ ] Trainer analytics (adherence, trends)
- [ ] Nutrition visibility for trainers

### Phase 3: Engagement & Retention
- [ ] Push notifications (workout reminders, check-ins)
- [ ] Streak tracking and gamification
- [ ] Social sharing of progress

### Phase 4: Platform Expansion
- [ ] Next.js migration for SSR + secure API routes
- [ ] React Native mobile app
- [ ] Apple Health / Google Fit integration

---

## 10. Success Criteria

The product will be considered successful when:

1. **Retention:** 40%+ of users return within 7 days
2. **Engagement:** Average user logs 5+ workouts/month
3. **Satisfaction:** NPS score > 50
4. **Growth:** Organic referral rate > 15%
5. **Revenue:** BYOC trainer subscriptions generating recurring revenue

---

## 11. Appendices

### A. File Reference (Large Files)
| File | Lines | Purpose |
|------|-------|---------|
| `TrainerDashboard.tsx` | 1,632 | BYOC trainer management |
| `openaiService.ts` | 931 | AI API integrations |
| `prompts.ts` | 894 | AI prompt templates |
| `Onboarding.tsx` | 728 | User onboarding wizard |
| `useUserData.ts` | 597 | User data hook |

### B. Environment Variables
```env
VITE_OPENAI_API_KEY=sk-...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SHOPIFY_STORE_DOMAIN=...
VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
```

### C. Development Commands
```bash
npm install       # Install dependencies
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production
```

---

*Document maintained by the Sloe Fit development team. For LLM context, see `docs/LLM_CONTEXT.md`.*
