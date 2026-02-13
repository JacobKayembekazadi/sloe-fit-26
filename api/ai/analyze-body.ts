import { withFallback } from '../../lib/ai';
import type { AIResponse, BodyAnalysisResult } from '../../lib/ai/types';
import { apiGate, getErrorType, validateImageSize } from '../../lib/ai/apiHelpers';

export const config = {
  runtime: 'edge',
};

interface RequestBody {
  imageBase64: string;
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
    const { imageBase64 } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      console.error('[analyze-body] Missing or invalid imageBase64 field');
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Image is required', retryable: false },
        } as AIResponse<BodyAnalysisResult>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate that imageBase64 is actually a data URL
    if (!imageBase64.startsWith('data:image/')) {
      console.error('[analyze-body] Invalid image format - expected data URL, got:', imageBase64.substring(0, 50));
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Invalid image format. Expected data URL.', retryable: false },
        } as AIResponse<BodyAnalysisResult>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const tooLarge = validateImageSize(imageBase64);
    if (tooLarge) {
      console.error('[analyze-body] Image too large:', imageBase64.length, 'chars');
      return tooLarge;
    }

    console.log('[analyze-body] Processing image, size:', Math.round(imageBase64.length / 1024), 'KB');

    const { data: result, provider: usedProvider } = await withFallback(
      p => p.analyzeBodyPhoto(imageBase64),
      r => {
        const isError = r.markdown.startsWith('Error:');
        if (isError) {
          console.error('[analyze-body] Provider returned error:', r.markdown.substring(0, 200));
        }
        return isError;
      }
    );

    return new Response(JSON.stringify({
      success: true,
      data: result,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    } as AIResponse<BodyAnalysisResult>), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const aiError = error as { message?: string; retryable?: boolean; type?: string };

    console.error('[analyze-body] Exception:', {
      type: aiError.type || getErrorType(error),
      message: aiError.message || 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    const response: AIResponse<BodyAnalysisResult> = {
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
