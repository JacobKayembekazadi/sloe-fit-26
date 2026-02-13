import OpenAI from 'openai';
import { BODY_ANALYSIS_PROMPT, MEAL_ANALYSIS_PROMPT, PROGRESS_ANALYSIS_PROMPT, WORKOUT_GENERATION_PROMPT, TEXT_MEAL_ANALYSIS_PROMPT, WEEKLY_NUTRITION_PROMPT } from '../prompts';
import { RecoveryState } from '../components/RecoveryCheckIn';
import { UserProfile } from '../hooks/useUserData';
import { sanitizeForAI } from '../utils/validation';

// ============================================================================
// Configuration
// ============================================================================

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';

// Retry configuration
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const BASE_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 30000; // 30 seconds

// Debug mode - set to true to enable verbose logging
const DEBUG_MODE = import.meta.env.DEV;

if (!API_KEY) {
  console.warn("VITE_OPENAI_API_KEY not set. AI features will not work.");
}

const openai = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true
});

// ============================================================================
// Error Types and Classification
// ============================================================================

export type OpenAIErrorType =
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'auth'
  | 'invalid_request'
  | 'server_error'
  | 'content_filter'
  | 'quota_exceeded'
  | 'unknown';

export interface OpenAIError {
  type: OpenAIErrorType;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  originalError?: unknown;
}

function classifyError(error: unknown): OpenAIError {
  // Handle AbortError (timeout)
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'Request timed out. Please try again.',
      retryable: true,
      originalError: error
    };
  }

  // Handle network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network error. Please check your connection.',
      retryable: true,
      originalError: error
    };
  }

  // Handle OpenAI API errors
  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as { status: number; message?: string; error?: { message?: string; type?: string } };
    const status = apiError.status;
    const errorMessage = apiError.error?.message || apiError.message || 'Unknown error';

    switch (status) {
      case 401:
        return {
          type: 'auth',
          message: 'Authentication failed. Please check your API key.',
          retryable: false,
          originalError: error
        };
      case 429:
        // Extract retry-after header if available
        const retryAfter = 'headers' in error ? (error as any).headers?.['retry-after'] : null;
        const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000;

        // Check if it's quota exceeded vs rate limit
        if (errorMessage.toLowerCase().includes('quota')) {
          return {
            type: 'quota_exceeded',
            message: 'API quota exceeded. Please try again later or upgrade your plan.',
            retryable: false,
            originalError: error
          };
        }

        return {
          type: 'rate_limit',
          message: 'Rate limit reached. Retrying shortly...',
          retryable: true,
          retryAfterMs,
          originalError: error
        };
      case 400:
        return {
          type: 'invalid_request',
          message: `Invalid request: ${errorMessage}`,
          retryable: false,
          originalError: error
        };
      case 403:
        if (errorMessage.toLowerCase().includes('content')) {
          return {
            type: 'content_filter',
            message: 'Content was flagged by safety filters. Please try different content.',
            retryable: false,
            originalError: error
          };
        }
        return {
          type: 'auth',
          message: 'Access forbidden. Please check your API permissions.',
          retryable: false,
          originalError: error
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: 'server_error',
          message: 'OpenAI server error. Retrying...',
          retryable: true,
          originalError: error
        };
      default:
        return {
          type: 'unknown',
          message: errorMessage || 'An unexpected error occurred.',
          retryable: status >= 500,
          originalError: error
        };
    }
  }

  // Generic error
  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    retryable: false,
    originalError: error
  };
}

// ============================================================================
// Request Tracking & Logging
// ============================================================================

let requestCounter = 0;

interface RequestLog {
  id: number;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error' | 'retry';
  retryCount: number;
  error?: OpenAIError;
}

const requestLogs: RequestLog[] = [];
const MAX_LOG_ENTRIES = 50;

function logRequest(operation: string): RequestLog {
  const log: RequestLog = {
    id: ++requestCounter,
    operation,
    startTime: Date.now(),
    status: 'pending',
    retryCount: 0
  };

  requestLogs.push(log);

  // Keep log size bounded
  if (requestLogs.length > MAX_LOG_ENTRIES) {
    requestLogs.shift();
  }

  if (DEBUG_MODE) {
    console.log(`[OpenAI #${log.id}] Starting: ${operation}`);
  }

  return log;
}

