import { withFallback } from '../../lib/ai';
import type { AIResponse, TextMealAnalysis } from '../../lib/ai/types';
import { apiGate, getErrorType, sanitizeAIInput } from '../../lib/ai/apiHelpers';

export const config = {
  runtime: 'edge',
};

interface RequestBody {
  description: string;
  userGoal: string | null;
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
    const body: RequestBody = await req.json();
    const { description, userGoal } = body;

    if (!description || typeof description !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Description is required', retryable: false },
        } as AIResponse<TextMealAnalysis>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // FIX 8.1: Sanitize user inputs before passing to AI
    const safeDescription = sanitizeAIInput(description, 'description');
    const safeGoal = userGoal ? sanitizeAIInput(userGoal, 'userGoal') : null;

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.analyzeTextMeal(safeDescription, safeGoal)
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    } as AIResponse<TextMealAnalysis>), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { message?: string; retryable?: boolean };

    const response: AIResponse<TextMealAnalysis> = {
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
