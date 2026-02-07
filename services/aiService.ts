/**
 * AI Service - Frontend API Client
 *
 * This service calls the backend API routes which handle the actual AI provider
 * communication. The API routes are provider-agnostic - you can switch between
 * OpenAI, Anthropic, Google, etc. by changing environment variables on the server.
 *
 * No API keys are exposed to the browser.
 */

import { RecoveryState } from '../components/RecoveryCheckIn';
import { UserProfile } from '../hooks/useUserData';

// ============================================================================
// Types (matching the API response types)
// ============================================================================

export interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    retryable: boolean;
  };
  provider?: string;
  durationMs?: number;
}

export interface TextMealAnalysisResult {
  foods: { name: string; portion: string; calories: number; protein: number; carbs: number; fats: number }[];
  totals: { calories: number; protein: number; carbs: number; fats: number };
  confidence: 'high' | 'medium' | 'low';
  notes: string;
  markdown: string;
}

export interface MealAnalysisResult {
  markdown: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  } | null;
  foods?: string[]; // Array of identified food names (parsed from JSON, not markdown)
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

export interface TranscribeResult {
  text: string | null;
  unsupported?: boolean;
}

// ============================================================================
// Weekly Plan Types
// ============================================================================

export interface WeeklyPlan {
  id: string;
  week_start: string;
  days: DayPlan[];
  reasoning: string;
  progressive_overload_notes: string;
  created_at: string;
}

export interface DayPlan {
  day: number;
  day_name: string;
  workout: GeneratedWorkout | null;
  is_rest_day: boolean;
  rest_reason?: string;
  focus_areas: string[];
}

export interface WorkoutHistoryItem {
  date: string;
  title: string;
  muscles: string[];
  volume: number;
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

export interface WeeklyPlanGenerationInput {
  profile: UserProfile;
  recentWorkouts: WorkoutHistoryItem[];
  recoveryPatterns: RecoveryPattern[];
  preferredSchedule?: number[];
}

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = '/api/ai';
const DEBUG_MODE = import.meta.env.DEV;

// Request logging (for debugging)
interface RequestLog {
  id: number;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  provider?: string;
}

let requestCounter = 0;
const requestLogs: RequestLog[] = [];
const MAX_LOG_ENTRIES = 50;

function logRequest(operation: string): RequestLog {
  const log: RequestLog = {
    id: ++requestCounter,
    operation,
    startTime: Date.now(),
    status: 'pending',
  };
  requestLogs.push(log);
  if (requestLogs.length > MAX_LOG_ENTRIES) {
    requestLogs.shift();
  }
  if (DEBUG_MODE) {
    console.log(`[AI #${log.id}] Starting: ${operation}`);
  }
  return log;
}

function updateRequestLog(log: RequestLog, status: 'success' | 'error', provider?: string) {
  log.endTime = Date.now();
  log.duration = log.endTime - log.startTime;
  log.status = status;
  log.provider = provider;
  if (DEBUG_MODE) {
    const durationStr = `${log.duration}ms`;
    const providerStr = provider ? ` [${provider}]` : '';
    if (status === 'success') {
      console.log(`[AI #${log.id}] Success: ${log.operation} (${durationStr})${providerStr}`);
    } else {
      console.error(`[AI #${log.id}] Error: ${log.operation} (${durationStr})${providerStr}`);
    }
  }
}

export function getRequestLogs(): RequestLog[] {
  return [...requestLogs];
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

/**
 * Compress an image file for API analysis.
 * Resizes to max 1024px on longest side and exports as JPEG at 0.7 quality.
 * Reduces typical phone photos from 3-12MB to ~100-300KB base64.
 */
const compressImageForAnalysis = async (file: File): Promise<string> => {
  const dataUrl = await fileToDataUrl(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 1024;
      let { width, height } = img;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round(height * (MAX_DIM / width));
          width = MAX_DIM;
        } else {
          width = Math.round(width * (MAX_DIM / height));
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl); // fallback to original if canvas fails
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.7);

      if (DEBUG_MODE) {
        const originalKB = Math.round(dataUrl.length * 0.75 / 1024);
        const compressedKB = Math.round(compressed.length * 0.75 / 1024);
        console.log(`[AI] Image compressed: ${originalKB}KB → ${compressedKB}KB (${width}x${height})`);
      }

      resolve(compressed);
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
};

const blobToBase64 = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract just the base64 part
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

async function callAPI<T>(endpoint: string, body: unknown, operation: string): Promise<AIResponse<T>> {
  const log = logRequest(operation);

  // Adaptive timeout: 60s for image payloads (large upload), 30s for text-only
  const hasImage = body && typeof body === 'object' && ('imageBase64' in (body as Record<string, unknown>) || 'images' in (body as Record<string, unknown>));
  const timeoutMs = hasImage ? 60000 : 30000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      updateRequestLog(log, 'error');
      const type = response.status === 413 ? 'payload_too_large'
        : response.status >= 500 ? 'server_error'
        : 'api';
      return {
        success: false,
        error: {
          type,
          message: `Server error (${response.status})`,
          retryable: response.status >= 500,
        },
      };
    }