function updateRequestLog(log: RequestLog, status: RequestLog['status'], error?: OpenAIError) {
  log.endTime = Date.now();
  log.duration = log.endTime - log.startTime;
  log.status = status;
  log.error = error;

  if (DEBUG_MODE) {
    const durationStr = `${log.duration}ms`;
    if (status === 'success') {
      console.log(`[OpenAI #${log.id}] Success: ${log.operation} (${durationStr})`);
    } else if (status === 'error') {
      console.error(`[OpenAI #${log.id}] Error: ${log.operation} - ${error?.message} (${durationStr})`);
    } else if (status === 'retry') {
      console.warn(`[OpenAI #${log.id}] Retry #${log.retryCount}: ${log.operation}`);
    }
  }
}

// Export for debugging
export function getRequestLogs(): RequestLog[] {
  return [...requestLogs];
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  onRetry?: (attempt: number, error: OpenAIError, delayMs: number) => void;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateRetryDelay(attempt: number, rateLimitRetryAfter?: number): number {
  // If rate limit provides a retry-after, use it (with some buffer)
  if (rateLimitRetryAfter) {
    return Math.min(rateLimitRetryAfter + 1000, MAX_RETRY_DELAY_MS);
  }

  // Exponential backoff with jitter
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
}

async function withRetry<T>(
  operation: string,
  fn: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = DEFAULT_MAX_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, onRetry } = options;
  const log = logRequest(operation);

  let lastError: OpenAIError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      updateRequestLog(log, 'success');
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = classifyError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable || attempt >= maxRetries) {
        updateRequestLog(log, 'error', lastError);
        throw lastError;
      }

      // Calculate delay and retry
      const delay = calculateRetryDelay(attempt, lastError.retryAfterMs);
      log.retryCount = attempt + 1;
      updateRequestLog(log, 'retry', lastError);

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }

      await sleep(delay);
    }
  }

  // Should not reach here, but just in case
  updateRequestLog(log, 'error', lastError!);
  throw lastError!;
}

// ============================================================================
// Interfaces
// ============================================================================

export interface MealAnalysisResult {
  markdown: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  } | null;
}

export interface GeneratedWorkout {
  title: string;
  duration_minutes: number;
  intensity: 'light' | 'moderate' | 'intense';
  recovery_adjusted: boolean;
  recovery_notes?: string;
  warmup: {
    duration_minutes: number;
    exercises: { name: string; duration: string }[];
  };
  exercises: {
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    notes?: string;
    target_muscles: string[];
  }[];
  cooldown: {
    duration_minutes: number;
    exercises: { name: string; duration: string }[];
  };
}

export interface WorkoutGenerationInput {
  profile: UserProfile;
  recovery: RecoveryState;
  recentWorkouts: { title: string; date: string; muscles: string[] }[];
}

