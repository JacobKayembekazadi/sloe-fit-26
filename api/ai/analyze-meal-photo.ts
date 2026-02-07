import { withFallback } from '../../lib/ai';
import type { AIResponse, PhotoMealAnalysis } from '../../lib/ai/types';

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

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.analyzeMealPhoto(imageBase64, userGoal)
    );

    const response: AIResponse<PhotoMealAnalysis> = {
      success: !result.markdown.startsWith('Error:'),
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    };

    if (result.markdown.startsWith('Error:')) {
      response.error = {
        type: 'unknown',
        message: result.markdown.replace('Error: ', ''),
        retryable: true,
      };
    }

    return new Response(JSON.stringify(response), {
      status: response.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { type?: string; message?: string; retryable?: boolean };

    const response: AIResponse<PhotoMealAnalysis> = {
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
