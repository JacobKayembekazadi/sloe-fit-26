import { getProvider, getProviderType } from '../../lib/ai';
import type { AIResponse, GeneratedWorkout, WorkoutGenerationInput } from '../../lib/ai/types';

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

  const startTime = Date.now();

  try {
    const body: WorkoutGenerationInput = await req.json();

    // Validate required fields
    if (!body.profile || !body.recovery) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Profile and recovery data are required', retryable: false },
        } as AIResponse<GeneratedWorkout>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const provider = getProvider();
    const result = await provider.generateWorkout(body);

    const response: AIResponse<GeneratedWorkout> = {
      success: result !== null,
      data: result ?? undefined,
      provider: getProviderType(),
      durationMs: Date.now() - startTime,
    };

    if (!result) {
      response.error = {
        type: 'unknown',
        message: 'Failed to generate workout',
        retryable: true,
      };
    }

    return new Response(JSON.stringify(response), {
      status: result ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { type?: string; message?: string; retryable?: boolean };

    const response: AIResponse<GeneratedWorkout> = {
      success: false,
      error: {
        type: aiError.type as any || 'unknown',
        message: aiError.message || 'An error occurred',
        retryable: aiError.retryable ?? false,
      },
      provider: getProviderType(),
      durationMs: Date.now() - startTime,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
