# Sloe Fit AI Coach

---

## Agent Startup Checklist

> **AI Agents**: Complete this before ANY work.

```
[ ] 1. Read CONTINUITY.md         <- Agent playbook
[ ] 2. Read docs/HANDOFF.md       <- Last agent's state
[ ] 3. Read docs/LLM_CONTEXT.md   <- Full architecture
[ ] 4. git status && git log -5   <- Current state
[ ] 5. THEN start working
```

**Before context runs out**: Update `docs/HANDOFF.md` with your progress.

---

The complete transformation intelligence behind King Kay's premium fitness platform. This mobile-first web application combines AI-powered body analysis, nutrition tracking, and mindset coaching into a unified experience.

## ✨ Key Features
-   **Mobile-First Premium UI**: Dark mode aesthetic with "Sloe Volt" neon accents, designed for iOS/Android browsers.
-   **AI Body Analysis**: Upload a photo for an instant body fat estimate, muscle development score, and goal recommendation (Cut/Bulk/Recomp).
-   **Smart Meal Tracking**: Snap a pic of your food for AI-driven macro breakdowns (Calories, Protein, Carbs, Fats).
-   **Mindset Daily**: A 30-day mental conditioning program built-in.
-   **Supabase Backend**: Centralized Auth and DB (PostgreSQL) for cross-device data syncing.

## 🛠️ Tech Stack
-   **Frontend**: React (Vite), TypeScript
-   **Styling**: Tailwind CSS v4 (using `@tailwindcss/vite`)
-   **Backend**: Supabase (Auth, Database, RLS)
-   **AI**: Google Gemini API (for analysis)
-   **Commerce**: Shopify Buy Button Integration

## 🚀 Getting Started

### 1. Prerequisites
-   Node.js (v18+)
-   Supabase Project (Live)

### 2. Installation
```bash
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
VITE_GEMINI_API_KEY=your_key_here
VITE_SHOPIFY_STORE_DOMAIN=sloe-fit.myshopify.com
VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_shopify_token
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run Locally
```bash
npm run dev
```

## 🏗️ Deployment
Ready for Vercel or Netlify. Ensure environment variables are set in the deployment dashboard.

## 📚 Documentation
For detailed architectural context and project state for AI assistants, see:
- [Product Requirements Document (PRD)](docs/PRD.md) - Full product specifications
- [LLM Context](docs/LLM_CONTEXT.md) - Complete project context for AI assistants
- [Change Log](docs/CHANGELOG.md) - All changes and component inventory

