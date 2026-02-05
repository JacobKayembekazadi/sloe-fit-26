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
 * Get the configured AI provider from environment variables.
 *
 * Expected env vars:
 * - AI_PROVIDER: 'openai' | 'anthropic' | 'google' | 'mistral'
 * - AI_API_KEY: The API key for the selected provider
 *
 * OR provider-specific keys:
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - GOOGLE_AI_API_KEY
 */
export function getProviderFromEnv(): AIProvider {
  // Check for unified config first
  const providerType = (process.env.AI_PROVIDER || 'openai') as AIProviderType;
  let apiKey = process.env.AI_API_KEY;

  // Fall back to provider-specific keys
  if (!apiKey) {
    switch (providerType) {
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      case 'google':
        apiKey = process.env.GOOGLE_AI_API_KEY;
        break;
      case 'mistral':
        apiKey = process.env.MISTRAL_API_KEY;
        break;
    }
  }

  if (!apiKey) {
    throw new Error(`No API key found for provider: ${providerType}. Set AI_API_KEY or ${providerType.toUpperCase()}_API_KEY`);
  }

  return createProvider(providerType, apiKey);
}

/**
 * Get the current provider type from environment
 */
export function getProviderType(): AIProviderType {
  return (process.env.AI_PROVIDER || 'openai') as AIProviderType;
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
