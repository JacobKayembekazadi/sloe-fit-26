import { withFallback } from '../../lib/ai';
import type { AIResponse, WeeklyPlan, WeeklyPlanGenerationInput } from '../../lib/ai/types';
import { apiGate, getErrorType, sanitizeAIObject } from '../../lib/ai/apiHelpers';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const blocked = await apiGate(req);
  if (blocked) return blocked;

  const startTime = Date.now();

  try {
    const body: WeeklyPlanGenerationInput = await req.json();

    // Validate required fields
    if (!body.profile) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'User profile is required', retryable: false },
        } as AIResponse<WeeklyPlan>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ensure arrays exist
    if (!body.recentWorkouts) {
      body.recentWorkouts = [];
    }
    if (!body.recoveryPatterns) {
      body.recoveryPatterns = [];
    }

    // FIX 8.1: Sanitize string fields in profile before passing to AI
    const sanitizedBody = {
      ...body,
      profile: sanitizeAIObject(body.profile as unknown as Record<string, unknown>),
      recentWorkouts: body.recentWorkouts?.map(w => sanitizeAIObject(w as unknown as Record<string, unknown>)) || [],
      recoveryPatterns: body.recoveryPatterns?.map(r => sanitizeAIObject(r as unknown as Record<string, unknown>)) || [],
    } as unknown as WeeklyPlanGenerationInput;

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.planWeek(sanitizedBody)
    );

    const response: AIResponse<WeeklyPlan> = {
      success: result !== null,
      data: result ?? undefined,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    };

    if (!result) {
      response.error = {
        type: 'unknown',
        message: 'Failed to generate weekly plan',
        retryable: true,
      };
    }

    return new Response(JSON.stringify(response), {
      status: result ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { message?: string; retryable?: boolean };

    const response: AIResponse<WeeklyPlan> = {
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
