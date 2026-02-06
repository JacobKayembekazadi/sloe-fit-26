import OpenAI from 'openai';
import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  TextMealAnalysis,
  PhotoMealAnalysis,
  GeneratedWorkout,
  WorkoutGenerationInput,
  WeeklyNutritionInput,
  WeeklyNutritionInsights,
  AIError,
} from '../types';
import {
  BODY_ANALYSIS_PROMPT,
  MEAL_ANALYSIS_PROMPT,
  PROGRESS_ANALYSIS_PROMPT,
  WORKOUT_GENERATION_PROMPT,
  TEXT_MEAL_ANALYSIS_PROMPT,
  WEEKLY_NUTRITION_PROMPT,
} from '../../../prompts';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// ============================================================================
// Error Handling
// ============================================================================

function classifyOpenAIError(error: unknown): AIError {
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'Request timed out. Please try again.',
      retryable: true,
      provider: 'openai',
    };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network error. Please check your connection.',
      retryable: true,
      provider: 'openai',
    };
  }

  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as { status: number; message?: string; error?: { message?: string } };
    const status = apiError.status;
    const errorMessage = apiError.error?.message || apiError.message || 'Unknown error';

    switch (status) {
      case 401:
        return { type: 'auth', message: 'Authentication failed.', retryable: false, provider: 'openai' };
      case 429:
        if (errorMessage.toLowerCase().includes('quota')) {
          return { type: 'quota_exceeded', message: 'API quota exceeded.', retryable: false, provider: 'openai' };
        }
        return { type: 'rate_limit', message: 'Rate limit reached.', retryable: true, retryAfterMs: 60000, provider: 'openai' };
      case 400:
        return { type: 'invalid_request', message: `Invalid request: ${errorMessage}`, retryable: false, provider: 'openai' };
      case 403:
        if (errorMessage.toLowerCase().includes('content')) {
          return { type: 'content_filter', message: 'Content filtered.', retryable: false, provider: 'openai' };
        }
        return { type: 'auth', message: 'Access forbidden.', retryable: false, provider: 'openai' };
      case 500:
      case 502:
      case 503:
      case 504:
        return { type: 'server_error', message: 'Server error. Retrying...', retryable: true, provider: 'openai' };
      default:
        return { type: 'unknown', message: errorMessage, retryable: status >= 500, provider: 'openai' };
    }
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    retryable: false,
    provider: 'openai',
  };
}

// ============================================================================
// Retry Logic
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateRetryDelay(attempt: number, rateLimitRetryAfter?: number): number {
  if (rateLimitRetryAfter) {
    return Math.min(rateLimitRetryAfter + 1000, MAX_RETRY_DELAY_MS);
  }
  const exponentialDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
}

async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: { maxRetries?: number; timeoutMs?: number } = {}
): Promise<T> {
  const { maxRetries = DEFAULT_MAX_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  let lastError: AIError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = classifyOpenAIError(error);

      if (!lastError.retryable || attempt >= maxRetries) {
        throw lastError;
      }

      const delay = calculateRetryDelay(attempt, lastError.retryAfterMs);
      await sleep(delay);
    }
  }

  throw lastError!;
}

// ============================================================================
// Validation Helpers
// ============================================================================

