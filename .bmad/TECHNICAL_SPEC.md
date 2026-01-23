# Technical Specification

## System Architecture

### Frontend
-   **Framework**: React 19 (Vite)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS v4 (Mobile-First, Dark Mode)
-   **State Management**: React Context (`AuthContext`, `ShopifyContext`) + Custom Hooks (`useUserData`)

### Backend (Supabase)
-   **Authentication**: Email/Password via Supabase Auth.
-   **Database**: PostgreSQL with Row Level Security (RLS).

#### Database Schema
1.  **`public.profiles`**
    *   `id` (uuid, FK to auth.users)
    *   `full_name`, `goal`, `fitness_level`
    *   Trigger: Automatically created on user signup.

2.  **`public.workouts`**
    *   `id` (uuid)
    *   `user_id` (uuid)
    *   `data` (jsonb): Stores exercises, sets, reps.
    *   `title`, `date`

3.  **`public.nutrition_logs`**
    *   `id` (uuid)
    *   `user_id` (uuid)
    *   `calories`, `protein`, `carbs`, `fats` (int)
    *   `date`

4.  **`public.daily_stats`**
    *   `id` (uuid)
    *   `user_id` (uuid)
    *   `weight`, `progress_photos` (urls)

### AI Integration
-   **Service**: Google Gemini 2.0 Flash
-   **Usage**:
    *   Body Composition Analysis (Vision)
    *   Meal Nutrition Analysis (Vision)

## Security
-   **RLS Policies**: enabled on all tables. Users can only `SELECT`, `INSERT`, `UPDATE` their own rows (`auth.uid() = user_id`).
-   **Environment Variables**: API keys stored in `.env` (local) and Vercel (prod).

## Deployment
-   **Build Command**: `npm run build`
-   **Output**: `dist/`
-   **Target**: Vercel / Netlify