    const result: AIResponse<T> = await response.json();
    updateRequestLog(log, result.success ? 'success' : 'error', result.provider);
    return result;
  } catch (error: any) {
    updateRequestLog(log, 'error');
    if (error?.name === 'AbortError') {
      return {
        success: false,
        error: {
          type: 'timeout',
          message: 'Request timed out. Please try again.',
          retryable: true,
        },
      };
    }
    return {
      success: false,
      error: {
        type: 'network',
        message: error instanceof Error ? error.message : 'Network error',
        retryable: true,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatErrorForUser(error: AIResponse<unknown>['error']): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  switch (error.type) {
    case 'payload_too_large':
      return 'Image is too large. Please try a smaller photo or use text input.';
    case 'network':
      return 'Unable to reach the server. Please check your connection and try again.';
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

/**
 * Analyze a body photo for composition assessment
 */
export const analyzeBodyPhoto = async (image: File): Promise<string> => {
  const imageBase64 = await compressImageForAnalysis(image);
  const result = await callAPI<string>('/analyze-body', { imageBase64 }, 'analyzeBodyPhoto');

  if (result.success && result.data) {
    return result.data;
  }
  return `Error: ${formatErrorForUser(result.error)}`;
};

/**
 * Analyze a meal photo for nutrition information
 */
export const analyzeMealPhoto = async (image: File, userGoal: string | null): Promise<MealAnalysisResult> => {
  const imageBase64 = await compressImageForAnalysis(image);
  const result = await callAPI<MealAnalysisResult>('/analyze-meal-photo', { imageBase64, userGoal }, 'analyzeMealPhoto');

  if (result.success && result.data) {
    return result.data;
  }
  return {
    markdown: `Error: ${formatErrorForUser(result.error)}`,
    macros: null,
  };
};

/**
 * Analyze progress photos and metrics
 */
export const analyzeProgress = async (images: File[], metrics: string): Promise<string> => {
  const imageUrls = await Promise.all(images.map(compressImageForAnalysis));
  const result = await callAPI<string>('/analyze-progress', { images: imageUrls, metrics }, 'analyzeProgress');

  if (result.success && result.data) {
    return result.data;
  }
  return `Error: ${formatErrorForUser(result.error)}`;
};

/**
 * Generate a personalized workout based on profile and recovery state
 */
export const generateWorkout = async (input: WorkoutGenerationInput): Promise<GeneratedWorkout | null> => {
  const result = await callAPI<GeneratedWorkout>('/generate-workout', input, 'generateWorkout');

  if (result.success && result.data) {
    return result.data;
  }
  console.error('Error generating workout:', result.error);
  return null;
};

/**
 * Analyze a text description of a meal
 */
export const analyzeTextMeal = async (description: string, userGoal: string | null): Promise<TextMealAnalysisResult | null> => {
  const result = await callAPI<TextMealAnalysisResult>('/analyze-meal', { description, userGoal }, 'analyzeTextMeal');

  if (result.success && result.data) {
    return result.data;
  }
  console.error('Error analyzing text meal:', result.error);
  return null;
};

/**
 * Transcribe audio to text
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<TranscribeResult> => {
  const audioBase64 = await blobToBase64(audioBlob);
  const result = await callAPI<string>('/transcribe', {
    audioBase64,
    mimeType: audioBlob.type,
  }, 'transcribeAudio');

  if (result.success && result.data) {
    return { text: result.data };
  }
  console.error('Error transcribing audio:', result.error);
  if (result.error?.type === 'invalid_request' && result.error?.retryable === false) {
    return { text: null, unsupported: true };
  }
  return { text: null };
};

/**
 * Analyze weekly nutrition data for insights
 */
export const analyzeWeeklyNutrition = async (input: WeeklyNutritionInput): Promise<WeeklyNutritionInsights | null> => {
  const result = await callAPI<WeeklyNutritionInsights>('/analyze-weekly', input, 'analyzeWeeklyNutrition');

  if (result.success && result.data) {
    return result.data;
  }
  console.error('Error analyzing weekly nutrition:', result.error);
  return null;
};

/**
 * Generate a weekly training plan using multi-step AI reasoning
 */
export const generateWeeklyPlan = async (input: WeeklyPlanGenerationInput): Promise<WeeklyPlan | null> => {
  const result = await callAPI<WeeklyPlan>('/generate-weekly-plan', input, 'generateWeeklyPlan');

  if (result.success && result.data) {
    return result.data;
  }
  console.error('Error generating weekly plan:', result.error);
  return null;
};

// ============================================================================
// Utility Exports
// ============================================================================

export { formatErrorForUser };

// Re-export types for convenience
export type {
  RecoveryState,
  UserProfile,
};
