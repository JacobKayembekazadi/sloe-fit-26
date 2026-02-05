import { getProvider, getProviderType } from '../../lib/ai';
import type { AIResponse } from '../../lib/ai/types';

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

  const startTime = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Image is required', retryable: false },
        } as AIResponse<string>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const provider = getProvider();
    const result = await provider.analyzeBodyPhoto(imageBase64);

    const isError = result.startsWith('Error:');

    const response: AIResponse<string> = {
      success: !isError,
      data: isError ? undefined : result,
      provider: getProviderType(),
      durationMs: Date.now() - startTime,
    };

    if (isError) {
      response.error = {
        type: 'unknown',
        message: result.replace('Error: ', ''),
        retryable: true,
      };
    }

    return new Response(JSON.stringify(response), {
      status: response.success ? 200 : 500,
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
      provider: getProviderType(),
      durationMs: Date.now() - startTime,
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
