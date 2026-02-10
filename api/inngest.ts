/**
 * Inngest API Endpoint
 *
 * This endpoint serves the Inngest functions and handles webhook calls.
 * Inngest will call this endpoint to:
 * - Discover available functions
 * - Execute function steps
 * - Handle retries and failures
 *
 * Note: The webhook handler itself is fast - Inngest manages long-running work.
 * We use Edge runtime for faster cold starts.
 */

import { serve } from 'inngest/edge';
import { inngest } from '../lib/inngest/client';
import { functions } from '../lib/inngest/functions';

// Use Edge runtime (same as other routes)
export const config = {
  runtime: 'edge',
};

// Inngest serve handler for Edge runtime
const handler = serve({
  client: inngest,
  functions,
});

// Export as default function matching Vercel's expected signature
export default async function inngestHandler(req: Request): Promise<Response> {
  return handler(req);
}
