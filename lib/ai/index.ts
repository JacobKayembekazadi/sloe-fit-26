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
  let key: string | undefined;
  switch (type) {
    case 'openai':
      key = process.env.OPENAI_API_KEY; break;
    case 'anthropic':
      key = process.env.ANTHROPIC_API_KEY; break;
    case 'google':
      key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY; break;
    case 'mistral':
      key = process.env.MISTRAL_API_KEY; break;
    default:
      return undefined;
  }
  // Skip placeholder/dummy keys
  if (!key || key.includes('PLACEHOLDER') || key.includes('your_') || key.length < 10) {
    return undefined;
  }
  return key;
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
  const rawKey = process.env.AI_API_KEY;
  const apiKey = (rawKey && !rawKey.includes('PLACEHOLDER') && !rawKey.includes('your-') && !rawKey.includes('your_') && rawKey.length >= 10)
    ? rawKey
    : resolveKey(providerType);

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
  // If GEMINI_3_ENABLED is set, prefer Google as primary provider
  const geminiEnabled = ['true', 'True', '1', 'yes'].includes(process.env.GEMINI_3_ENABLED || '');
  const primary = (process.env.AI_PROVIDER || (geminiEnabled ? 'google' : 'openai')) as AIProviderType;
  const order: AIProviderType[] = [primary, 'google', 'openai', 'anthropic'];
  const seen = new Set<AIProviderType>();
  const result: { type: AIProviderType; provider: AIProvider }[] = [];

  for (const type of order) {
    if (seen.has(type)) continue;
    seen.add(type);
    const rawFallback = process.env.AI_API_KEY;
    const validFallback = rawFallback && !rawFallback.includes('PLACEHOLDER') && !rawFallback.includes('your-') && !rawFallback.includes('your_') && rawFallback.length >= 10 ? rawFallback : undefined;
    const key = validFallback && type === primary ? validFallback : resolveKey(type);
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
 * Tries ALL available providers (up to 3) to maximize reliability.
 * Cost impact is minimal since we only pay for successful completions,
 * and failed requests usually don't incur charges.
 *
 * Logs which provider succeeded for debugging/cost tracking.
 */
export async function withFallback<T>(
  fn: (provider: AIProvider) => Promise<T>,
  isFailure?: (data: T) => boolean
): Promise<FallbackResult<T>> {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    throw new Error('No AI providers configured. Set AI_API_KEY or a provider-specific key (OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY).');
  }

  // Try ALL available providers for maximum reliability
  const maxAttempts = providers.length;
  let lastError: unknown;

  for (let i = 0; i < maxAttempts; i++) {
    const { type, provider } = providers[i];
    try {
      const data = await fn(provider);
      // Treat null/undefined as a provider failure so we try the next one
      if (data === null || data === undefined) {
        console.error(`[ai] provider ${type} returned null — trying next`);
        lastError = new Error(`Provider ${type} returned null`);
        continue;
      }
      // Check caller-supplied failure predicate (e.g. "Error:" prefix strings)
      if (isFailure?.(data)) {
        console.error(`[ai] provider ${type} returned soft failure — trying next`);
        lastError = new Error(`Provider ${type} returned soft failure`);
        continue;
      }
      console.log(`[ai] success via ${type}${i > 0 ? ` (fallback #${i})` : ''}`);
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