export interface TextMealAnalysisResult {
  foods: { name: string; portion: string; calories: number; protein: number; carbs: number; fats: number }[];
  totals: { calories: number; protein: number; carbs: number; fats: number };
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const fileToDataUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const parseMacrosFromResponse = (text: string): MealAnalysisResult['macros'] => {
  try {
    const jsonMatch = text.match(/---MACROS_JSON---\s*(\{[\s\S]*?\})\s*---END_MACROS---/);
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (
        typeof parsed.calories === 'number' &&
        typeof parsed.protein === 'number' &&
        typeof parsed.carbs === 'number' &&
        typeof parsed.fats === 'number'
      ) {
        return {
          calories: Math.round(parsed.calories),
          protein: Math.round(parsed.protein),
          carbs: Math.round(parsed.carbs),
          fats: Math.round(parsed.fats)
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse macros JSON from response:', e);
  }
  return null;
};

const stripMacrosBlock = (text: string): string => {
  return text.replace(/---MACROS_JSON---[\s\S]*?---END_MACROS---/g, '').trim();
};

// ============================================================================
// Meal Analysis Validation
// ============================================================================

interface MealValidationResult {
  isValid: boolean;
  correctedResult?: TextMealAnalysisResult;
  issues: string[];
}

function validateAndCorrectMealAnalysis(result: unknown): MealValidationResult {
  const issues: string[] = [];

  // Type checking
  if (!result || typeof result !== 'object') {
    return { isValid: false, issues: ['Invalid response structure'] };
  }

  const data = result as Record<string, unknown>;

  // Check required fields exist
  if (!Array.isArray(data.foods)) {
    return { isValid: false, issues: ['Missing or invalid foods array'] };
  }

  if (!data.totals || typeof data.totals !== 'object') {
    return { isValid: false, issues: ['Missing or invalid totals object'] };
  }

  const totals = data.totals as Record<string, unknown>;

  // Validate each food item
  const validatedFoods: TextMealAnalysisResult['foods'] = [];
  let calculatedCalories = 0;
  let calculatedProtein = 0;
  let calculatedCarbs = 0;
  let calculatedFats = 0;

  for (const food of data.foods) {
    if (!food || typeof food !== 'object') continue;

    const f = food as Record<string, unknown>;
    const name = typeof f.name === 'string' ? f.name : 'Unknown food';
    const portion = typeof f.portion === 'string' ? f.portion : 'standard portion';
    let calories = typeof f.calories === 'number' ? Math.round(f.calories) : 0;
    let protein = typeof f.protein === 'number' ? Math.round(f.protein) : 0;
    let carbs = typeof f.carbs === 'number' ? Math.round(f.carbs) : 0;
    let fats = typeof f.fats === 'number' ? Math.round(f.fats) : 0;

    // Sanity check: negative values are invalid
    protein = Math.max(0, protein);
    carbs = Math.max(0, carbs);
    fats = Math.max(0, fats);
    calories = Math.max(0, calories);

    // Verify calorie calculation: calories ≈ protein*4 + carbs*4 + fats*9
    const expectedCalories = (protein * 4) + (carbs * 4) + (fats * 9);
    const calorieDiff = Math.abs(calories - expectedCalories);
    const tolerance = Math.max(15, expectedCalories * 0.10); // 10% tolerance or 15 cal minimum (stricter)

    let correctedCalories = calories;
    if (calorieDiff > tolerance && expectedCalories > 0) {
      issues.push(`${name}: calories adjusted from ${calories} to ${expectedCalories} based on macros`);
      correctedCalories = expectedCalories;
    }

    // If calories provided but no macros, this is suspicious
    if (correctedCalories > 50 && protein === 0 && carbs === 0 && fats === 0) {
      issues.push(`${name}: has ${correctedCalories} cal but 0 macros - data may be incomplete`);
    }

    // Sanity checks for individual foods
    if (correctedCalories > 1500) {
      issues.push(`${name}: unusually high calories (${correctedCalories}) - verify portion`);
    }
    if (protein > 80) {
      issues.push(`${name}: unusually high protein (${protein}g) - verify portion`);
    }
    if (carbs > 150) {
      issues.push(`${name}: unusually high carbs (${carbs}g) - verify portion`);
    }
    if (fats > 80) {
      issues.push(`${name}: unusually high fats (${fats}g) - verify portion`);
    }

    validatedFoods.push({
      name,
      portion,
      calories: correctedCalories,
      protein,
      carbs,
      fats
    });

    calculatedCalories += correctedCalories;
    calculatedProtein += protein;
    calculatedCarbs += carbs;
    calculatedFats += fats;
  }

  // Validate totals match sum of foods
  const reportedCalories = typeof totals.calories === 'number' ? Math.round(totals.calories) : 0;
  const reportedProtein = typeof totals.protein === 'number' ? Math.round(totals.protein) : 0;
  const reportedCarbs = typeof totals.carbs === 'number' ? Math.round(totals.carbs) : 0;
  const reportedFats = typeof totals.fats === 'number' ? Math.round(totals.fats) : 0;

  // Use calculated values if they differ significantly
  const caloriesDiff = Math.abs(reportedCalories - calculatedCalories);
  if (caloriesDiff > 50) {
    issues.push(`Total calories corrected from ${reportedCalories} to ${calculatedCalories}`);
  }

  // Final totals sanity check: verify calories match macros
  const expectedTotalCalories = (calculatedProtein * 4) + (calculatedCarbs * 4) + (calculatedFats * 9);
  if (Math.abs(calculatedCalories - expectedTotalCalories) > 20) {
    // Recalculate from macros to ensure consistency
    calculatedCalories = expectedTotalCalories;
    issues.push(`Total calories recalculated to ${calculatedCalories} to match macros`);
  }

  // Final sanity checks
  if (calculatedCalories < 20 && validatedFoods.length > 0) {
    issues.push('Warning: Total calories suspiciously low');
  }
  if (calculatedCalories > 3500) {
    issues.push('Warning: Total calories unusually high for a single meal - verify this is one meal');
  }

  // Protein sanity check for typical meals
  if (calculatedProtein < 5 && calculatedCalories > 200 && validatedFoods.length > 0) {
    issues.push('Warning: Very low protein for this calorie count');
  }

  // Build corrected result
  let confidence: 'high' | 'medium' | 'low' =
    (data.confidence === 'high' || data.confidence === 'medium' || data.confidence === 'low')
      ? data.confidence
      : 'medium';

  // Downgrade confidence if we had to make corrections
  if (issues.length > 2 && confidence === 'high') {
    confidence = 'medium';
  } else if (issues.length > 4) {
    confidence = 'low';
  }

  let notes = typeof data.notes === 'string' ? data.notes : '';
  if (issues.length > 0) {
    notes = notes ? `${notes} [Auto-corrected: ${issues.length} adjustment(s)]` : `[Auto-corrected: ${issues.length} adjustment(s)]`;
  }

  const correctedResult: TextMealAnalysisResult = {
    foods: validatedFoods,
    totals: {
      calories: calculatedCalories,
      protein: calculatedProtein,
      carbs: calculatedCarbs,
      fats: calculatedFats
    },
    confidence,
    notes
  };

  if (DEBUG_MODE && issues.length > 0) {
    console.log('[Meal Validation] Issues found:', issues);
  }

  return {
    isValid: true,
    correctedResult,
    issues
  };
}

function formatErrorForUser(error: OpenAIError): string {
  switch (error.type) {
    case 'network':
      return 'Unable to connect. Please check your internet connection and try again.';
    case 'timeout':
      return 'The request took too long. Please try again.';
    case 'rate_limit':
      return 'Service is busy. Please wait a moment and try again.';
    case 'auth':
      return 'Authentication error. Please contact support.';
    case 'quota_exceeded':
      return 'Service limit reached. Please try again later.';
    case 'content_filter':
      return 'Content could not be processed. Please try different content.';
    case 'server_error':
      return 'Service temporarily unavailable. Please try again.';
    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}

// ============================================================================
// API Functions
// ============================================================================

export const analyzeBodyPhoto = async (image: File): Promise<string> => {
  try {
    const imageUrl = await fileToDataUrl(image);

    return await withRetry('analyzeBodyPhoto', async () => {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: BODY_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze the attached body photo.' },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1500
      });

      return response.choices[0]?.message?.content || "Error: No response from model.";
    }, { timeoutMs: 45000 }); // Longer timeout for image analysis
  } catch (error) {
    const classifiedError = error as OpenAIError;
    console.error("Error analyzing body photo:", classifiedError);
    return `Error: ${formatErrorForUser(classifiedError)}`;
  }
};

export const analyzeMealPhoto = async (image: File, userGoal: string | null): Promise<MealAnalysisResult> => {
  try {
    const imageUrl = await fileToDataUrl(image);

    let goalText = "The user has not set a specific goal yet. Provide general nutrition advice.";
    if (userGoal) {
      goalText = `The user's current goal is: ${userGoal}. Tailor your feedback to this goal.`;
    }

    const fullText = await withRetry('analyzeMealPhoto', async () => {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: MEAL_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analyze the attached meal photo. ${goalText}` },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1500
      });

      return response.choices[0]?.message?.content || "";
    }, { timeoutMs: 45000 });

    if (fullText) {
      const macros = parseMacrosFromResponse(fullText);
      const markdown = stripMacrosBlock(fullText);
      return { markdown, macros };
    }

    return { markdown: "Error: No response from model.", macros: null };
  } catch (error) {
    const classifiedError = error as OpenAIError;
    console.error("Error analyzing meal photo:", classifiedError);
    return {
      markdown: `Error: ${formatErrorForUser(classifiedError)}`,
      macros: null
    };
  }
};

export const analyzeProgress = async (images: File[], metrics: string): Promise<string> => {
  try {
    // C2 FIX: Sanitize metrics input to prevent prompt injection
    const sanitizedMetrics = sanitizeForAI(metrics, 2000);

    const imageUrls = await Promise.all(images.map(fileToDataUrl));

    const imageContent = imageUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url }
    }));

    return await withRetry('analyzeProgress', async () => {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: PROGRESS_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analyze the attached progress photos and metrics:\n${sanitizedMetrics}` },
              ...imageContent
            ]
          }
        ],
        max_tokens: 2000
      });

      return response.choices[0]?.message?.content || "Error: No response from model.";
    }, { timeoutMs: 60000 }); // Longer timeout for multiple images
  } catch (error) {
    const classifiedError = error as OpenAIError;
    console.error("Error analyzing progress:", classifiedError);
    return `Error: ${formatErrorForUser(classifiedError)}`;
  }
};