function validateAndCorrectMealAnalysis(result: unknown): TextMealAnalysis | null {
  if (!result || typeof result !== 'object') return null;

  const data = result as Record<string, unknown>;
  if (!Array.isArray(data.foods) || !data.totals || typeof data.totals !== 'object') return null;

  const totals = data.totals as Record<string, unknown>;
  const foods: TextMealAnalysis['foods'] = [];
  let calculatedCalories = 0;
  let calculatedProtein = 0;
  let calculatedCarbs = 0;
  let calculatedFats = 0;

  for (const food of data.foods) {
    if (!food || typeof food !== 'object') continue;

    const f = food as Record<string, unknown>;
    const name = typeof f.name === 'string' ? f.name : 'Unknown food';
    const portion = typeof f.portion === 'string' ? f.portion : 'standard portion';
    let protein = Math.max(0, typeof f.protein === 'number' ? Math.round(f.protein) : 0);
    let carbs = Math.max(0, typeof f.carbs === 'number' ? Math.round(f.carbs) : 0);
    let fats = Math.max(0, typeof f.fats === 'number' ? Math.round(f.fats) : 0);
    let calories = Math.max(0, typeof f.calories === 'number' ? Math.round(f.calories) : 0);

    // Verify calorie calculation
    const expectedCalories = (protein * 4) + (carbs * 4) + (fats * 9);
    const tolerance = Math.max(15, expectedCalories * 0.10);

    if (Math.abs(calories - expectedCalories) > tolerance && expectedCalories > 0) {
      calories = expectedCalories;
    }

    foods.push({ name, portion, calories, protein, carbs, fats });
    calculatedCalories += calories;
    calculatedProtein += protein;
    calculatedCarbs += carbs;
    calculatedFats += fats;
  }

  // Recalculate totals
  const expectedTotalCalories = (calculatedProtein * 4) + (calculatedCarbs * 4) + (calculatedFats * 9);
  if (Math.abs(calculatedCalories - expectedTotalCalories) > 20) {
    calculatedCalories = expectedTotalCalories;
  }

  let confidence: 'high' | 'medium' | 'low' =
    (data.confidence === 'high' || data.confidence === 'medium' || data.confidence === 'low')
      ? data.confidence
      : 'medium';

  const notes = typeof data.notes === 'string' ? data.notes : '';

  return {
    foods,
    totals: {
      calories: calculatedCalories,
      protein: calculatedProtein,
      carbs: calculatedCarbs,
      fats: calculatedFats,
    },
    confidence,
    notes,
  };
}

interface ParsedMacrosResult {
  macros: PhotoMealAnalysis['macros'];
  foods: string[];
}

function parseMacrosFromResponse(text: string): ParsedMacrosResult {
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
        // Extract foods array if present, clean up any markdown artifacts
        let foods: string[] = [];
        if (Array.isArray(parsed.foods)) {
          foods = parsed.foods
            .filter((f: unknown) => typeof f === 'string')
            .map((f: string) => f.replace(/\*+/g, '').trim()) // Remove any ** markdown
            .filter((f: string) => f.length > 0);
        }

        return {
          macros: {
            calories: Math.round(parsed.calories),
            protein: Math.round(parsed.protein),
            carbs: Math.round(parsed.carbs),
            fats: Math.round(parsed.fats),
          },
          foods,
        };
      }
    }
  } catch {
    // Failed to parse
  }
  return { macros: null, foods: [] };
}

function stripMacrosBlock(text: string): string {
  return text.replace(/---MACROS_JSON---[\s\S]*?---END_MACROS---/g, '').trim();
}

// ============================================================================
// OpenAI Provider Implementation
// ============================================================================

