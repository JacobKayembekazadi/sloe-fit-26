/**
 * API Route: POST /api/ai/coach
 *
 * Generates AI coaching messages using PIADR prompts with King Kay Mix voice.
 * Falls back to static messages from coachingEngine.ts if AI fails.
 */

import { withFallback } from '../../lib/ai';
import type { AIResponse } from '../../lib/ai/types';
import { apiGate, getErrorType } from '../../lib/ai/apiHelpers';
import { buildCoachingPrompt, type CoachingPromptInput } from '../../prompts/coachingPrompts';

export const config = {
  runtime: 'edge',
};

interface CoachingRequest {
  insightType: string;
  patternData: Record<string, unknown>;
  userContext: {
    goal?: string;
    programDay?: number;
    recentWorkouts?: number;
  };
}

interface CoachingResponse {
  message: string;
  productKey?: string;
}

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
    const body: CoachingRequest = await req.json();

    if (!body.insightType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'insightType is required', retryable: false },
        } as AIResponse<CoachingResponse>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const promptInput: CoachingPromptInput = {
      insightType: body.insightType,
      patternData: body.patternData || {},
      userContext: body.userContext || {},
    };

    const prompt = buildCoachingPrompt(promptInput);

    const { data: result, provider: usedProvider } = await withFallback(
      async (provider) => {
        const text = await provider.chat(
          [{ role: 'user', content: prompt }],
          { maxTokens: 200, temperature: 0.7 },
        );
        try {
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as CoachingResponse;
          }
        } catch {
          // If JSON parse fails, use the raw text as message
        }

        return { message: text.slice(0, 200) } as CoachingResponse;
      }
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    } as AIResponse<CoachingResponse>), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { message?: string; retryable?: boolean };

    const response: AIResponse<CoachingResponse> = {
      success: false,
      error: {
        type: getErrorType(error),
        message: aiError.message || 'Coaching AI unavailable',
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