export const generateWorkout = async (input: WorkoutGenerationInput): Promise<GeneratedWorkout | null> => {
  try {
    const prompt = `
Generate a workout for this user:

USER PROFILE:
- Goal: ${input.profile.goal || 'RECOMP'}
- Training Experience: ${input.profile.training_experience || 'beginner'}
- Equipment Access: ${input.profile.equipment_access || 'gym'}
- Days Per Week: ${input.profile.days_per_week || 4}

RECOVERY STATE:
- Energy Level: ${input.recovery.energyLevel}/5
- Sleep Last Night: ${input.recovery.sleepHours} hours
- Sore Areas: ${input.recovery.sorenessAreas.length > 0 ? input.recovery.sorenessAreas.join(', ') : 'None'}
- Last Workout Rating: ${input.recovery.lastWorkoutRating}/5

RECENT WORKOUTS (last 3):
${input.recentWorkouts.length > 0
  ? input.recentWorkouts.map(w => `- ${w.title} (${w.date}): ${w.muscles.join(', ')}`).join('\n')
  : 'No recent workouts recorded'}

Generate an appropriate workout based on the above data.
`;

    const content = await withRetry('generateWorkout', async () => {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: WORKOUT_GENERATION_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      return response.choices[0]?.message?.content;
    });

    if (content) {
      try {
        return JSON.parse(content) as GeneratedWorkout;
      } catch (parseError) {
        console.error("Error parsing workout JSON:", parseError, content);
        return null;
      }
    }
    return null;
  } catch (error) {
    const classifiedError = error as OpenAIError;
    console.error("Error generating workout:", classifiedError);
    return null;
  }
};

