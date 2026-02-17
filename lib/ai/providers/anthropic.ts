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
  WeeklyPlan,
  WeeklyPlanGenerationInput,
  AIError,
  BodyAnalysisResult,
  ProgressAnalysisResult,
} from '../types';
import { validateAndCorrectMealAnalysis, parseMacrosFromResponse, stripMacrosBlock } from '../utils';
import {
  BODY_ANALYSIS_PROMPT,
  MEAL_ANALYSIS_PROMPT,
  PROGRESS_ANALYSIS_PROMPT,
  WORKOUT_GENERATION_PROMPT,
  TEXT_MEAL_ANALYSIS_PROMPT,
  WEEKLY_NUTRITION_PROMPT,
  WEEKLY_PLANNING_AGENT_PROMPT,
} from '../../../prompts';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_TIMEOUT_MS = 30000;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const API_BASE_URL = 'https://api.anthropic.com/v1';

// ============================================================================
// Error Handling
// ============================================================================

function classifyAnthropicError(error: unknown, status?: number): AIError {
  if (error instanceof Error && error.name === 'AbortError') {
    return { type: 'timeout', message: 'Request timed out.', retryable: true, provider: 'anthropic' };
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return { type: 'network', message: 'Network error.', retryable: true, provider: 'anthropic' };
  }

  if (status) {
    switch (status) {
      case 401:
        return { type: 'auth', message: 'Authentication failed.', retryable: false, provider: 'anthropic' };
      case 429:
        return { type: 'rate_limit', message: 'Rate limit reached.', retryable: true, retryAfterMs: 60000, provider: 'anthropic' };
      case 400:
        return { type: 'invalid_request', message: 'Invalid request.', retryable: false, provider: 'anthropic' };
      case 500:
      case 502:
      case 503:
      case 529:
        return { type: 'server_error', message: 'Server error.', retryable: true, provider: 'anthropic' };
      default:
        return { type: 'unknown', message: 'Unknown error.', retryable: status >= 500, provider: 'anthropic' };
    }
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    retryable: false,
    provider: 'anthropic',
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
      lastError = classifyAnthropicError(error);

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
// Message Formatting for Anthropic API
// ============================================================================

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

function formatMessagesForAnthropic(messages: ChatMessage[]): { system: string; messages: AnthropicMessage[] } {
  let systemPrompt = '';
  const formattedMessages: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt += (typeof msg.content === 'string' ? msg.content : '') + '\n';
      continue;
    }

    if (typeof msg.content === 'string') {
      formattedMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    } else {
      // Multi-part content
      const blocks: AnthropicContentBlock[] = [];
      for (const part of msg.content) {
        if (part.type === 'text' && part.text) {
          blocks.push({ type: 'text', text: part.text });
        } else if (part.type === 'image' && part.imageUrl) {
          // Extract base64 data from data URL
          const match = part.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            blocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: match[1],
                data: match[2],
              },
            });
          }
        }
      }
      formattedMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: blocks,
      });
    }
  }

  return { system: systemPrompt.trim(), messages: formattedMessages };
}

// ============================================================================
// Anthropic Provider Implementation
// ============================================================================

export function createAnthropicProvider(apiKey: string): AIProvider {
  async function callAnthropicAPI(
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<string> {
    const { temperature = 0.7, maxTokens = 1000, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    const { system, messages: formattedMessages } = formatMessagesForAnthropic(messages);

    return withRetry(async (signal) => {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: maxTokens,
          temperature,
          system: system || undefined,
          messages: formattedMessages,
        }),
        signal,
      });

      if (!response.ok) {
        throw classifyAnthropicError(new Error(`HTTP ${response.status}`), response.status);
      }

      const data = await response.json();

      // Extract text from response
      if (data.content && Array.isArray(data.content)) {
        const textBlocks = data.content.filter((block: any) => block.type === 'text');
        return textBlocks.map((block: any) => block.text).join('');
      }

      return '';
    }, { timeoutMs });
  }

  return {
    name: 'anthropic',

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      return callAnthropicAPI(messages, options);
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
          { maxTokens: 1500, timeoutMs: 25000 }
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

    async analyzeBodyPhoto(imageBase64: string): Promise<BodyAnalysisResult> {
      try {
        const markdown = await this.chat(
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
          { maxTokens: 1500, timeoutMs: 25000 }
        );
        // Anthropic doesn't support annotated images, return text only
        return { markdown };
      } catch (error) {
        const aiError = error as AIError;
        return { markdown: `Error: ${aiError.message}` };
      }
    },

    async analyzeProgress(images: string[], metrics: string): Promise<ProgressAnalysisResult> {
      try {
        const imageParts = images.map(img => ({ type: 'image' as const, imageUrl: img }));

        const markdown = await this.chat(
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
        // Anthropic doesn't support annotated images, return text only
        return { markdown };
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
          { maxTokens: 2000 }
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
          { maxTokens: 800, temperature: 0.5 }
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

    // Note: Anthropic doesn't have a native audio transcription API
    // This would need to use a separate service like Whisper

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
          { maxTokens: 4000, temperature: 0.4, timeoutMs: 60000 }
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
