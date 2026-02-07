import { withFallback } from '../../lib/ai';
import type { AIResponse, WeeklyNutritionInput, WeeklyNutritionInsights } from '../../lib/ai/types';

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
    const body: WeeklyNutritionInput = await req.json();

    // Validate required fields
    if (!Array.isArray(body.logs) || !body.targets) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Logs and targets are required', retryable: false },
        } as AIResponse<WeeklyNutritionInsights>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.analyzeWeeklyNutrition(body)
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    } as AIResponse<WeeklyNutritionInsights>), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { type?: string; message?: string; retryable?: boolean };

    const response: AIResponse<WeeklyNutritionInsights> = {
      success: false,
      error: {
        type: aiError.type as any || 'unknown',
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