export function createOpenAIProvider(apiKey: string): AIProvider {
  const client = new OpenAI({ apiKey });

  return {
    name: 'openai',

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      const { temperature = 0.7, maxTokens = 1000, jsonMode = false, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

      return withRetry(async () => {
        const formattedMessages = messages.map(msg => {
          if (typeof msg.content === 'string') {
            return { role: msg.role, content: msg.content };
          }

          // Handle multi-part content (text + images)
          const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
          for (const part of msg.content) {
            if (part.type === 'text' && part.text) {
              parts.push({ type: 'text', text: part.text });
            } else if (part.type === 'image' && part.imageUrl) {
              parts.push({ type: 'image_url', image_url: { url: part.imageUrl } });
            }
          }
          return { role: msg.role, content: parts };
        });

        const response = await client.chat.completions.create({
          model: DEFAULT_MODEL,
          messages: formattedMessages as any,
          temperature,
          max_tokens: maxTokens,
          ...(jsonMode && { response_format: { type: 'json_object' } }),
        });

        return response.choices[0]?.message?.content || '';
      }, { timeoutMs });
    },

    async analyzeTextMeal(description: string, userGoal: string | null): Promise<TextMealAnalysis | null> {
      const goalContext = userGoal
        ? `User's goal: ${userGoal}. Adjust portion estimates accordingly.`
        : 'No specific goal set. Use standard portion estimates.';

      const prompt = `Analyze this meal: "${description}"\n\n${goalContext}`;

      try {
        const content = await this.chat(
          [
            { role: 'system', content: TEXT_MEAL_ANALYSIS_PROMPT },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.3, maxTokens: 1500, jsonMode: true }
        );

        if (content) {
          const parsed = JSON.parse(content);
          return validateAndCorrectMealAnalysis(parsed);
        }
        return null;
      } catch {
        return null;
      }
    },

    async analyzeMealPhoto(imageBase64: string, userGoal: string | null): Promise<PhotoMealAnalysis> {
      const goalText = userGoal
        ? `The user's current goal is: ${userGoal}. Tailor your feedback to this goal.`
        : 'The user has not set a specific goal yet. Provide general nutrition advice.';

      try {
        const content = await this.chat(
          [
            { role: 'system', content: MEAL_ANALYSIS_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Analyze the attached meal photo. ${goalText}` },
                { type: 'image', imageUrl: imageBase64 },
              ],
            },
          ],
          { maxTokens: 1500, timeoutMs: 45000 }
        );

        if (content) {
          const { macros, foods } = parseMacrosFromResponse(content);
          const markdown = stripMacrosBlock(content);
          return { markdown, macros, foods: foods.length > 0 ? foods : undefined };
        }

        return { markdown: 'Error: No response from model.', macros: null };
      } catch (error) {
        const aiError = error as AIError;
        return { markdown: `Error: ${aiError.message}`, macros: null };
      }
    },

    async analyzeBodyPhoto(imageBase64: string): Promise<string> {
      try {
        return await this.chat(
          [
            { role: 'system', content: BODY_ANALYSIS_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze the attached body photo.' },
                { type: 'image', imageUrl: imageBase64 },
              ],
            },
          ],
          { maxTokens: 1500, timeoutMs: 45000 }
        );
      } catch (error) {
        const aiError = error as AIError;
        return `Error: ${aiError.message}`;
      }
    },

    async analyzeProgress(images: string[], metrics: string): Promise<string> {
      try {
        const imageParts = images.map(img => ({ type: 'image' as const, imageUrl: img }));

        return await this.chat(
          [
            { role: 'system', content: PROGRESS_ANALYSIS_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Analyze the attached progress photos and metrics:\n${metrics}` },
                ...imageParts,
              ],
            },
          ],
          { maxTokens: 2000, timeoutMs: 60000 }
        );
      } catch (error) {
        const aiError = error as AIError;
        return `Error: ${aiError.message}`;
      }
    },

    async generateWorkout(input: WorkoutGenerationInput): Promise<GeneratedWorkout | null> {
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

      try {
        const content = await this.chat(
          [
            { role: 'system', content: WORKOUT_GENERATION_PROMPT },
            { role: 'user', content: prompt },
          ],
          { maxTokens: 2000, jsonMode: true }
        );

        if (content) {
          return JSON.parse(content) as GeneratedWorkout;
        }
        return null;
      } catch {
        return null;
      }
    },

    async analyzeWeeklyNutrition(input: WeeklyNutritionInput): Promise<WeeklyNutritionInsights | null> {
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

      try {
        const content = await this.chat(
          [
            { role: 'system', content: WEEKLY_NUTRITION_PROMPT },
            { role: 'user', content: prompt },
          ],
          { maxTokens: 800, jsonMode: true, temperature: 0.5 }
        );

        if (content) {
          const parsed = JSON.parse(content) as WeeklyNutritionInsights;
          if (
            typeof parsed.adherence_score === 'number' &&
            typeof parsed.summary === 'string' &&
            Array.isArray(parsed.wins) &&
            typeof parsed.focus_area === 'string' &&
            typeof parsed.tip === 'string'
          ) {
            return parsed;
          }
        }
        return null;
      } catch {
        return null;
      }
    },

    async transcribeAudio(audioBlob: Blob): Promise<string | null> {
      try {
        const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type });

        return await withRetry(async () => {
          const transcription = await client.audio.transcriptions.create({
            file,
            model: 'whisper-1',
          });
          return transcription.text;
        }, { timeoutMs: 20000 });
      } catch {
        return null;
      }
    },
  };
}
