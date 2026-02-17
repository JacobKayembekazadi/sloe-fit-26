import { withFallback } from '../../lib/ai';
import type { AIResponse, PhotoMealAnalysis } from '../../lib/ai/types';
import { apiGateWithAuth, getErrorType, validateImageSize, sanitizeAIInput, hashImage, getCachedResult, setCachedResult } from '../../lib/ai/apiHelpers';

export const config = {
  runtime: 'edge',
};

interface RequestBody {
  imageBase64: string;
  userGoal: string | null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const gate = await apiGateWithAuth(req);
  if (gate.blocked) return gate.blocked;

  const auth = (gate as { blocked: null; auth: { userId: string } }).auth;
  const startTime = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { imageBase64, userGoal } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Image is required', retryable: false },
        } as AIResponse<PhotoMealAnalysis>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tooLarge = validateImageSize(imageBase64);
    if (tooLarge) return tooLarge;

    // Check cache for duplicate analysis (same user + same image within 5 min)
    const cacheKey = await hashImage(auth.userId, imageBase64);
    const cached = getCachedResult<PhotoMealAnalysis>(cacheKey);
    if (cached) {
      console.log('[analyze-meal-photo] Cache hit — returning previous result');
      return new Response(JSON.stringify({
        success: true,
        data: cached.data,
        provider: cached.provider,
        durationMs: Date.now() - startTime,
        cached: true,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // FIX 8.1: Sanitize user inputs before passing to AI
    const safeGoal = userGoal ? sanitizeAIInput(userGoal, 'userGoal') : null;

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.analyzeMealPhoto(imageBase64, safeGoal),
      r => r.markdown.startsWith('Error:')
    );

    // Cache result for dedup
    setCachedResult(cacheKey, result, usedProvider);

    return new Response(JSON.stringify({
      success: true,
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    } as AIResponse<PhotoMealAnalysis>), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { message?: string; retryable?: boolean };

    const response: AIResponse<PhotoMealAnalysis> = {
      success: false,
      error: {
        type: getErrorType(error),
        message: aiError.message || 'An error occurred',
        retryable: aiError.retryable ?? false,
      },
      durationMs: Date.now() - startTime,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
