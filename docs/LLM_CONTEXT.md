# Sloe Fit - LLM Context & Handoff

## Project Overview
Sloe Fit is a mobile-first AI fitness coaching application. It combines body analysis, nutrition tracking, mindset coaching, and guided workouts into a unified premium experience. The current focus is on delivering a high-energy, "Sloe Volt" branded aesthetic with a polished, athletic feel.

## Tech Stack
-   **Frontend:** React 18, Vite, TypeScript
-   **Styling:** Tailwind CSS v4 (configured via `@tailwindcss/vite`)
-   **Icons:** Material Symbols (Google Fonts)
-   **Typography:**
    -   Display: `Lexend`
    -   Body: `Inter`
-   **Backend:** Supabase (Auth, Database, Storage)
-   **AI:** OpenAI GPT-4o-mini (for workout generation, body analysis, meal tracking)
-   **State Management:** React Context (`AuthContext`, `ThemeContext`, `ToastContext`, `ShopifyContext`, `NotificationContext`)
-   **PWA:** vite-plugin-pwa with Workbox caching

## Key Architecture & Components

### 1. Dashboard (`components/Dashboard.tsx`)
The central hub of the application. It orchestrates the user experience and manages the workout flow state (`idle`, `recovery`, `generating`, `preview`, `active`, `completed`).

### 2. Workout Experience (Recent Overhaul)
A completely redesigned workout flow located in `components/`:
-   **`WorkoutPreview.tsx`**: Modal showing workout details (exercises, volume, difficulty) before starting.
-   **`WorkoutSession.tsx`**: The main controller for an active workout. It manages the state between the active timer and rest timer.
    -   **`ActiveWorkoutTimer.tsx`**: Hero circular timer for the current exercise/set.
    -   **`RestTimer.tsx`**: Interstitial timer with skip/add time controls.
    -   **`WorkoutSetsLogger.tsx`**: specialized view for logging weight/reps for progressive overload.
-   **`WorkoutSummary.tsx`**: Post-workout screen with stats (Volume, Duration) and a 1-5 emoji rating system.
-   **`WorkoutHistory.tsx`**: Updated list view for past workouts, visualizing monthly volume trends.

### 3. Core Services (`services/`)
-   **`openaiService.ts`**: Handles OpenAI GPT-4o-mini interactions (workouts, body analysis, meals, voice input).
-   **`workoutService.ts`**: Static workout fallback logic.
-   **`authService.ts`**: Supabase authentication wrappers.
-   **`storageService.ts`**: Image upload/validation for progress photos.
-   **`supabaseRawFetch.ts`**: Direct Supabase REST API calls (bypasses JS client for specific operations).

## Design System
-   **Primary Color:** `Sloe Volt` (#D4FF00) - Used for primary actions, accents, and active states.
-   **Backgrounds:** 
    -   Light: `#f5f7f8`
    -   Dark: `#101922` (Deep slate/navy)
-   **Fonts:** `Lexend` for headers/numerals, `Inter` for body text.

## Current State & Recent Changes
**Status:** Core features complete. BYOC trainer system in progress.

### Completed Features
-   [x] Workout Experience UI Overhaul (WorkoutPreview, ActiveWorkoutTimer, RestTimer, WorkoutSummary)
-   [x] OpenAI integration (GPT-4o-mini for all AI features)
-   [x] Voice input for meal tracking (Whisper API)
-   [x] Progress Photos with before/after comparison
-   [x] Light/Dark mode theming
-   [x] PWA with install prompt
-   [x] Trainer Dashboard (basic)
-   [x] Client-Trainer View

### New Components
-   **`ProgressPhotos.tsx`**: Upload, view, compare progress photos with weight tracking.
-   **`WorkoutSession.tsx`**: Active workout controller with timer states.
-   **`TrainerDashboard.tsx`**: Trainer view to manage clients (BYOC phase A).
-   **`ClientTrainerView.tsx`**: Client view of their assigned trainer.
-   **`TextMealInput.tsx`**: Text/voice meal logging with AI parsing.

## Next Steps (Roadmap)
-   **BYOC Phase A:** Complete trainer invite links, client auto-connection.
-   **Push Notifications:** PWA push for daily check-ins.
-   **Next.js Migration:** Move to server-side API routes (hide API keys).
-   **React Native:** Future mobile app using same API layer.
