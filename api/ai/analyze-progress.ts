import { withFallback } from '../../lib/ai';
import type { AIResponse, ProgressAnalysisResult } from '../../lib/ai/types';
import { apiGate, getErrorType, validateImageSize, sanitizeAIInput } from '../../lib/ai/apiHelpers';

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

  const blocked = await apiGate(req);
  if (blocked) return blocked;

  const startTime = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { images, metrics } = body;

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Images are required', retryable: false },
        } as AIResponse<ProgressAnalysisResult>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate size of each image
    for (const img of images) {
      const tooLarge = validateImageSize(img);
      if (tooLarge) return tooLarge;
    }

    if (!metrics || typeof metrics !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Metrics are required', retryable: false },
        } as AIResponse<ProgressAnalysisResult>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // FIX 8.1: Sanitize user metrics text before passing to AI
    const safeMetrics = sanitizeAIInput(metrics, 'metrics');

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.analyzeProgress(images, safeMetrics),
      r => r.markdown.startsWith('Error:')
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    } as AIResponse<ProgressAnalysisResult>), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { message?: string; retryable?: boolean };

    const response: AIResponse<ProgressAnalysisResult> = {
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
