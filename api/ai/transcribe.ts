import { withFallback } from '../../lib/ai';
import type { AIResponse } from '../../lib/ai/types';

export const config = {
  runtime: 'edge',
};

interface RequestBody {
  audioBase64: string;
  mimeType: string;
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
    const { audioBase64, mimeType } = body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { type: 'invalid_request', message: 'Audio data is required', retryable: false },
        } as AIResponse<string>),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 to Blob
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: mimeType || 'audio/webm' });

    const { data: result, provider: usedProvider } = await withFallback(p => {
      if (!p.transcribeAudio) {
        throw new Error(`Provider ${p.name} does not support audio transcription`);
      }
      return p.transcribeAudio(audioBlob);
    });

    const response: AIResponse<string> = {
      success: result !== null,
      data: result ?? undefined,
      provider: usedProvider,
      durationMs: Date.now() - startTime,
    };

    if (!result) {
      response.error = {
        type: 'unknown',
        message: 'Failed to transcribe audio',
        retryable: true,
      };
    }

    return new Response(JSON.stringify(response), {
      status: result ? 200 : 500,
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
