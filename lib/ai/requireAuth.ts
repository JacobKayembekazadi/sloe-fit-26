/**
 * API Route Authentication Helper
 *
 * Extracts and verifies Supabase JWT from the Authorization header.
 * Returns the user ID on success, or a 401 Response on failure.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export interface AuthResult {
  userId: string;
}

export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { type: 'auth', message, retryable: false },
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Verify the Authorization header and return the user ID.
 * Returns null if auth fails — caller should return unauthorizedResponse().
 */
export async function requireAuth(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;

    return { userId: user.id };
  } catch {
    return null;
  }
}
