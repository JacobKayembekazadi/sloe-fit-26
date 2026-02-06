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

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// ============================================================================
// Error Handling
// ============================================================================

function classifyGoogleError(error: unknown, status?: number): AIError {
  if (error instanceof Error && error.name === 'AbortError') {
    return { type: 'timeout', message: 'Request timed out.', retryable: true, provider: 'google' };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return { type: 'network', message: 'Network error.', retryable: true, provider: 'google' };
  }

  if (status) {
    switch (status) {
      case 401:
      case 403:
        return { type: 'auth', message: 'Authentication failed.', retryable: false, provider: 'google' };
      case 429:
        return { type: 'rate_limit', message: 'Rate limit reached.', retryable: true, retryAfterMs: 60000, provider: 'google' };
      case 400:
        return { type: 'invalid_request', message: 'Invalid request.', retryable: false, provider: 'google' };
      case 500:
      case 502:
      case 503:
        return { type: 'server_error', message: 'Server error.', retryable: true, provider: 'google' };
      default:
        return { type: 'unknown', message: 'Unknown error.', retryable: status >= 500, provider: 'google' };
    }
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    retryable: false,
    provider: 'google',
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
      lastError = classifyGoogleError(error);

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
    markdown: '',
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
// Message Formatting for Google Gemini API
// ============================================================================

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

function formatMessagesForGemini(messages: ChatMessage[]): { systemInstruction?: string; contents: GeminiContent[] } {
  let systemInstruction = '';
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction += (typeof msg.content === 'string' ? msg.content : '') + '\n';
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (typeof msg.content === 'string') {
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    } else {
      // Multi-part content
      const parts: GeminiPart[] = [];
      for (const part of msg.content) {
        if (part.type === 'text' && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === 'image' && part.imageUrl) {
          // Extract base64 data from data URL
          const match = part.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        }
      }
      contents.push({ role, parts });
    }
  }

  return {
    systemInstruction: systemInstruction.trim() || undefined,
    contents,
  };
}

// ============================================================================
// Google Gemini Provider Implementation
// ============================================================================

export function createGoogleProvider(apiKey: string): AIProvider {
  async function callGeminiAPI(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<string> {
    const { temperature = 0.7, maxTokens = 1000, timeoutMs = DEFAULT_TIMEOUT_MS, jsonMode = false } = options;
    const { systemInstruction, contents } = formatMessagesForGemini(messages);

    return withRetry(async (signal) => {
      const url = `${API_BASE_URL}/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(jsonMode && { responseMimeType: 'application/json' }),
        },
      };

      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        throw classifyGoogleError(new Error(`HTTP ${response.status}`), response.status);
      }

      const data = await response.json();

      // Extract text from Gemini response
      if (data.candidates && data.candidates[0]?.content?.parts) {
        const textParts = data.candidates[0].content.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text);
        return textParts.join('');
      }

      return '';
    }, { timeoutMs });
  }

  return {
    name: 'google',

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      return callGeminiAPI(messages, options);
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
          { temperature: 0.3, maxTokens: 2000 }
        );

        if (content) {
          // Parse the JSON block from the markdown+JSON response
          const jsonMatch = content.match(/---MACROS_JSON---\s*(\{[\s\S]*?\})\s*---END_MACROS---/);
          if (jsonMatch && jsonMatch[1]) {
            const parsed = JSON.parse(jsonMatch[1]);
            const validated = validateAndCorrectMealAnalysis(parsed);
            if (validated) {
              validated.markdown = stripMacrosBlock(content);
              return validated;
            }
          }
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

Generate an appropriate workout. Respond with ONLY valid JSON, no markdown.
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
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as GeneratedWorkout;
          }
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

Respond with ONLY valid JSON, no markdown.
`;

      try {
        const content = await this.chat(
          [
            { role: 'system', content: WEEKLY_NUTRITION_PROMPT },
            { role: 'user', content: prompt },
          ],
          { maxTokens: 800, temperature: 0.5, jsonMode: true }
        );

        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as WeeklyNutritionInsights;
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
        }
        return null;
      } catch {
        return null;
      }
    },

    // Note: Google has audio transcription but it's a separate API
    // For simplicity, we don't implement it here
  };
}
