// ============================================================================
// AI Provider Abstraction Types
// ============================================================================

/**
 * Supported AI providers
 */
export type AIProviderType = 'openai' | 'anthropic' | 'google' | 'mistral';

/**
 * Common error types across all providers
 */
export type AIErrorType =
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'auth'
  | 'invalid_request'
  | 'server_error'
  | 'content_filter'
  | 'quota_exceeded'
  | 'unknown';

export interface AIError {
  type: AIErrorType;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  provider?: AIProviderType;
}

// ============================================================================
// Message Types (unified across providers)
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ContentPart {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string; // base64 data URL or https URL
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

// ============================================================================
// Meal Analysis Types
// ============================================================================

export interface Food {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface TextMealAnalysis {
  foods: Food[];
  totals: MacroTotals;
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  markdown: string;
}

export interface PhotoMealAnalysis {
  markdown: string;
  macros: MacroTotals | null;
  foods?: string[]; // Array of identified food names (parsed from JSON, not markdown)
}

export interface MealAnalysisInput {
  description?: string;
  imageBase64?: string;
  userGoal: string | null;
}

// ============================================================================
// Workout Types
// ============================================================================

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes?: string;
  target_muscles: string[];
}

export interface WorkoutSection {
  duration_minutes: number;
  exercises: { name: string; duration: string }[];
}

export interface GeneratedWorkout {
  title: string;
  duration_minutes: number;
  intensity: 'light' | 'moderate' | 'intense';
  recovery_adjusted: boolean;
  recovery_notes?: string;
  warmup: WorkoutSection;
  exercises: WorkoutExercise[];
  cooldown: WorkoutSection;
}

export interface RecoveryState {
  energyLevel: number;
  sleepHours: number;
  sorenessAreas: string[];
  lastWorkoutRating: number;
}

export interface UserProfile {
  goal?: string;
  training_experience?: string;
  equipment_access?: string;
  days_per_week?: number;
}

export interface WorkoutGenerationInput {
  profile: UserProfile;
  recovery: RecoveryState;
  recentWorkouts: { title: string; date: string; muscles: string[] }[];
}

// ============================================================================
// Weekly Nutrition Types
// ============================================================================

export interface NutritionLog {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface WeeklyNutritionInput {
  logs: NutritionLog[];
  targets: MacroTotals;
  goal: string | null;
}

export interface WeeklyNutritionInsights {
  adherence_score: number;
  summary: string;
  wins: string[];
  focus_area: string;
  tip: string;
}

// ============================================================================
// Body/Progress Analysis Types
// ============================================================================

export interface BodyAnalysisInput {
  imageBase64: string;
}

export interface ProgressAnalysisInput {
  images: string[]; // base64 data URLs
  metrics: string;
}

// ============================================================================
// Audio Transcription Types
// ============================================================================

export interface TranscriptionInput {
  audioBase64: string;
  mimeType: string;
}

export interface TranscriptionResult {
  text: string;
}

// ============================================================================
// AI Provider Interface
// ============================================================================

export interface AIProvider {
  readonly name: AIProviderType;

  /**
   * Basic chat completion
   */
  chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string>;

  /**
   * Analyze a meal from text description
   */
  analyzeTextMeal(
    description: string,
    userGoal: string | null
  ): Promise<TextMealAnalysis | null>;

  /**
   * Analyze a meal from photo
   */
  analyzeMealPhoto(
    imageBase64: string,
    userGoal: string | null
  ): Promise<PhotoMealAnalysis>;

  /**
   * Analyze body composition photo
   */
  analyzeBodyPhoto(imageBase64: string): Promise<string>;

  /**
   * Analyze progress photos
   */
  analyzeProgress(
    images: string[],
    metrics: string
  ): Promise<string>;

  /**
   * Generate personalized workout
   */
  generateWorkout(
    input: WorkoutGenerationInput
  ): Promise<GeneratedWorkout | null>;

  /**
   * Analyze weekly nutrition data
   */
  analyzeWeeklyNutrition(
    input: WeeklyNutritionInput
  ): Promise<WeeklyNutritionInsights | null>;

  /**
   * Transcribe audio to text (optional - not all providers support this)
   */
  transcribeAudio?(audioBlob: Blob): Promise<string | null>;

  /**
   * Generate a weekly training plan using multi-step reasoning
   */
  planWeek(
    input: WeeklyPlanGenerationInput
  ): Promise<WeeklyPlan | null>;
}

// ============================================================================
// Weekly Plan Types (Agent-based multi-step reasoning)
// ============================================================================

export interface WeeklyPlan {
  id: string;
  week_start: string; // ISO date (Monday)
  days: DayPlan[];
  reasoning: string; // Agent's explanation of plan construction
  progressive_overload_notes: string;
  created_at: string;
}

export interface DayPlan {
  day: number; // 0-6 (Sunday-Saturday)
  day_name: string; // "Monday", etc.
  workout: GeneratedWorkout | null; // null = rest day
  is_rest_day: boolean;
  rest_reason?: string; // "Recovery from legs", "Weekly deload", etc.
  focus_areas: string[];
}

export interface WeeklyPlanGenerationInput {
  profile: UserProfile;
  recentWorkouts: WorkoutHistoryItem[];
  recoveryPatterns: RecoveryPattern[];
  preferredSchedule?: number[]; // days user prefers to train (0-6)
}

export interface WorkoutHistoryItem {
  date: string;
  title: string;
  muscles: string[];
  volume: number; // total sets × reps
  exercises: {
    name: string;
    sets: number;
    reps: string;
    weight?: number;
  }[];
}

export interface RecoveryPattern {
  date: string;
  energyLevel: number;
  sleepHours: number;
  sorenessAreas: string[];
}

// ============================================================================
// API Response Types (for frontend consumption)
// ============================================================================

export interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: AIError;
  provider?: AIProviderType;
  durationMs?: number;
}