export const analyzeTextMeal = async (description: string, userGoal: string | null): Promise<TextMealAnalysisResult | null> => {
  try {
    // C2 FIX: Sanitize user input to prevent prompt injection
    const sanitizedDescription = sanitizeForAI(description, 1000);

    // Build context-aware prompt
    const goalContext = userGoal
      ? `User's goal: ${userGoal}. Adjust portion estimates accordingly (conservative for CUT, generous for BULK).`
      : 'No specific goal set. Use standard portion estimates.';

    // Clean and normalize the description
    const cleanedDescription = sanitizedDescription.trim().toLowerCase();

    // Detect if this is a simple or complex meal for better prompting
    const isSimpleMeal = cleanedDescription.split(/[,&+]|and|with/).length <= 3;

    const prompt = `Analyze this meal: "${sanitizedDescription}"

${goalContext}

${isSimpleMeal ? 'This appears to be a simple meal - provide precise estimates.' : 'This is a complex meal - break down each component carefully.'}

Remember to:
1. Include ALL ingredients including oils, sauces, and condiments
2. Use the food database values provided
3. Verify calories match (protein×4 + carbs×4 + fats×9)
4. Explain your reasoning in notes`;

    const content = await withRetry('analyzeTextMeal', async () => {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: TEXT_MEAL_ANALYSIS_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500, // Increased for detailed breakdowns
        response_format: { type: 'json_object' },
        temperature: 0.3 // Lower temperature for more consistent/accurate results
      });

      return response.choices[0]?.message?.content;
    });

    if (content) {
      try {
        const parsed = JSON.parse(content);

        // Validate and correct the result
        const validation = validateAndCorrectMealAnalysis(parsed);

        if (!validation.isValid) {
          console.error("Meal validation failed:", validation.issues);
          return null;
        }

        if (DEBUG_MODE && validation.issues.length > 0) {
          console.log("Meal analysis corrected:", validation.issues);
        }

        return validation.correctedResult!;
      } catch (parseError) {
        console.error("Error parsing meal JSON:", parseError, content);
        return null;
      }
    }
    return null;
  } catch (error) {
    const classifiedError = error as OpenAIError;
    console.error("Error analyzing text meal:", classifiedError);
    return null;
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
  try {
    const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type });

    return await withRetry('transcribeAudio', async () => {
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });

      return transcription.text;
    }, { timeoutMs: 20000 }); // 20 second timeout for audio
  } catch (error) {
    const classifiedError = error as OpenAIError;
    console.error("Error transcribing audio:", classifiedError);
    return null;
  }
};

