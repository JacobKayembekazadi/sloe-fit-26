/**
 * API Route: Data Export (GDPR Art. 20 - Right to Data Portability)
 *
 * Exports all user data in a machine-readable JSON format.
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth, unauthorizedResponse } from '../../lib/ai/requireAuth';
import { requireEnv, getSupabaseUrl } from '../../lib/env';

const supabaseUrl = getSupabaseUrl();
const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

export async function GET(req: Request): Promise<Response> {
  // Verify authentication
  const auth = await requireAuth(req);
  if (!auth) {
    return unauthorizedResponse('Authentication required to export data');
  }

  const { userId } = auth;

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch all user data from various tables
    const [
      profileResult,
      workoutsResult,
      mealsResult,
      progressPhotosResult,
      measurementsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      supabaseAdmin
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('progress_photos')
        .select('id, photo_type, weight_lbs, notes, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('measurements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    // Compile export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      profile: profileResult.data || null,
      workouts: workoutsResult.data || [],
      meals: mealsResult.data || [],
      progressPhotos: progressPhotosResult.data || [],
      measurements: measurementsResult.data || [],
      _metadata: {
        format: 'GDPR Data Export',
        version: '1.0',
        note: 'Photo files are not included in this export. Photo metadata is provided above.',
      },
    };

    // Return as downloadable JSON
    return new Response(
      JSON.stringify(exportData, null, 2),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="sloefit-data-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      }
    );
  } catch (err) {
    console.error('[account/export] Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
