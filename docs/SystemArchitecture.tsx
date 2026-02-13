import React, { useState, useMemo } from 'react';

// Icons (using simple SVG representations for standalone use)
const Icons = {
  Box: () => <span className="material-symbols-outlined">inventory_2</span>,
  Map: () => <span className="material-symbols-outlined">map</span>,
  AlertTriangle: () => <span className="material-symbols-outlined">warning</span>,
  Settings: () => <span className="material-symbols-outlined">settings</span>,
  Server: () => <span className="material-symbols-outlined">dns</span>,
  CheckSquare: () => <span className="material-symbols-outlined">check_box</span>,
  DollarSign: () => <span className="material-symbols-outlined">attach_money</span>,
  Database: () => <span className="material-symbols-outlined">database</span>,
  Shield: () => <span className="material-symbols-outlined">shield</span>,
  Wifi: () => <span className="material-symbols-outlined">wifi</span>,
  BarChart: () => <span className="material-symbols-outlined">bar_chart</span>,
  Users: () => <span className="material-symbols-outlined">accessibility_new</span>,
  GitBranch: () => <span className="material-symbols-outlined">fork_right</span>,
  Heart: () => <span className="material-symbols-outlined">favorite</span>,
};

const SloeFitSystemArchitecture: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState('system');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // ============================================================================
  // SLOE FIT ARCHITECTURE DATA - 14 LAYERS
  // ============================================================================
  const architecture = useMemo(() => ({
    meta: {
      name: "Sloe Fit AI Coach",
      version: "2.0.0",
      generated: new Date().toISOString(),
      totalFeatures: 12,
      totalState: 24,
      totalFailures: 28,
      description: "AI-powered fitness coaching with workout generation, meal tracking, body analysis, and BYOC trainer platform"
    },

    // =========================================================================
    // LAYER 1: SYSTEM MAP
    // =========================================================================
    systemMap: {
      features: [
        {
          id: "feature_onboarding",
          name: "Onboarding",
          isInit: true,
          reads: [],
          writes: ["userProfile", "goals", "equipment", "experience", "nutritionTargets"],
          connections: ["feature_dashboard", "feature_workoutGen", "feature_mealTracker"]
        },
        {
          id: "feature_bodyAnalysis",
          name: "Body Analysis",
          isInit: false,
          reads: ["userProfile", "goals"],
          writes: ["bodyComposition", "bfPercentage", "muscleAssessment"],
          connections: ["feature_dashboard", "feature_progressPhotos"]
        },
        {
          id: "feature_recoveryCheckIn",
          name: "Recovery Check-In",
          isInit: false,
          reads: ["lastWorkout", "recentWorkouts"],
          writes: ["recoveryState", "energyLevel", "sleepHours", "sorenessAreas"],
          connections: ["feature_workoutGen"]
        },
        {
          id: "feature_workoutGen",
          name: "AI Workout Generation",
          isInit: false,
          reads: ["userProfile", "recoveryState", "equipment", "goals", "recentWorkouts"],
          writes: ["currentWorkout", "workoutPlan"],
          connections: ["feature_workoutSession"]
        },
        {
          id: "feature_workoutSession",
          name: "Workout Session",
          isInit: false,
          reads: ["currentWorkout", "workoutPlan"],
          writes: ["completedWorkout", "workoutStats", "setLogs", "exerciseProgress"],
          connections: ["feature_dashboard", "feature_workoutHistory"]
        },
        {
          id: "feature_mealTracker",
          name: "Meal Tracker",
          isInit: false,
          reads: ["nutritionTargets", "dailyNutrition"],
          writes: ["mealEntry", "dailyNutrition", "macros"],
          connections: ["feature_dashboard", "feature_weeklyNutrition"]
        },
        {
          id: "feature_weeklyNutrition",
          name: "Weekly Nutrition Summary",
          isInit: false,
          reads: ["weeklyNutrition", "nutritionTargets", "goals"],
          writes: ["weeklyInsights", "adherenceScore"],
          connections: ["feature_dashboard"]
        },
        {
          id: "feature_progressPhotos",
          name: "Progress Photos",
          isInit: false,
          reads: ["progressPhotos", "bodyComposition"],
          writes: ["progressPhotos", "transformationAnalysis"],
          connections: ["feature_bodyAnalysis"]
        },
        {
          id: "feature_mindset",
          name: "Mindset Coaching",
          isInit: false,
          reads: ["mindsetDay", "completedDays"],
          writes: ["mindsetProgress", "completedDays"],
          connections: ["feature_dashboard"]
        },
        {
          id: "feature_trainerDashboard",
          name: "Trainer Dashboard (BYOC)",
          isInit: false,
          reads: ["trainerClients", "assignedWorkouts", "clientMetrics"],
          writes: ["trainerTemplates", "assignedWorkouts", "trainerMessages", "inviteCodes"],
          connections: ["feature_clientView"]
        },
        {
          id: "feature_clientView",
          name: "Client-Trainer View",
          isInit: false,
          reads: ["assignedWorkouts", "trainerProfile", "trainerMessages"],
          writes: ["workoutCompletion", "messageReplies"],
          connections: ["feature_workoutSession"]
        },
        {
          id: "feature_supplements",
          name: "Supplement Recommendations",
          isInit: false,
          reads: ["userProfile", "goals", "supplementPreferences"],
          writes: ["supplementRecommendations", "shopifyCart"],
          connections: ["feature_dashboard"]
        }
      ],
      state: [
        { id: "userProfile", name: "User Profile", type: "object", readers: ["feature_bodyAnalysis", "feature_workoutGen", "feature_mealTracker", "feature_supplements"], writers: ["feature_onboarding"] },
        { id: "goals", name: "Fitness Goals", type: "string", readers: ["feature_workoutGen", "feature_mealTracker", "feature_bodyAnalysis"], writers: ["feature_onboarding"] },
        { id: "nutritionTargets", name: "Daily Nutrition Targets", type: "object", readers: ["feature_mealTracker", "feature_weeklyNutrition"], writers: ["feature_onboarding", "feature_bodyAnalysis"] },
        { id: "recoveryState", name: "Recovery State", type: "object", readers: ["feature_workoutGen"], writers: ["feature_recoveryCheckIn"] },
        { id: "currentWorkout", name: "Current Workout", type: "object", readers: ["feature_workoutSession"], writers: ["feature_workoutGen"] },
        { id: "dailyNutrition", name: "Daily Nutrition Log", type: "object", readers: ["feature_mealTracker", "feature_dashboard"], writers: ["feature_mealTracker"] },
        { id: "workoutStatus", name: "Workout Status", type: "enum", readers: ["feature_dashboard"], writers: ["feature_workoutSession", "feature_recoveryCheckIn"] },
        { id: "recentWorkouts", name: "Recent Workouts (7 days)", type: "array", readers: ["feature_workoutGen", "feature_recoveryCheckIn"], writers: ["feature_workoutSession"] }
      ]
    },

    // =========================================================================
    // LAYER 2: JOURNEY MAP
    // =========================================================================
    journeyMap: {
      userStates: [
        {
          id: "uninitialized",
          name: "New User (Uninitialized)",
          entryCondition: "First app open or logout",
          availableActions: ["Sign up", "Login"],
          blockedActions: [
            { action: "Dashboard", reason: "No user session" },
            { action: "Workouts", reason: "Profile not complete" },
            { action: "Meal Tracking", reason: "No nutrition targets" }
          ],
          exitConditions: ["Complete signup/login"]
        },
        {
          id: "onboarding",
          name: "Onboarding In Progress",
          entryCondition: "Authenticated but onboarding_complete = false",
          availableActions: ["Continue onboarding", "Skip (limited)"],
          blockedActions: [
            { action: "AI Workouts", reason: "Need profile data for personalization" },
            { action: "Body Analysis", reason: "Need baseline goals" }
          ],
          exitConditions: ["Complete all onboarding steps"]
        },
        {
          id: "active_free",
          name: "Active User (Trial)",
          entryCondition: "Onboarding complete, trial_started_at within 7 days",
          availableActions: ["All features"],
          blockedActions: [],
          exitConditions: ["Trial expires", "Subscribe", "Inactivity > 30 days"]
        },
        {
          id: "active_subscribed",
          name: "Active Subscriber",
          entryCondition: "subscription_status = 'active'",
          availableActions: ["All features", "Priority support"],
          blockedActions: [],
          exitConditions: ["Subscription expires", "Cancel subscription"]
        },
        {
          id: "expired",
          name: "Expired/Lapsed",
          entryCondition: "subscription_status = 'expired' OR trial > 7 days",
          availableActions: ["View dashboard (limited)", "Subscribe", "View history (read-only)"],
          blockedActions: [
            { action: "AI Workouts", reason: "Subscription required" },
            { action: "Meal Analysis", reason: "AI features gated" }
          ],
          exitConditions: ["Resubscribe"]
        },
        {
          id: "in_workout",
          name: "Active Workout Session",
          entryCondition: "workoutStatus = 'active'",
          availableActions: ["Log sets", "Rest timer", "Skip exercise", "Complete workout"],
          blockedActions: [
            { action: "Start new workout", reason: "Already in session" },
            { action: "Tab navigation", reason: "Must complete or exit workout" }
          ],
          exitConditions: ["Complete workout", "Cancel workout"]
        },
        {
          id: "trainer_role",
          name: "Trainer User",
          entryCondition: "role = 'trainer'",
          availableActions: ["Trainer Dashboard", "Client management", "Template builder", "All consumer features"],
          blockedActions: [],
          exitConditions: ["Role change (admin only)"]
        },
        {
          id: "client_role",
          name: "Trainer's Client",
          entryCondition: "role = 'client' AND trainer_id IS NOT NULL",
          availableActions: ["View assigned workouts", "Message trainer", "All consumer features"],
          blockedActions: [
            { action: "AI workout generation", reason: "Trainer assigns workouts" }
          ],
          exitConditions: ["Trainer removes client", "Client leaves trainer"]
        }
      ],
      criticalPaths: [
        {
          name: "First-Time Setup",
          steps: ["Open app", "Sign up", "Complete onboarding (5 steps)", "Body analysis (optional)", "First workout"],
          dropoffRisks: ["Onboarding step 4 (quiz feels long)", "Body photo upload (privacy concern)"]
        },
        {
          name: "Daily Workout Flow",
          steps: ["Open Dashboard", "Start workout", "Recovery check-in", "AI generates workout", "Complete session", "Log summary"],
          dropoffRisks: ["Recovery check-in (if too many fields)", "Long workout (>45 min)"]
        },
        {
          name: "Meal Logging Flow",
          steps: ["Open Meals tab", "Select input method", "Take/upload photo OR type meal", "Review macros", "Confirm save"],
          dropoffRisks: ["AI analysis slow (>5s)", "Macro estimation seems wrong"]
        },
        {
          name: "Trainer Onboarding (BYOC)",
          steps: ["Sign up as trainer", "Create first template", "Generate invite link", "Client joins", "Assign first workout"],
          dropoffRisks: ["Template builder complexity", "No clients joining invite"]
        }
      ]
    },

    // =========================================================================
    // LAYER 3: FAILURE MAP
    // =========================================================================
    failureMap: {
      failures: [
        // Network Failures
        {
          id: "fail_ai_timeout",
          category: "network",
          description: "AI API timeout (>30s)",
          detection: "Fetch promise rejects or timeout fires",
          fallback: "Use fallback workout template from workoutService.ts",
          userMessage: "AI is taking longer than expected. Using smart template.",
          recovery: "Retry AI button shown, user can retry",
          logging: "error",
          severity: "high"
        },
        {
          id: "fail_supabase_offline",
          category: "network",
          description: "Supabase unreachable",
          detection: "navigator.onLine false OR fetch fails",
          fallback: "Queue operations in offlineQueue, use localStorage cache",
          userMessage: "You're offline. Changes will sync when connected.",
          recovery: "Automatic sync on reconnection via onOnline handler",
          logging: "warning",
          severity: "medium"
        },
        {
          id: "fail_rate_limit",
          category: "network",
          description: "AI API rate limit (429)",
          detection: "Response status 429",
          fallback: "Client-side rate limiter kicks in, show retry timer",
          userMessage: "Too many requests. Please wait {X} seconds.",
          recovery: "Automatic unlock after window expires",
          logging: "warning",
          severity: "medium"
        },
        // AI/ML Failures
        {
          id: "fail_ai_hallucination",
          category: "ai",
          description: "AI returns invalid/impossible macros",
          detection: "Calories = 0 for visible food, or protein > calories",
          fallback: "Show warning, allow manual override",
          userMessage: "AI estimate may be incorrect. Please review.",
          recovery: "User edits macros manually",
          logging: "warning",
          severity: "medium"
        },
        {
          id: "fail_ai_parse_error",
          category: "ai",
          description: "AI response not valid JSON",
          detection: "JSON.parse throws, or schema validation fails",
          fallback: "Retry once, then use template/default",
          userMessage: "Couldn't process AI response. Using defaults.",
          recovery: "Automatic retry, then manual input option",
          logging: "error",
          severity: "high"
        },
        {
          id: "fail_photo_blurry",
          category: "ai",
          description: "Photo too blurry for analysis",
          detection: "AI returns low confidence or 'unclear' response",
          fallback: "Request retake with tips",
          userMessage: "Photo is unclear. Try better lighting and focus.",
          recovery: "User retakes photo",
          logging: "info",
          severity: "low"
        },
        // User Input Failures
        {
          id: "fail_invalid_macros",
          category: "input",
          description: "User enters impossible macro values",
          detection: "Validation: calories < 0, protein > 500g, etc.",
          fallback: "Block submission, show inline error",
          userMessage: "Please enter realistic values.",
          recovery: "User corrects input",
          logging: "info",
          severity: "low"
        },
        {
          id: "fail_photo_too_large",
          category: "input",
          description: "Photo file exceeds 5MB limit",
          detection: "file.size > 5 * 1024 * 1024",
          fallback: "Compress client-side OR reject with message",
          userMessage: "Photo too large. Please use a smaller image.",
          recovery: "User selects different photo",
          logging: "info",
          severity: "low"
        },
        // System Failures
        {
          id: "fail_localStorage_full",
          category: "system",
          description: "localStorage quota exceeded",
          detection: "QuotaExceededError on setItem",
          fallback: "Clear oldest cached items, retry",
          userMessage: "Storage full. Clearing old data...",
          recovery: "Automatic cleanup of TTL-expired items",
          logging: "warning",
          severity: "medium"
        },
        {
          id: "fail_sw_invalid_state",
          category: "system",
          description: "ServiceWorker InvalidStateError",
          detection: "DOMException code 11 on SW update",
          fallback: "Unregister corrupt SW, allow re-register on next load",
          userMessage: "(Silent - handled automatically)",
          recovery: "Automatic SW re-registration",
          logging: "warning",
          severity: "medium"
        },
        // Business Logic Failures
        {
          id: "fail_trial_expired",
          category: "business",
          description: "Trial period exceeded",
          detection: "trial_started_at + 7 days < now",
          fallback: "Show paywall, restrict AI features",
          userMessage: "Your trial has ended. Subscribe to continue.",
          recovery: "User subscribes",
          logging: "info",
          severity: "low"
        },
        {
          id: "fail_trainer_client_limit",
          category: "business",
          description: "Trainer exceeds client limit",
          detection: "client_count >= tier_limit",
          fallback: "Block new invites, show upgrade prompt",
          userMessage: "You've reached your client limit. Upgrade to add more.",
          recovery: "Trainer upgrades tier",
          logging: "info",
          severity: "low"
        },
        {
          id: "fail_orphaned_supplement",
          category: "business",
          description: "Supplement ID no longer in catalog",
          detection: "validateSupplementPreferences() detects unknown ID",
          fallback: "Remove orphaned ID, return cleaned preferences",
          userMessage: "(Silent - auto-cleaned)",
          recovery: "Automatic on profile load",
          logging: "info",
          severity: "low"
        }
      ]
    },

    // =========================================================================
    // LAYER 4: RULES ENGINE
    // =========================================================================
    rulesEngine: {
      rules: [
        {
          id: "rule_streak_increment",
          name: "Workout Streak Increment",
          type: "event",
          trigger: "workout_completed",
          condition: "workout.rating >= 3 AND previous_workout within 48h",
          action: "streak += 1",
          sideEffects: ["Update UI badge", "Check streak achievements"],
          notification: "Toast: '🔥 {streak} day streak!'"
        },
        {
          id: "rule_streak_reset",
          name: "Workout Streak Reset",
          type: "time",
          trigger: "48 hours since last workout",
          condition: "streak > 0",
          action: "streak = 0",
          sideEffects: ["Clear streak badge", "Log streak break"],
          notification: "None (silent reset)"
        },
        {
          id: "rule_recovery_adjustment",
          name: "Recovery-Based Volume Adjustment",
          type: "composite",
          trigger: "recovery_checkin_completed",
          condition: "energyLevel <= 2 OR sleepHours < 5 OR lastWorkoutRating <= 2",
          action: "Reduce workout volume by 20-40%",
          sideEffects: ["Modify workout prompt", "Add recovery note"],
          notification: "Workout adjusted for recovery"
        },
        {
          id: "rule_weekly_plan_refresh",
          name: "Weekly Plan Cache Invalidation",
          type: "time",
          trigger: "Week boundary crossed (Monday 00:00)",
          condition: "App becomes visible after week boundary",
          action: "Clear weeklyPlan cache, trigger refresh",
          sideEffects: ["Increment weekRefreshTrigger", "Update lastKnownWeekStart"],
          notification: "None"
        },
        {
          id: "rule_mindset_unlock",
          name: "Mindset Day Unlock",
          type: "time",
          trigger: "24 hours since last mindset completion",
          condition: "currentDay < 30",
          action: "Unlock next mindset day",
          sideEffects: ["Update mindsetProgress", "Enable next card"],
          notification: "Badge on Mindset tab"
        },
        {
          id: "rule_supplement_reminder",
          name: "Supplement Reminder",
          type: "threshold",
          trigger: "User completes 3 workouts without supplements",
          condition: "supplementPreferences.products.length === 0",
          action: "Show supplement recommendation card",
          sideEffects: ["Set reminderShown flag", "Track impression"],
          notification: "Card on Dashboard"
        },
        {
          id: "rule_trainer_inactivity_alert",
          name: "Trainer Client Inactivity Alert",
          type: "time",
          trigger: "Client inactive 7 days",
          condition: "role = 'trainer' AND client.lastWorkout > 7 days ago",
          action: "Show alert in trainer dashboard",
          sideEffects: ["Increment inactiveClientCount"],
          notification: "Badge on client card"
        },
        {
          id: "rule_nutrition_warning",
          name: "Consecutive Off-Target Warning",
          type: "threshold",
          trigger: "3 consecutive days under 80% calorie target",
          condition: "User is in 'cut' or 'bulk' goal",
          action: "Show nutrition intervention card",
          sideEffects: ["Log intervention trigger"],
          notification: "Alert on Dashboard"
        },
        {
          id: "rule_quiz_progress_expiry",
          name: "Quiz Progress Expiration",
          type: "time",
          trigger: "24 hours since quiz started",
          condition: "Quiz not completed",
          action: "Clear saved quiz progress from localStorage",
          sideEffects: ["Reset quiz step to 0"],
          notification: "None"
        }
      ]
    },

    // =========================================================================
    // LAYER 5: DEPENDENCY MAP
    // =========================================================================
    dependencyMap: {
      services: [
        {
          id: "dep_supabase",
          name: "Supabase",
          purpose: "Auth, PostgreSQL DB, Storage",
          criticality: "critical",
          failureMode: "timeout/error",
          fallback: "localStorage cache for reads, offline queue for writes",
          sla: "99.9%",
          cost: "$25/month (Pro tier)"
        },
        {
          id: "dep_openai",
          name: "OpenAI API",
          purpose: "Workout generation, meal analysis, body analysis",
          criticality: "degraded",
          failureMode: "timeout/rate-limit/error",
          fallback: "Template workouts, manual meal entry, skip analysis",
          sla: "99.5%",
          cost: "~$0.002-0.01 per API call"
        },
        {
          id: "dep_shopify",
          name: "Shopify Storefront API",
          purpose: "Supplement e-commerce, cart management",
          criticality: "optional",
          failureMode: "timeout/error",
          fallback: "Hide supplement features, show error toast",
          sla: "99.99%",
          cost: "Transaction-based (2.9% + $0.30)"
        },
        {
          id: "dep_sentry",
          name: "Sentry",
          purpose: "Error tracking, performance monitoring",
          criticality: "optional",
          failureMode: "silent fail",
          fallback: "Console logging only",
          sla: "99.9%",
          cost: "$26/month (Team tier)"
        },
        {
          id: "dep_vercel",
          name: "Vercel",
          purpose: "Hosting, API routes, edge functions",
          criticality: "critical",
          failureMode: "5xx errors",
          fallback: "None (hosting is required)",
          sla: "99.99%",
          cost: "$20/month (Pro tier)"
        },
        {
          id: "dep_google_fonts",
          name: "Google Fonts",
          purpose: "Lexend, Inter, Material Symbols",
          criticality: "degraded",
          failureMode: "load failure",
          fallback: "System fonts",
          sla: "99.9%",
          cost: "Free"
        }
      ]
    },

    // =========================================================================
    // LAYER 6: VALIDATION SCHEMA
    // =========================================================================
    validationSchema: {
      entryPoints: [
        {
          id: "val_onboarding_quiz",
          name: "Onboarding Quiz",
          type: "user",
          validations: {
            required: ["goal", "height_inches", "weight_lbs", "age", "gender", "activity_level"],
            format: { age: "integer" },
            range: { height_inches: { min: 36, max: 96 }, weight_lbs: { min: 50, max: 600 }, age: { min: 13, max: 120 } },
            business: ["Gender must be male/female", "Activity level must be valid enum"]
          },
          sanitization: "None (trusted select inputs)",
          rejection: "Inline validation errors, blocked submit",
          fallback: null
        },
        {
          id: "val_meal_photo",
          name: "Meal Photo Upload",
          type: "file",
          validations: {
            required: ["image"],
            format: { type: "image/jpeg|image/png|image/webp" },
            range: { size: { max: 5242880 } },
            business: []
          },
          sanitization: "Client-side compression if >2MB",
          rejection: "Toast error with file type/size message",
          fallback: "Text meal input"
        },
        {
          id: "val_ai_workout_response",
          name: "AI Workout Response",
          type: "ai",
          validations: {
            required: ["title", "exercises", "warmup"],
            format: { exercises: "array", duration: "number" },
            range: { exercises: { min: 3, max: 12 }, duration: { min: 10, max: 90 } },
            business: ["Each exercise must have name, sets, reps", "Sets must be 1-10", "Reps must be 1-50"]
          },
          sanitization: "JSON schema validation",
          rejection: "Use fallback template",
          fallback: "workoutService.getFallbackWorkout()"
        },
        {
          id: "val_ai_meal_response",
          name: "AI Meal Analysis Response",
          type: "ai",
          validations: {
            required: ["foods", "macros"],
            format: { macros: { calories: "number", protein: "number", carbs: "number", fats: "number" } },
            range: { calories: { min: 0, max: 5000 }, protein: { min: 0, max: 300 } },
            business: ["Calories = 0 triggers warning", "Protein > calories is invalid"]
          },
          sanitization: "Clamp values to valid ranges",
          rejection: "Show warning, allow manual override",
          fallback: "Manual macro entry"
        },
        {
          id: "val_trainer_template",
          name: "Trainer Workout Template",
          type: "user",
          validations: {
            required: ["name", "exercises"],
            format: { exercises: "array" },
            range: { name: { minLength: 3, maxLength: 100 }, exercises: { min: 1, max: 20 } },
            business: ["Template name must be unique per trainer"]
          },
          sanitization: "XSS (strip HTML from name/notes)",
          rejection: "Inline errors, blocked save",
          fallback: null
        },
        {
          id: "val_text_meal",
          name: "Text/Voice Meal Input",
          type: "user",
          validations: {
            required: ["description"],
            format: {},
            range: { description: { minLength: 3, maxLength: 500 } },
            business: []
          },
          sanitization: "Prompt injection prevention (sanitizeAIInput)",
          rejection: "Toast: 'Please describe your meal'",
          fallback: null
        }
      ]
    },

    // =========================================================================
    // LAYER 7: COST MODEL
    // =========================================================================
    costModel: {
      operations: [
        {
          id: "cost_workout_gen",
          name: "AI Workout Generation",
          trigger: "User starts workout with recovery check-in",
          frequency: "1x per user per day",
          unitCost: 0.003,
          dailyCost: 30,
          optimization: "Rate limit to 10/hour, use templates on failure",
          budgetAlert: 100
        },
        {
          id: "cost_meal_photo",
          name: "Meal Photo Analysis",
          trigger: "User uploads meal photo",
          frequency: "3x per user per day",
          unitCost: 0.005,
          dailyCost: 150,
          optimization: "Client-side rate limit (10/min), image compression",
          budgetAlert: 500
        },
        {
          id: "cost_body_analysis",
          name: "Body Photo Analysis",
          trigger: "User uploads body photo",
          frequency: "1x per user per week",
          unitCost: 0.008,
          dailyCost: 11,
          optimization: "Rate limit (5/hour), cache 7-day results",
          budgetAlert: 50
        },
        {
          id: "cost_text_meal",
          name: "Text Meal Analysis",
          trigger: "User types/speaks meal description",
          frequency: "2x per user per day",
          unitCost: 0.001,
          dailyCost: 20,
          optimization: "Client-side rate limit (15/min)",
          budgetAlert: 100
        },
        {
          id: "cost_supabase_storage",
          name: "Supabase Storage (Photos)",
          trigger: "Photo upload (progress, meals)",
          frequency: "5x per user per day",
          unitCost: 0.0001,
          dailyCost: 5,
          optimization: "Image compression to <500KB, cleanup old meal photos",
          budgetAlert: 20
        },
        {
          id: "cost_supabase_db",
          name: "Supabase Database",
          trigger: "Any read/write operation",
          frequency: "50x per user per day",
          unitCost: 0.000002,
          dailyCost: 1,
          optimization: "Batch writes, use localStorage cache",
          budgetAlert: 10
        }
      ],
      summary: {
        costPerUserPerDay: 0.022,
        majorCostDrivers: ["Meal Photo Analysis (68%)", "AI Workout Generation (14%)", "Text Meal Analysis (9%)"],
        optimizationOpportunities: ["Batch meal photos", "Cache workout templates", "Aggressive client-side rate limiting"]
      }
    },

    // =========================================================================
    // LAYER 8: PERSISTENCE LAYER
    // =========================================================================
    persistenceLayer: {
      entities: [
        {
          id: "pers_user_profile",
          name: "User Profile",
          storageLocation: "both",
          syncStrategy: "offline-first",
          conflictResolution: "server-wins",
          ttl: "Until account deletion",
          backup: "Supabase automatic backups",
          deletion: "soft (deleted_at timestamp)"
        },
        {
          id: "pers_workout_logs",
          name: "Workout Logs",
          storageLocation: "both",
          syncStrategy: "offline-first",
          conflictResolution: "last-write-wins",
          ttl: "Indefinite",
          backup: "Supabase automatic backups",
          deletion: "soft"
        },
        {
          id: "pers_nutrition_logs",
          name: "Nutrition Logs",
          storageLocation: "both",
          syncStrategy: "offline-first",
          conflictResolution: "merge (additive)",
          ttl: "Indefinite",
          backup: "Supabase automatic backups",
          deletion: "hard (on request)"
        },
        {
          id: "pers_meal_photos",
          name: "Meal Photos",
          storageLocation: "remote",
          syncStrategy: "real-time",
          conflictResolution: "N/A (immutable)",
          ttl: "90 days (auto-cleanup)",
          backup: "Supabase Storage",
          deletion: "hard"
        },
        {
          id: "pers_progress_photos",
          name: "Progress Photos",
          storageLocation: "remote",
          syncStrategy: "real-time",
          conflictResolution: "N/A (immutable)",
          ttl: "Until account deletion",
          backup: "Supabase Storage",
          deletion: "soft (user can restore)"
        },
        {
          id: "pers_offline_queue",
          name: "Offline Operation Queue",
          storageLocation: "local",
          syncStrategy: "flush on reconnect",
          conflictResolution: "retry with backoff",
          ttl: "7 days",
          backup: "None (ephemeral)",
          deletion: "hard (after sync)"
        },
        {
          id: "pers_weekly_plan_cache",
          name: "Weekly Plan Cache",
          storageLocation: "local",
          syncStrategy: "polling (on visibility change)",
          conflictResolution: "invalidate on week boundary",
          ttl: "1 week",
          backup: "None (cache)",
          deletion: "hard (on expiry)"
        },
        {
          id: "pers_quiz_progress",
          name: "Quiz Progress",
          storageLocation: "local",
          syncStrategy: "N/A (local only)",
          conflictResolution: "N/A",
          ttl: "24 hours",
          backup: "None",
          deletion: "hard (on expiry)"
        }
      ]
    },

    // =========================================================================
    // LAYER 9: SECURITY LAYER
    // =========================================================================
    securityLayer: {
      features: [
        {
          id: "sec_auth",
          feature: "Authentication",
          authRequired: true,
          authFlow: "Email (Supabase Auth)",
          permissions: [],
          dataClassification: "sensitive",
          encryption: { atRest: true, inTransit: true, e2e: false },
          auditEvents: ["login", "logout", "password_reset", "email_confirm"],
          compliance: ["GDPR (consent)", "CCPA"]
        },
        {
          id: "sec_user_profile",
          feature: "User Profile",
          authRequired: true,
          authFlow: "Session token",
          permissions: ["owner:true"],
          dataClassification: "pii",
          encryption: { atRest: true, inTransit: true, e2e: false },
          auditEvents: ["view", "edit"],
          compliance: ["GDPR (right to access, deletion)"]
        },
        {
          id: "sec_body_photos",
          feature: "Body Photos",
          authRequired: true,
          authFlow: "Session token + RLS",
          permissions: ["owner:true", "trainer_id:read (if client)"],
          dataClassification: "sensitive-pii",
          encryption: { atRest: true, inTransit: true, e2e: false },
          auditEvents: ["upload", "view", "delete"],
          compliance: ["GDPR (explicit consent)", "Data minimization"]
        },
        {
          id: "sec_ai_prompts",
          feature: "AI API Calls",
          authRequired: true,
          authFlow: "Server-side only (no client keys)",
          permissions: ["authenticated"],
          dataClassification: "sensitive",
          encryption: { atRest: false, inTransit: true, e2e: false },
          auditEvents: ["request", "response_error"],
          compliance: ["No PII in prompts (anonymized)"]
        },
        {
          id: "sec_trainer_clients",
          feature: "Trainer-Client Relationship",
          authRequired: true,
          authFlow: "Session token + RLS",
          permissions: ["role:trainer OR trainer_id:match"],
          dataClassification: "pii",
          encryption: { atRest: true, inTransit: true, e2e: false },
          auditEvents: ["client_add", "client_remove", "message_send"],
          compliance: ["GDPR (data processor agreement)"]
        },
        {
          id: "sec_shopify_checkout",
          feature: "Shopify Checkout",
          authRequired: false,
          authFlow: "Storefront Access Token (public)",
          permissions: [],
          dataClassification: "public",
          encryption: { atRest: false, inTransit: true, e2e: false },
          auditEvents: ["cart_create", "cart_add", "checkout_redirect"],
          compliance: ["PCI-DSS (handled by Shopify)"]
        }
      ]
    },

    // =========================================================================
    // LAYER 10: RESILIENCE LAYER
    // =========================================================================
    resilienceLayer: {
      features: [
        {
          id: "res_dashboard",
          feature: "Dashboard",
          offlineSupport: "full",
          queueOperations: [],
          retryStrategy: { type: "none", maxRetries: 0 },
          optimisticUI: { enabled: false, rollback: "" },
          syncIndicator: "None (read-only cached)",
          conflictHandling: "N/A"
        },
        {
          id: "res_meal_logging",
          feature: "Meal Logging",
          offlineSupport: "partial",
          queueOperations: ["saveMeal", "uploadPhoto"],
          retryStrategy: { type: "exponential", maxRetries: 5 },
          optimisticUI: { enabled: true, rollback: "Toast: 'Meal save failed. Tap to retry.'" },
          syncIndicator: "Badge on meal card (pending sync)",
          conflictHandling: "Additive merge (both versions kept)"
        },
        {
          id: "res_workout_logging",
          feature: "Workout Logging",
          offlineSupport: "partial",
          queueOperations: ["saveWorkout", "saveSets"],
          retryStrategy: { type: "exponential", maxRetries: 5 },
          optimisticUI: { enabled: true, rollback: "Toast: 'Workout save failed.'" },
          syncIndicator: "Badge on workout card",
          conflictHandling: "Last-write-wins"
        },
        {
          id: "res_ai_workout",
          feature: "AI Workout Generation",
          offlineSupport: "none",
          queueOperations: [],
          retryStrategy: { type: "immediate", maxRetries: 1 },
          optimisticUI: { enabled: false, rollback: "" },
          syncIndicator: "Loading spinner, then fallback template",
          conflictHandling: "N/A (stateless)"
        },
        {
          id: "res_ai_meal",
          feature: "AI Meal Analysis",
          offlineSupport: "none",
          queueOperations: [],
          retryStrategy: { type: "immediate", maxRetries: 1 },
          optimisticUI: { enabled: false, rollback: "" },
          syncIndicator: "Loading state with cancel button",
          conflictHandling: "N/A"
        },
        {
          id: "res_profile_sync",
          feature: "Profile Sync",
          offlineSupport: "full",
          queueOperations: ["updateProfile"],
          retryStrategy: { type: "exponential", maxRetries: 3 },
          optimisticUI: { enabled: true, rollback: "Restore previous values, toast error" },
          syncIndicator: "Subtle sync icon in header",
          conflictHandling: "Server-wins with toast notification"
        },
        {
          id: "res_trainer_messaging",
          feature: "Trainer Messaging",
          offlineSupport: "partial",
          queueOperations: ["sendMessage"],
          retryStrategy: { type: "exponential", maxRetries: 5 },
          optimisticUI: { enabled: true, rollback: "Show 'failed' status on message" },
          syncIndicator: "Checkmark/clock icon on message",
          conflictHandling: "Chronological merge"
        }
      ]
    },

    // =========================================================================
    // LAYER 11: OBSERVABILITY LAYER
    // =========================================================================
    observabilityLayer: {
      features: [
        {
          id: "obs_ai_calls",
          feature: "AI API Calls",
          metrics: [
            { name: "ai_call_count", type: "counter", alertAt: null },
            { name: "ai_latency_ms", type: "histogram", alertAt: 30000 },
            { name: "ai_error_rate", type: "gauge", alertAt: 0.05 }
          ],
          logs: {
            events: ["ai_request_start", "ai_request_success", "ai_request_error", "ai_fallback_used"],
            level: "info"
          },
          traces: {
            spans: ["api_call", "json_parse", "validation"]
          },
          alerts: [
            { condition: "ai_error_rate > 5% for 5 min", routing: "oncall" },
            { condition: "ai_latency_p99 > 30s", routing: "slack" }
          ]
        },
        {
          id: "obs_auth",
          feature: "Authentication",
          metrics: [
            { name: "login_count", type: "counter", alertAt: null },
            { name: "login_failure_rate", type: "gauge", alertAt: 0.2 },
            { name: "signup_conversion", type: "gauge", alertAt: null }
          ],
          logs: {
            events: ["login_attempt", "login_success", "login_failure", "signup", "logout"],
            level: "info"
          },
          traces: {
            spans: ["auth_check", "session_validate"]
          },
          alerts: [
            { condition: "login_failure_rate > 20% for 10 min", routing: "security" }
          ]
        },
        {
          id: "obs_offline_queue",
          feature: "Offline Queue",
          metrics: [
            { name: "queue_depth", type: "gauge", alertAt: 50 },
            { name: "queue_flush_success", type: "counter", alertAt: null },
            { name: "queue_retry_exhausted", type: "counter", alertAt: 10 }
          ],
          logs: {
            events: ["queue_add", "queue_flush", "queue_retry", "queue_fail"],
            level: "warning"
          },
          traces: {
            spans: ["queue_process", "sync_attempt"]
          },
          alerts: [
            { condition: "queue_retry_exhausted > 10/hour", routing: "oncall" }
          ]
        },
        {
          id: "obs_pwa",
          feature: "PWA / Service Worker",
          metrics: [
            { name: "sw_registration_success", type: "counter", alertAt: null },
            { name: "sw_registration_error", type: "counter", alertAt: 5 },
            { name: "sw_update_available", type: "counter", alertAt: null }
          ],
          logs: {
            events: ["sw_register", "sw_update", "sw_error", "sw_recovery"],
            level: "warning"
          },
          traces: {
            spans: ["sw_update_check"]
          },
          alerts: [
            { condition: "sw_registration_error spike", routing: "slack" }
          ]
        }
      ]
    },

    // =========================================================================
    // LAYER 12: ACCESSIBILITY LAYER
    // =========================================================================
    accessibilityLayer: {
      features: [
        {
          id: "a11y_navigation",
          feature: "Navigation (Bottom Nav, Tabs)",
          wcagLevel: "AA",
          screenReader: {
            labels: ["Home", "Body", "Meals", "Mind"],
            announcements: ["Tab changed to {tab}"]
          },
          keyboard: {
            tabOrder: ["Home", "Body", "Meals", "Mind", "Header actions"],
            shortcuts: []
          },
          cognitive: {
            readingLevel: "Grade 6",
            decisionsRequired: 1
          },
          testing: ["axe-core", "manual VoiceOver"]
        },
        {
          id: "a11y_workout_session",
          feature: "Workout Session",
          wcagLevel: "AA",
          screenReader: {
            labels: ["Exercise name", "Set {n} of {total}", "Weight input", "Reps input", "Complete set button"],
            announcements: ["Set completed", "Exercise completed", "Workout finished"]
          },
          keyboard: {
            tabOrder: ["Weight", "Reps", "Complete", "Skip", "Rest Timer"],
            shortcuts: ["Enter: Complete set", "Escape: Pause"]
          },
          cognitive: {
            readingLevel: "Grade 6",
            decisionsRequired: 2
          },
          testing: ["axe-core", "manual testing with screen reader"]
        },
        {
          id: "a11y_meal_tracker",
          feature: "Meal Tracker",
          wcagLevel: "AA",
          screenReader: {
            labels: ["Photo mode", "Text mode", "Calories {n}", "Protein {n}g"],
            announcements: ["Photo captured", "Analyzing meal...", "Macros updated"]
          },
          keyboard: {
            tabOrder: ["Photo button", "Text input", "Macro fields", "Save"],
            shortcuts: []
          },
          cognitive: {
            readingLevel: "Grade 8",
            decisionsRequired: 3
          },
          testing: ["axe-core"]
        },
        {
          id: "a11y_forms",
          feature: "Forms (Onboarding, Settings)",
          wcagLevel: "AA",
          screenReader: {
            labels: ["All form fields with associated labels"],
            announcements: ["Error: {field} is required", "Form submitted successfully"]
          },
          keyboard: {
            tabOrder: ["Sequential through all fields"],
            shortcuts: ["Enter: Submit"]
          },
          cognitive: {
            readingLevel: "Grade 8",
            decisionsRequired: "Varies by form"
          },
          testing: ["axe-core", "manual keyboard navigation"]
        }
      ]
    },

    // =========================================================================
    // LAYER 13: EVOLUTION LAYER
    // =========================================================================
    evolutionLayer: {
      features: [
        {
          id: "evo_schema",
          feature: "Database Schema",
          schema: {
            version: "1.6",
            migrations: [
              "migration_001_initial.sql",
              "migration_002_trainer_invites.sql",
              "migration_003_assigned_workouts.sql",
              "migration_004_trainer_messages.sql",
              "migration_005_progress_photos.sql",
              "migration_006_supplements.sql"
            ]
          },
          featureFlag: {
            name: "N/A",
            default: true,
            rolloutPercent: 100
          },
          api: {
            version: "v1",
            deprecated: null
          },
          rollout: {
            strategy: "big-bang (schema migrations)",
            rollback: "Migration rollback scripts"
          }
        },
        {
          id: "evo_ai_provider",
          feature: "AI Provider",
          schema: {
            version: "multi-provider",
            migrations: ["N/A (config-driven)"]
          },
          featureFlag: {
            name: "AI_PROVIDER",
            default: "openai",
            rolloutPercent: 100
          },
          api: {
            version: "dynamic",
            deprecated: null
          },
          rollout: {
            strategy: "env var switch",
            rollback: "Change AI_PROVIDER env var"
          }
        },
        {
          id: "evo_supplements",
          feature: "Supplement System",
          schema: {
            version: "1.0",
            migrations: ["migration_006_supplements.sql"]
          },
          featureFlag: {
            name: "supplements_enabled",
            default: true,
            rolloutPercent: 100
          },
          api: {
            version: "v1",
            deprecated: null
          },
          rollout: {
            strategy: "progressive (by user cohort)",
            rollback: "Hide supplement UI via feature flag"
          }
        },
        {
          id: "evo_byoc",
          feature: "BYOC (Trainer Platform)",
          schema: {
            version: "1.0",
            migrations: ["migration_002-005 (BYOC tables)"]
          },
          featureFlag: {
            name: "byoc_enabled",
            default: true,
            rolloutPercent: 100
          },
          api: {
            version: "v1",
            deprecated: null
          },
          rollout: {
            strategy: "invite-only beta, then GA",
            rollback: "Disable trainer role creation"
          }
        }
      ]
    },

    // =========================================================================
    // LAYER 14: EXPERIENCE LAYER
    // =========================================================================
    experienceLayer: {
      features: [
        {
          id: "exp_dashboard",
          feature: "Dashboard",
          performance: {
            loadBudget: "500ms",
            animation60fps: true,
            payloadMax: "50kb"
          },
          emotion: {
            expectedFeeling: "Motivated, ready to train",
            frustrationRisk: "Slow data load, stale info",
            delightOpportunity: "Streak celebration, progress visualization"
          },
          localization: {
            languages: ["en"],
            rtl: false
          },
          microinteraction: {
            loading: "skeleton",
            success: "subtle pulse on update"
          }
        },
        {
          id: "exp_workout_complete",
          feature: "Workout Completion",
          performance: {
            loadBudget: "200ms",
            animation60fps: true,
            payloadMax: "20kb"
          },
          emotion: {
            expectedFeeling: "Accomplished, proud",
            frustrationRisk: "Stats seem wrong, no celebration",
            delightOpportunity: "Confetti animation, motivational quote"
          },
          localization: {
            languages: ["en"],
            rtl: false
          },
          microinteraction: {
            loading: "instant",
            success: "confetti + haptic feedback"
          }
        },
        {
          id: "exp_meal_analysis",
          feature: "Meal Photo Analysis",
          performance: {
            loadBudget: "5000ms (AI)",
            animation60fps: true,
            payloadMax: "500kb (image)"
          },
          emotion: {
            expectedFeeling: "Curious, informed",
            frustrationRisk: "Slow analysis (>5s), wrong macros",
            delightOpportunity: "Instant feedback, accurate detection"
          },
          localization: {
            languages: ["en"],
            rtl: false
          },
          microinteraction: {
            loading: "progress ring with cancel",
            success: "slide-up macro card"
          }
        },
        {
          id: "exp_streak",
          feature: "Workout Streak",
          performance: {
            loadBudget: "100ms",
            animation60fps: true,
            payloadMax: "5kb"
          },
          emotion: {
            expectedFeeling: "Proud, competitive",
            frustrationRisk: "Streak lost unexpectedly",
            delightOpportunity: "Milestone celebrations (7, 30, 100 days)"
          },
          localization: {
            languages: ["en"],
            rtl: false
          },
          microinteraction: {
            loading: "instant",
            success: "fire emoji animation, toast"
          }
        },
        {
          id: "exp_progress_comparison",
          feature: "Before/After Comparison",
          performance: {
            loadBudget: "1000ms",
            animation60fps: true,
            payloadMax: "2MB (two images)"
          },
          emotion: {
            expectedFeeling: "Amazed at progress, motivated",
            frustrationRisk: "No visible change, poor photo quality",
            delightOpportunity: "Slider reveal, AI transformation insights"
          },
          localization: {
            languages: ["en"],
            rtl: false
          },
          microinteraction: {
            loading: "progressive image load",
            success: "smooth slider with haptic"
          }
        }
      ]
    }
  }), []);

  // Layer definitions with icons and phases
  const layers = [
    { id: 'system', name: 'System Map', Icon: Icons.Box, phase: 1 },
    { id: 'journey', name: 'Journey Map', Icon: Icons.Map, phase: 1 },
    { id: 'failure', name: 'Failure Map', Icon: Icons.AlertTriangle, phase: 1 },
    { id: 'rules', name: 'Rules Engine', Icon: Icons.Settings, phase: 1 },
    { id: 'dependency', name: 'Dependencies', Icon: Icons.Server, phase: 1 },
    { id: 'validation', name: 'Validation', Icon: Icons.CheckSquare, phase: 1 },
    { id: 'cost', name: 'Cost Model', Icon: Icons.DollarSign, phase: 1 },
    { id: 'persistence', name: 'Persistence', Icon: Icons.Database, phase: 2 },
    { id: 'security', name: 'Security', Icon: Icons.Shield, phase: 2 },
    { id: 'resilience', name: 'Resilience', Icon: Icons.Wifi, phase: 2 },
    { id: 'observability', name: 'Observability', Icon: Icons.BarChart, phase: 2 },
    { id: 'accessibility', name: 'Accessibility', Icon: Icons.Users, phase: 3 },
    { id: 'evolution', name: 'Evolution', Icon: Icons.GitBranch, phase: 3 },
    { id: 'experience', name: 'Experience', Icon: Icons.Heart, phase: 3 },
  ];

  const phaseColors = {
    1: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Core' },
    2: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', label: 'Infrastructure' },
    3: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', label: 'Human' }
  };

  const severityColors = {
    high: 'bg-red-500/20 border-red-500/40 text-red-400',
    medium: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
    low: 'bg-gray-500/20 border-gray-500/40 text-gray-400'
  };

  const criticalityColors = {
    critical: 'text-red-400',
    degraded: 'text-yellow-400',
    optional: 'text-gray-400'
  };

  // Render layer content
  const renderLayerContent = () => {
    switch (activeLayer) {
      case 'system':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Features → State → Connections</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {architecture.systemMap.features.map(feature => (
                <div
                  key={feature.id}
                  className={`p-4 rounded-lg border transition-all ${
                    hoveredItem === feature.id
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-gray-800/50 border-gray-700'
                  }`}
                  onMouseEnter={() => setHoveredItem(feature.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-white">{feature.name}</h4>
                    {feature.isInit && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">INIT</span>
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-green-400">Reads: {feature.reads.length > 0 ? feature.reads.join(', ') : '—'}</p>
                    <p className="text-blue-400">Writes: {feature.writes.join(', ')}</p>
                    <p className="text-gray-400">→ {feature.connections.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'journey':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">User States & Critical Paths</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-300 mb-3">User States</h4>
                <div className="space-y-3">
                  {architecture.journeyMap.userStates.map(state => (
                    <div key={state.id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <h5 className="font-medium text-white">{state.name}</h5>
                      <p className="text-sm text-gray-400">{state.entryCondition}</p>
                      {state.blockedActions.length > 0 && (
                        <div className="mt-2 text-xs">
                          <span className="text-red-400">Blocked: </span>
                          {state.blockedActions.map(b => b.action).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-300 mb-3">Critical Paths</h4>
                <div className="space-y-3">
                  {architecture.journeyMap.criticalPaths.map((path, idx) => (
                    <div key={idx} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <h5 className="font-medium text-white">{path.name}</h5>
                      <p className="text-sm text-gray-400">{path.steps.join(' → ')}</p>
                      <p className="text-xs text-yellow-400 mt-1">
                        ⚠️ Dropoff: {path.dropoffRisks.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'failure':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Failure Modes & Recovery</h3>
            <div className="space-y-3">
              {architecture.failureMap.failures.map(failure => (
                <div
                  key={failure.id}
                  className={`p-4 rounded-lg border ${severityColors[failure.severity as keyof typeof severityColors]}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{failure.description}</h4>
                    <span className="text-xs px-2 py-1 rounded bg-black/30">{failure.category}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-gray-500">Detection:</span> {failure.detection}</p>
                    <p><span className="text-gray-500">Fallback:</span> {failure.fallback}</p>
                    <p><span className="text-gray-500">User sees:</span> {failure.userMessage}</p>
                    <p><span className="text-gray-500">Recovery:</span> {failure.recovery}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'rules':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Business Rules Engine</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {architecture.rulesEngine.rules.map(rule => (
                <div key={rule.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-white">{rule.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">{rule.type}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">Trigger:</span> <span className="text-yellow-400">{rule.trigger}</span></p>
                    <p><span className="text-gray-500">Condition:</span> <span className="text-purple-400">{rule.condition}</span></p>
                    <p><span className="text-gray-500">Action:</span> <span className="text-green-400">{rule.action}</span></p>
                    {rule.notification !== "None" && (
                      <p className="text-gray-400 text-xs">📣 {rule.notification}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'dependency':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">External Dependencies</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {architecture.dependencyMap.services.map(service => (
                <div key={service.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{service.name}</h4>
                    <span className={`text-xs font-medium ${criticalityColors[service.criticality as keyof typeof criticalityColors]}`}>
                      {service.criticality.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{service.purpose}</p>
                  <div className="text-xs space-y-1">
                    <p><span className="text-gray-500">Failure:</span> {service.failureMode}</p>
                    <p><span className="text-gray-500">Fallback:</span> {service.fallback}</p>
                    <p><span className="text-gray-500">Cost:</span> {service.cost}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'validation':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Validation Schema</h3>
            <div className="space-y-4">
              {architecture.validationSchema.entryPoints.map(entry => (
                <div key={entry.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-semibold text-white">{entry.name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">{entry.type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Required fields:</p>
                      <p className="text-green-400">{entry.validations.required.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">On rejection:</p>
                      <p className="text-red-400">{entry.rejection}</p>
                    </div>
                  </div>
                  {entry.fallback && (
                    <p className="text-xs text-yellow-400 mt-2">Fallback: {entry.fallback}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'cost':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Cost Model</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30 text-center">
                <p className="text-2xl font-bold text-green-400">${architecture.costModel.summary.costPerUserPerDay}</p>
                <p className="text-sm text-gray-400">Cost per user/day</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <p className="text-sm font-medium text-yellow-400 mb-1">Major Drivers:</p>
                {architecture.costModel.summary.majorCostDrivers.map((d, i) => (
                  <p key={i} className="text-xs text-gray-400">{d}</p>
                ))}
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <p className="text-sm font-medium text-blue-400 mb-1">Optimization:</p>
                {architecture.costModel.summary.optimizationOpportunities.map((o, i) => (
                  <p key={i} className="text-xs text-gray-400">{o}</p>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {architecture.costModel.operations.map(op => (
                <div key={op.id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-white">{op.name}</h4>
                    <p className="text-xs text-gray-400">{op.trigger} • {op.frequency}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400">${op.unitCost}/call</p>
                    <p className="text-xs text-gray-400">${op.dailyCost}/day @10k users</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'persistence':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Data Persistence Strategy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {architecture.persistenceLayer.entities.map(entity => (
                <div key={entity.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h4 className="font-semibold text-white mb-2">{entity.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-gray-500">Storage:</span> <span className="text-blue-400">{entity.storageLocation}</span></p>
                    <p><span className="text-gray-500">Sync:</span> <span className="text-green-400">{entity.syncStrategy}</span></p>
                    <p><span className="text-gray-500">Conflict:</span> <span className="text-yellow-400">{entity.conflictResolution}</span></p>
                    <p><span className="text-gray-500">TTL:</span> {entity.ttl}</p>
                    <p><span className="text-gray-500">Deletion:</span> {entity.deletion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Security & Compliance</h3>
            <div className="space-y-4">
              {architecture.securityLayer.features.map(feature => (
                <div key={feature.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-white">{feature.feature}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      feature.dataClassification.includes('pii') ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {feature.dataClassification.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Auth</p>
                      <p className={feature.authRequired ? 'text-green-400' : 'text-gray-400'}>
                        {feature.authRequired ? `✓ ${feature.authFlow}` : 'Not required'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Encryption</p>
                      <p className="text-blue-400">
                        {feature.encryption.atRest && '🔒 Rest'} {feature.encryption.inTransit && '🔒 Transit'} {feature.encryption.e2e && '🔒 E2E'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Compliance</p>
                      <p className="text-purple-400">{Array.isArray(feature.compliance) ? feature.compliance.join(', ') : feature.compliance}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'resilience':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Offline & Resilience</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {architecture.resilienceLayer.features.map(feature => (
                <div key={feature.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{feature.feature}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      feature.offlineSupport === 'full' ? 'bg-green-500/20 text-green-400' :
                      feature.offlineSupport === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {feature.offlineSupport.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    {feature.queueOperations.length > 0 && (
                      <p><span className="text-gray-500">Queue:</span> {feature.queueOperations.join(', ')}</p>
                    )}
                    <p><span className="text-gray-500">Retry:</span> {feature.retryStrategy.type} (max {feature.retryStrategy.maxRetries})</p>
                    {feature.optimisticUI.enabled && (
                      <p className="text-blue-400 text-xs">✨ Optimistic UI enabled</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'observability':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Metrics, Logs & Alerts</h3>
            <div className="space-y-4">
              {architecture.observabilityLayer.features.map(feature => (
                <div key={feature.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h4 className="font-semibold text-white mb-3">{feature.feature}</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Metrics</p>
                      {feature.metrics.map((m, i) => (
                        <p key={i} className="text-green-400 text-xs">
                          {m.name} ({m.type})
                          {m.alertAt && <span className="text-red-400"> ⚠️@{m.alertAt}</span>}
                        </p>
                      ))}
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Log Events</p>
                      <p className="text-blue-400 text-xs">{feature.logs.events.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Alerts</p>
                      {feature.alerts.map((a, i) => (
                        <p key={i} className="text-yellow-400 text-xs">{a.condition} → {a.routing}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'accessibility':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Accessibility (WCAG)</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {architecture.accessibilityLayer.features.map(feature => (
                <div key={feature.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-white">{feature.feature}</h4>
                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                      WCAG {feature.wcagLevel}
                    </span>
                  </div>
                  <div className="text-sm space-y-2">
                    <p><span className="text-gray-500">Screen Reader:</span> {feature.screenReader.labels.slice(0, 2).join(', ')}...</p>
                    <p><span className="text-gray-500">Keyboard:</span> Tab order defined, {feature.keyboard.shortcuts.length} shortcuts</p>
                    <p><span className="text-gray-500">Cognitive:</span> {feature.cognitive.readingLevel}, {feature.cognitive.decisionsRequired} decisions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'evolution':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Evolution & Rollout</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {architecture.evolutionLayer.features.map(feature => (
                <div key={feature.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h4 className="font-semibold text-white mb-3">{feature.feature}</h4>
                  <div className="text-sm space-y-2">
                    <p><span className="text-gray-500">Schema:</span> v{feature.schema.version}</p>
                    <p><span className="text-gray-500">Feature Flag:</span>
                      <span className="text-blue-400"> {feature.featureFlag.name}</span>
                      <span className="text-gray-400"> ({feature.featureFlag.rolloutPercent}%)</span>
                    </p>
                    <p><span className="text-gray-500">Rollout:</span> {feature.rollout.strategy}</p>
                    <p><span className="text-gray-500">Rollback:</span> {feature.rollout.rollback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'experience':
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">User Experience</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {architecture.experienceLayer.features.map(feature => (
                <div key={feature.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h4 className="font-semibold text-white mb-3">{feature.feature}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Performance</p>
                      <p className="text-green-400">{feature.performance.loadBudget} load</p>
                      <p className="text-blue-400">{feature.performance.payloadMax} max</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Emotion</p>
                      <p className="text-green-400">😊 {feature.emotion.expectedFeeling}</p>
                      <p className="text-red-400 text-xs">⚠️ {feature.emotion.frustrationRisk}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500 text-xs">Delight</p>
                      <p className="text-yellow-400">✨ {feature.emotion.delightOpportunity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return <p className="text-gray-400">Select a layer to view details.</p>;
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(architecture, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sloe-fit-architecture.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{architecture.meta.name}</h1>
        <p className="text-gray-400">System Architecture • 14 Layers • {architecture.meta.totalFeatures} Features</p>
        <p className="text-sm text-gray-500 mt-1">{architecture.meta.description}</p>
      </div>

      {/* Phase Navigation */}
      <div className="mb-6">
        <div className="flex gap-4 mb-4">
          {([1, 2, 3] as const).map(phase => (
            <div key={phase} className={`px-4 py-2 rounded ${phaseColors[phase].bg} ${phaseColors[phase].border} border`}>
              <span className={phaseColors[phase].text}>
                Phase {phase}: {phaseColors[phase].label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Layer Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {layers.map(layer => {
          const colors = phaseColors[layer.phase as 1 | 2 | 3];
          return (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                ${activeLayer === layer.id
                  ? `${colors.bg} ${colors.border} border-2 ${colors.text}`
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'}
              `}
            >
              <layer.Icon />
              <span className="hidden sm:inline">{layer.name}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-gray-800 rounded-xl p-6 min-h-96">
        {renderLayerContent()}
      </div>

      {/* Export */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={exportJSON}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Export JSON
        </button>
      </div>

      {/* Stats Footer */}
      <div className="mt-8 flex justify-center gap-8 text-sm text-gray-500">
        <span>Features: {architecture.meta.totalFeatures}</span>
        <span>State Items: {architecture.systemMap.state.length}</span>
        <span>Failure Modes: {architecture.failureMap.failures.length}</span>
        <span>Rules: {architecture.rulesEngine.rules.length}</span>
        <span>Dependencies: {architecture.dependencyMap.services.length}</span>
      </div>
    </div>
  );
};

export default SloeFitSystemArchitecture;
