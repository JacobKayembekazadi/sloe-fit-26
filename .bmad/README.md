# BMAD - Breakthrough Method for Agile Development

## Sloe Fit AI Coach

> AI-powered fitness transformation platform built with React, TypeScript, and Google Gemini AI

---

## 📋 Project Overview

**Sloe Fit AI Coach** is a comprehensive fitness coaching application that leverages AI to provide personalized body analysis, workout planning, meal tracking, mindset coaching, and progress monitoring.

### Core Value Proposition
- **AI Body Analysis** - Upload photos for physique assessment and personalized workout plans
- **Smart Meal Tracking** - Photo-based meal analysis with macro calculations
- **Progress Monitoring** - Track transformation with visual and metric analysis
- **Mindset Integration** - 30-day mental transformation program

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19.2.3 |
| Build Tool | Vite 6.2.0 |
| Language | TypeScript 5.8 |
| AI Integration | Google Gemini AI (@google/genai) |
| Styling | Inline CSS / Tailwind-like utilities |

### Project Structure

```
sloe-fit-ai-coach/
├── components/           # UI Components
│   ├── Dashboard.tsx     # Main dashboard with workout logging
│   ├── BodyAnalysis.tsx  # Photo upload & AI body analysis
│   ├── MealTracker.tsx   # Food photo analysis
│   ├── Mindset.tsx       # 30-day mindset content
│   ├── WorkoutHistory.tsx  # Completed workouts view
│   ├── Settings.tsx      # User settings
│   ├── TrainerDashboard.tsx # Trainer management view
│   ├── ClientTrainerView.tsx # Client view of assigned trainer
│   ├── InstallPrompt.tsx # PWA install prompt
│   ├── LoginScreen.tsx   # Auth login/signup
│   ├── Onboarding.tsx    # User onboarding flow
│   └── icons/            # SVG icon components
├── services/
│   ├── geminiService.ts  # Gemini AI API integration
│   ├── openaiService.ts  # OpenAI API integration
│   ├── shopifyService.ts # Shopify e-commerce
│   ├── storageService.ts # File storage
│   └── workoutService.ts # Workout data service
├── contexts/
│   ├── AuthContext.tsx   # Supabase authentication
│   ├── ShopifyContext.tsx # Cart state management
│   └── ToastContext.tsx  # Notifications
├── hooks/
│   ├── useUserData.ts    # User data persistence
│   └── useLocalStorage.ts # Local storage hook
├── public/
│   ├── icon-192x192.png  # PWA icon
│   └── icon-512x512.png  # PWA splash icon
├── prompts.ts            # AI system prompts
├── App.tsx               # Main application component
├── vite.config.ts        # Vite + PWA configuration
└── index.tsx             # Entry point
```

---

## 🎯 User Stories

### Epic 1: Body Transformation
- [ ] **US-001**: As a user, I can upload my body photo and receive AI-powered physique analysis
- [ ] **US-002**: As a user, I receive a personalized 30-day workout plan based on my analysis
- [ ] **US-003**: As a user, I get goal recommendations (CUT/BULK/RECOMP) based on my body composition

### Epic 2: Nutrition Tracking
- [ ] **US-004**: As a user, I can upload meal photos for automatic calorie/macro calculation
- [ ] **US-005**: As a user, I receive nutrition feedback tailored to my fitness goal

### Epic 3: Workout Logging
- [ ] **US-006**: As a user, I can log my daily workouts with sets, reps, and weight
- [ ] **US-007**: As a user, I can view my workout history
- [ ] **US-008**: As a user, I can track my daily nutrition progress

### Epic 4: Progress & Mindset
- [ ] **US-009**: As a user, I can upload progress photos for AI analysis of my transformation
- [ ] **US-010**: As a user, I receive daily mindset content throughout the 30-day program

---

## 🚀 Sprint Backlog

### Sprint 1: Core Features ✅
- [x] Project scaffolding with Vite + React + TypeScript
- [x] Gemini AI service integration
- [x] Body analysis with photo upload
- [x] Meal tracking with photo analysis
- [x] Dashboard with workout logging
- [x] 30-day mindset content
- [x] Workout history tracking

### Sprint 2: Authentication & Persistence ✅
- [x] Supabase Auth integration
- [x] User profile management
- [x] Cloud data sync
- [x] Shopify e-commerce integration

### Sprint 3: PWA & Trainer Features ✅
- [x] PWA manifest and service worker
- [x] Install prompt for mobile
- [x] Trainer dashboard
- [x] Client-trainer relationships
- [x] Offline support with workbox caching

### Sprint 4: Polish (Planned)
- [ ] Dark/Light theme toggle
- [ ] Push notifications
- [ ] Social sharing of progress

---

## 🔧 Development Guide

### Prerequisites
- Node.js (v18+)
- Gemini API Key

### Setup
```bash
# Install dependencies
npm install

# Configure API key
# Edit .env.local and set GEMINI_API_KEY=your_key_here

# Start dev server
npm run dev
```

### Available Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## 🤖 AI Integration

### Gemini Service Functions

| Function | Purpose |
|----------|---------|
| `analyzeBodyPhoto()` | Analyze physique and generate 30-day workout plan |
| `analyzeMealPhoto()` | Calculate macros and provide nutrition feedback |
| `analyzeProgress()` | Evaluate transformation progress from photos |

### AI Prompts Structure
Located in `prompts.ts`:
- **BODY_ANALYSIS_PROMPT** - Comprehensive body composition & workout planning
- **MEAL_ANALYSIS_PROMPT** - Food identification & macro calculation
- **PROGRESS_ANALYSIS_PROMPT** - Transformation progress evaluation
- **MINDSET_CONTENT** - 30-day motivational content array

---

## 📊 Data Models

### Core Types

```typescript
interface ExerciseLog {
  id: number;
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

interface CompletedWorkout {
  date: string;
  title: string;
  log: ExerciseLog[];
}

type Tab = 'dashboard' | 'body' | 'meal' | 'mindset';
type View = 'tabs' | 'history' | 'settings' | 'trainer' | 'myTrainer';
```

---

## 📝 Definition of Done

- [ ] Code compiles without TypeScript errors
- [ ] Component renders correctly across viewports
- [ ] AI integration returns expected response format
- [ ] User actions provide appropriate feedback
- [ ] No console errors in production build

---

## 🔄 Continuous Improvement

### Retrospective Items
- Consider adding unit tests for services
- Implement error boundary for AI failures
- Add loading states for AI operations
- Optimize image compression before upload

---

*Last Updated: February 2026*