// ============================================================================
// Weekly Nutrition Analysis
// ============================================================================

export interface WeeklyNutritionInsights {
  adherence_score: number;
  summary: string;
  wins: string[];
  focus_area: string;
  tip: string;
}

export interface WeeklyNutritionInput {
  logs: { date: string; calories: number; protein: number; carbs: number; fats: number }[];
  targets: { calories: number; protein: number; carbs: number; fats: number };
  goal: string | null;
}

export const analyzeWeeklyNutrition = async (input: WeeklyNutritionInput): Promise<WeeklyNutritionInsights | null> => {
  try {
    const prompt = `
Analyze this user's 7-day nutrition data:

USER GOAL: ${input.goal || 'RECOMP'}

DAILY TARGETS:
- Calories: ${input.targets.calories}
- Protein: ${input.targets.protein}g
- Carbs: ${input.targets.carbs}g
- Fats: ${input.targets.fats}g

DAILY LOGS (last 7 days):
${input.logs.map(log => `- ${log.date}: ${log.calories} cal, ${log.protein}g P, ${log.carbs}g C, ${log.fats}g F`).join('\n')}

Provide personalized insights based on this data.
`;

    const content = await withRetry('analyzeWeeklyNutrition', async () => {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: WEEKLY_NUTRITION_PROMPT },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        response_format: { type: 'json_object' },
        temperature: 0.5
      });

      return response.choices[0]?.message?.content;
    });

    if (content) {
      try {
        const parsed = JSON.parse(content) as WeeklyNutritionInsights;
        // Validate required fields
        if (
          typeof parsed.adherence_score === 'number' &&
          typeof parsed.summary === 'string' &&
          Array.isArray(parsed.wins) &&
          typeof parsed.focus_area === 'string' &&
          typeof parsed.tip === 'string'
        ) {
          return parsed;
        }
        console.error("Invalid weekly nutrition response structure:", parsed);
        return null;
      } catch (parseError) {
        console.error("Error parsing weekly nutrition JSON:", parseError, content);
        return null;
      }
    }
    return null;
  } catch (error) {
    const classifiedError = error as OpenAIError;
    console.error("Error analyzing weekly nutrition:", classifiedError);
    return null;
  }
};

// ============================================================================
// Utility Exports
// ============================================================================

export { formatErrorForUser, classifyError };
