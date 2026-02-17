/**
 * API Route: Account Deletion (GDPR Art. 17 - Right to Erasure)
 *
 * Permanently deletes user account and all associated data.
 * Database CASCADE constraints handle cleanup of related tables.
 */

import { createClient } from '@supabase/supabase-js';
import { requireAuth, unauthorizedResponse } from '../../lib/ai/requireAuth';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function DELETE(req: Request): Promise<Response> {
  // Verify authentication
  const auth = await requireAuth(req);
  if (!auth) {
    return unauthorizedResponse('Authentication required to delete account');
  }

  const { userId } = auth;

  // Require service role key for admin operations
  if (!supabaseServiceKey) {
    console.error('[account/delete] Missing SUPABASE_SERVICE_ROLE_KEY');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Server configuration error. Contact support.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Delete user's storage files first (photos)
    // List and delete from user-photos bucket
    const { data: photoFiles } = await supabaseAdmin.storage
      .from('user-photos')
      .list(userId);

    if (photoFiles && photoFiles.length > 0) {
      const filePaths = photoFiles.map(f => `${userId}/${f.name}`);
      await supabaseAdmin.storage
        .from('user-photos')
        .remove(filePaths);
    }

    // Delete the user from auth.users
    // This will CASCADE delete:
    // - profiles (ON DELETE CASCADE)
    // - workouts (ON DELETE CASCADE)
    // - meals (ON DELETE CASCADE)
    // - progress_photos (ON DELETE CASCADE)
    // - measurements (ON DELETE CASCADE)
    // - audit_logs (ON DELETE CASCADE)
    // - body_analyses (ON DELETE CASCADE)
    // - food_scans (ON DELETE CASCADE)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[account/delete] Failed to delete user:', deleteError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to delete account. Please try again or contact support.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[account/delete] Unexpected error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
