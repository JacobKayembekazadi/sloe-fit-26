import type { AIProvider, AIProviderType, AIError } from './types';
import { createOpenAIProvider } from './providers/openai';
import { createAnthropicProvider } from './providers/anthropic';
import { createGoogleProvider } from './providers/google';

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Create an AI provider instance based on the provider type
 */
export function createProvider(type: AIProviderType, apiKey: string): AIProvider {
  switch (type) {
    case 'openai':
      return createOpenAIProvider(apiKey);
    case 'anthropic':
      return createAnthropicProvider(apiKey);
    case 'google':
      return createGoogleProvider(apiKey);
    case 'mistral':
      // Mistral uses OpenAI-compatible API, so we can reuse with different base URL
      // For now, throw error - can be implemented similarly to OpenAI
      throw new Error('Mistral provider not yet implemented');
    default:
      throw new Error(`Unknown AI provider: ${type}`);
  }
}

// ============================================================================
// Environment-based Provider Resolution
// ============================================================================

/**
 * Resolve an API key for a given provider type from environment variables.
 */
function resolveKey(type: AIProviderType): string | undefined {
  switch (type) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'google':
      return process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    case 'mistral':
      return process.env.MISTRAL_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Get the configured AI provider from environment variables.
 *
 * Expected env vars:
 * - AI_PROVIDER: 'openai' | 'anthropic' | 'google' | 'mistral'
 * - AI_API_KEY: The API key for the selected provider
 *
 * OR provider-specific keys:
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - GOOGLE_AI_API_KEY / GEMINI_API_KEY
 */
export function getProviderFromEnv(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || 'openai') as AIProviderType;
  const apiKey = process.env.AI_API_KEY || resolveKey(providerType);

  if (!apiKey) {
    throw new Error(`No API key found for provider: ${providerType}. Set AI_API_KEY or ${providerType.toUpperCase()}_API_KEY`);
  }

  return createProvider(providerType, apiKey);
}

/**
 * Build a prioritized list of available providers from env vars.
 * The configured AI_PROVIDER comes first, then any others that have keys.
 */
function getAvailableProviders(): { type: AIProviderType; provider: AIProvider }[] {
  const primary = (process.env.AI_PROVIDER || 'openai') as AIProviderType;
  const order: AIProviderType[] = [primary, 'openai', 'google', 'anthropic'];
  const seen = new Set<AIProviderType>();
  const result: { type: AIProviderType; provider: AIProvider }[] = [];

  for (const type of order) {
    if (seen.has(type)) continue;
    seen.add(type);
    const key = process.env.AI_API_KEY && type === primary ? process.env.AI_API_KEY : resolveKey(type);
    if (key) {
      try {
        result.push({ type, provider: createProvider(type, key) });
      } catch { /* skip misconfigured providers */ }
    }
  }
  return result;
}

/**
 * Get the current provider type from environment
 */
export function getProviderType(): AIProviderType {
  return (process.env.AI_PROVIDER || 'openai') as AIProviderType;
}

// ============================================================================
// Fallback Execution
// ============================================================================

export interface FallbackResult<T> {
  data: T;
  provider: AIProviderType;
}

/**
 * Execute an AI operation with automatic provider fallback.
 *
 * Tries each available provider in priority order (AI_PROVIDER first,
 * then openai → google → anthropic). On failure, logs the error and
 * moves to the next provider. Throws the last error if all fail.
 */
export async function withFallback<T>(
  fn: (provider: AIProvider) => Promise<T>
): Promise<FallbackResult<T>> {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No AI providers configured. Set AI_API_KEY or a provider-specific key (OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY).');
  }

  let lastError: unknown;

  for (const { type, provider } of providers) {
    try {
      const data = await fn(provider);
      return { data, provider: type };
    } catch (error) {
      lastError = error;
      console.error(`[ai] provider ${type} failed: ${(error as Error).message}`);
    }
  }

  throw lastError;
}

// ============================================================================
// Singleton Instance (for API routes)
// ============================================================================

let cachedProvider: AIProvider | null = null;

/**
 * Get a singleton AI provider instance.
 * Caches the provider for reuse across requests.
 */
export function getProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = getProviderFromEnv();
  }
  return cachedProvider;
}

/**
 * Clear the cached provider (useful for testing or env changes)
 */
export function clearProviderCache(): void {
  cachedProvider = null;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  AIProvider,
  AIProviderType,
  AIError,
  ChatMessage,
  ChatOptions,
  TextMealAnalysis,
  PhotoMealAnalysis,
  GeneratedWorkout,
  WorkoutGenerationInput,
  WeeklyNutritionInput,
  WeeklyNutritionInsights,
  AIResponse,
} from './types';

export { createOpenAIProvider } from './providers/openai';
export { createAnthropicProvider } from './providers/anthropic';
export { createGoogleProvider } from './providers/google';
