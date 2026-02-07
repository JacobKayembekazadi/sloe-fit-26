import { withFallback } from '../../lib/ai';
import type { AIResponse } from '../../lib/ai/types';

export const config = {
  runtime: 'edge',
};

interface RequestBody {
  images: string[]; // base64 data URLs
  metrics: string;
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
    const { images, metrics } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Images are required', retryable: false },
        } as AIResponse<string>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!metrics || typeof metrics !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Metrics are required', retryable: false },
        } as AIResponse<string>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.analyzeProgress(images, metrics),
      r => r.startsWith('Error:')
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    } as AIResponse<string>), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { type?: string; message?: string; retryable?: boolean };

    const response: AIResponse<string> = {
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
