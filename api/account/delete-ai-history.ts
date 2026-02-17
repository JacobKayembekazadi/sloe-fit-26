/**
 * API Route: Delete AI Analysis History
 *
 * Deletes all body analysis records for the authenticated user.
 * Supports GDPR right-to-erasure for AI-generated data without
 * requiring full account deletion.
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth, unauthorizedResponse } from '../../lib/ai/requireAuth';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  if (!supabaseServiceKey) {
    console.error('[delete-ai-history] Missing SUPABASE_SERVICE_ROLE_KEY');
    return new Response(
      JSON.stringify({ success: false, error: 'Server configuration error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete body analyses
    const { error: bodyError, count: bodyCount } = await supabase
      .from('body_analyses')
      .delete({ count: 'exact' })
      .eq('user_id', auth.userId);

    if (bodyError) {
      console.error('[delete-ai-history] Failed to delete body analyses:', bodyError);
    }

    // Delete food scans
    const { error: foodError, count: foodCount } = await supabase
      .from('food_scans')
      .delete({ count: 'exact' })
      .eq('user_id', auth.userId);

    if (foodError) {
      console.error('[delete-ai-history] Failed to delete food scans:', foodError);
    }

    const totalDeleted = (bodyCount || 0) + (foodCount || 0);
    console.log(`[delete-ai-history] Deleted ${totalDeleted} records for user ${auth.userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: {
          body_analyses: bodyCount || 0,
          food_scans: foodCount || 0,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[delete-ai-history] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to delete AI history.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
