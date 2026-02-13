import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  TextMealAnalysis,
  PhotoMealAnalysis,
  BodyAnalysisResult,
  ProgressAnalysisResult,
  GeneratedWorkout,
  WorkoutGenerationInput,
  WeeklyNutritionInput,
  WeeklyNutritionInsights,
  WeeklyPlan,
  WeeklyPlanGenerationInput,
  AIError,
} from '../types';
import { validateAndCorrectMealAnalysis, parseMacrosFromResponse, stripMacrosBlock } from '../utils';
import { getModelForTask, getTimeoutForTask } from '../config';
import {
  BODY_ANALYSIS_PROMPT,
  MEAL_ANALYSIS_PROMPT,
  MEAL_PHOTO_IDENTIFICATION_PROMPT,
  PROGRESS_ANALYSIS_PROMPT,
  WORKOUT_GENERATION_PROMPT,
  TEXT_MEAL_ANALYSIS_PROMPT,
  WEEKLY_NUTRITION_PROMPT,
  WEEKLY_PLANNING_AGENT_PROMPT,
} from '../../../prompts';
import {
  enrichFoodsWithNutrition,
  generateMealMarkdown,
  type IdentifiedFood,
} from '../usdaIntegration';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_TIMEOUT_MS = 30000;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Extended options for vision tasks
interface ExtendedChatOptions extends ChatOptions {
  isVisionTask?: boolean;
}

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
  /**
   * Core Gemini API call.
   */
  async function callGeminiAPI(
    messages: ChatMessage[],
    options: ExtendedChatOptions = {}
  ): Promise<string> {
    const {
      temperature = 0.7,
      maxTokens = 1000,
      timeoutMs,
      jsonMode = false,
      isVisionTask = false,
    } = options;

    const model = getModelForTask();
    const effectiveTimeout = timeoutMs ?? getTimeoutForTask(isVisionTask);
    const { systemInstruction, contents } = formatMessagesForGemini(messages);

    return withRetry(async (signal) => {
      const url = `${API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

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

      // Check for content moderation block (no candidates or blocked reason)
      if (data.promptFeedback?.blockReason) {
        console.error('[google] Content blocked:', data.promptFeedback.blockReason);
        throw {
          type: 'content_filter',
          message: `Content blocked: ${data.promptFeedback.blockReason}`,
          retryable: false,
          provider: 'google',
        };
      }

      if (data.candidates && data.candidates[0]?.content?.parts) {
        // Check if finish reason indicates content filtering
        const finishReason = data.candidates[0].finishReason;
        if (finishReason === 'SAFETY' || finishReason === 'BLOCKED') {
          console.error('[google] Response blocked due to safety filters');
          throw {
            type: 'content_filter',
            message: 'Image content blocked by safety filters. Try a different photo.',
            retryable: false,
            provider: 'google',
          };
        }

        const parts = data.candidates[0].content.parts;
        return parts
          .filter((p: { text?: string }) => p.text)
          .map((p: { text: string }) => p.text)
          .join('');
      }

      // No candidates at all - likely a content moderation issue
      console.error('[google] No candidates in response:', JSON.stringify(data).substring(0, 500));
      throw {
        type: 'content_filter',
        message: 'No response generated. The image may have been blocked by content filters.',
        retryable: false,
        provider: 'google',
      };
    }, { timeoutMs: effectiveTimeout });
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
      // ========================================================================
      // Two-Phase Meal Analysis: AI Identifies → USDA Lookup → Deterministic Math
      // ========================================================================

      // Legacy fallback function (inline to avoid interface changes)
      const legacyAnalysis = async (): Promise<PhotoMealAnalysis> => {
        const goalText = userGoal
          ? `The user's current goal is: ${userGoal}. Tailor your feedback to this goal.`
          : 'The user has not set a specific goal yet. Provide general nutrition advice.';

        try {
          const responseText = await callGeminiAPI(
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
            { maxTokens: 1500, isVisionTask: true }
          );

          if (responseText) {
            const { macros, foods } = parseMacrosFromResponse(responseText);
            const markdown = stripMacrosBlock(responseText);
            return {
              markdown,
              macros,
              foods: foods.length > 0 ? foods : undefined,
              hasUSDAData: false, // Legacy uses AI estimates
            };
          }

          return { markdown: 'Error: No response from model.', macros: null };
        } catch (error) {
          const aiError = error as AIError;
          return { markdown: `Error: ${aiError.message}`, macros: null };
        }
      };

      try {
        // Phase 1: AI identifies foods (structured JSON)
        console.log('[google] Phase 1: Identifying foods in photo...');
        const identificationResponse = await callGeminiAPI(
          [
            { role: 'system', content: MEAL_PHOTO_IDENTIFICATION_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Identify all foods in this meal photo.' },
                { type: 'image', imageUrl: imageBase64 },
              ],
            },
          ],
          { maxTokens: 1000, isVisionTask: true, jsonMode: true, temperature: 0.3 }
        );

        // Try to parse the JSON response
        let identifiedFoods: IdentifiedFood[] = [];
        try {
          const parsed = JSON.parse(identificationResponse);
          if (parsed.foods && Array.isArray(parsed.foods)) {
            identifiedFoods = parsed.foods.map((f: {
              name?: string;
              portion?: string;
              portionGrams?: number;
              confidence?: number;
            }) => ({
              name: f.name || 'Unknown food',
              portion: f.portion || 'medium',
              portionGrams: f.portionGrams,
              confidence: f.confidence ?? 0.7,
            }));
          }
        } catch (parseError) {
          console.warn('[google] Failed to parse food identification JSON, falling back to legacy:', parseError);
          return legacyAnalysis();
        }

        if (identifiedFoods.length === 0) {
          console.warn('[google] No foods identified, falling back to legacy analysis');
          return legacyAnalysis();
        }

        console.log(`[google] Phase 1 complete: Identified ${identifiedFoods.length} foods`);

        // Phase 2: USDA lookup for each food
        console.log('[google] Phase 2: Looking up nutrition data...');
        const { foods: foodsWithNutrition, totals, hasUSDAData } = await enrichFoodsWithNutrition(identifiedFoods);

        const usdaCount = foodsWithNutrition.filter(f => f.source === 'usda').length;
        console.log(`[google] Phase 2 complete: ${usdaCount}/${foodsWithNutrition.length} foods matched USDA`);

        // Phase 3: Generate markdown summary
        const markdown = generateMealMarkdown(foodsWithNutrition, totals, userGoal);

        return {
          markdown,
          macros: totals,
          foods: foodsWithNutrition.map(f => f.name),
          foodsDetailed: foodsWithNutrition,
          hasUSDAData,
        };
      } catch (error) {
        console.error('[google] Two-phase analysis failed, falling back to legacy:', error);
        return legacyAnalysis();
      }
    },

    async analyzeBodyPhoto(imageBase64: string): Promise<BodyAnalysisResult> {
      try {
        const responseText = await callGeminiAPI(
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
          { maxTokens: 1500, isVisionTask: true }
        );
        return { markdown: responseText || 'Error: No response from model.' };
      } catch (error) {
        const aiError = error as AIError;
        return { markdown: `Error: ${aiError.message}` };
      }
    },

    async analyzeProgress(images: string[], metrics: string): Promise<ProgressAnalysisResult> {
      try {
        const imageParts = images.map(img => ({ type: 'image' as const, imageUrl: img }));

        const responseText = await callGeminiAPI(
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
          { maxTokens: 2000, isVisionTask: true }
        );
        return { markdown: responseText || 'Error: No response from model.' };
      } catch (error) {
        const aiError = error as AIError;
        return { markdown: `Error: ${aiError.message}` };
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

    async planWeek(input: WeeklyPlanGenerationInput): Promise<WeeklyPlan | null> {
      // Format workout history for the agent
      const workoutHistoryText = input.recentWorkouts.length > 0
        ? input.recentWorkouts.map(w => {
            const exerciseList = w.exercises
              .map(e => `  - ${e.name}: ${e.sets}×${e.reps}${e.weight ? ` @ ${e.weight}lbs` : ''}`)
              .join('\n');
            return `${w.date} - ${w.title} (Volume: ${w.volume} total reps)\n  Muscles: ${w.muscles.join(', ')}\n${exerciseList}`;
          }).join('\n\n')
        : 'No recent workout history available.';

      // Format recovery patterns
      const recoveryText = input.recoveryPatterns.length > 0
        ? input.recoveryPatterns.map(r =>
            `${r.date}: Energy ${r.energyLevel}/5, Sleep ${r.sleepHours}hrs${r.sorenessAreas.length > 0 ? `, Sore: ${r.sorenessAreas.join(', ')}` : ''}`
          ).join('\n')
        : 'No recovery data available.';

      // Calculate averages
      const avgEnergy = input.recoveryPatterns.length > 0
        ? (input.recoveryPatterns.reduce((sum, r) => sum + r.energyLevel, 0) / input.recoveryPatterns.length).toFixed(1)
        : 'N/A';
      const avgSleep = input.recoveryPatterns.length > 0
        ? (input.recoveryPatterns.reduce((sum, r) => sum + r.sleepHours, 0) / input.recoveryPatterns.length).toFixed(1)
        : 'N/A';

      // Get the start of the upcoming week (next Monday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + daysUntilMonday);
      const weekStart = nextMonday.toISOString().split('T')[0];

      const prompt = `
Create a complete 7-day training plan for the upcoming week starting ${weekStart}.

USER PROFILE:
- Goal: ${input.profile.goal || 'RECOMP'}
- Training Experience: ${input.profile.training_experience || 'intermediate'}
- Equipment Access: ${input.profile.equipment_access || 'gym'}
- Preferred Days Per Week: ${input.profile.days_per_week || 4}
${input.preferredSchedule ? `- Preferred Training Days: ${input.preferredSchedule.map(d => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(', ')}` : ''}

WORKOUT HISTORY (Last 3-4 weeks):
${workoutHistoryText}

RECOVERY PATTERNS (Recent):
${recoveryText}

RECOVERY AVERAGES:
- Average Energy Level: ${avgEnergy}/5
- Average Sleep: ${avgSleep} hours

Remember to use week_start: "${weekStart}" in your response. Respond with ONLY valid JSON, no markdown.
`;

      try {
        const content = await this.chat(
          [
            { role: 'system', content: WEEKLY_PLANNING_AGENT_PROMPT },
            { role: 'user', content: prompt },
          ],
          { maxTokens: 4000, jsonMode: true, temperature: 0.4, timeoutMs: 60000 }
        );

        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as WeeklyPlan;

            if (
              typeof parsed.id === 'string' &&
              typeof parsed.week_start === 'string' &&
              Array.isArray(parsed.days) &&
              parsed.days.length === 7 &&
              typeof parsed.reasoning === 'string'
            ) {
              if (!parsed.created_at) {
                parsed.created_at = new Date().toISOString();
              }
              return parsed;
            }
          }
        }
        return null;
      } catch {
        return null;
      }
    },
  };
}
