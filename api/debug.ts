export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const errors: string[] = [];

  // Test 1: Basic env vars
  try {
    const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!hasSupabaseUrl) errors.push('Missing SUPABASE_URL');
    if (!hasServiceKey) errors.push('Missing SUPABASE_SERVICE_ROLE_KEY');
  } catch (e) {
    errors.push(`Env check failed: ${(e as Error).message}`);
  }

  // Test 2: Import lib/env
  try {
    const { getSupabaseUrl, requireEnv } = await import('../lib/env');
    const url = getSupabaseUrl();
    const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!url) errors.push('getSupabaseUrl returned empty');
    if (!key) errors.push('requireEnv returned empty');
  } catch (e) {
    errors.push(`lib/env import failed: ${(e as Error).message}`);
  }

  // Test 3: Import Supabase client
  try {
    const { createClient } = await import('@supabase/supabase-js');
    if (!createClient) errors.push('createClient not found');
  } catch (e) {
    errors.push(`Supabase import failed: ${(e as Error).message}`);
  }

  // Test 4: Import requireAuth
  try {
    const { requireAuth } = await import('../lib/ai/requireAuth');
    if (!requireAuth) errors.push('requireAuth not found');
  } catch (e) {
    errors.push(`requireAuth import failed: ${(e as Error).message}`);
  }

  // Test 5: Import apiHelpers
  try {
    const { apiGate } = await import('../lib/ai/apiHelpers');
    if (!apiGate) errors.push('apiGate not found');
  } catch (e) {
    errors.push(`apiHelpers import failed: ${(e as Error).message}`);
  }

  // Test 6: Import AI providers
  try {
    const { withFallback } = await import('../lib/ai');
    if (!withFallback) errors.push('withFallback not found');
  } catch (e) {
    errors.push(`lib/ai import failed: ${(e as Error).message}`);
  }

  return new Response(JSON.stringify({
    success: errors.length === 0,
    errors,
    timestamp: new Date().toISOString(),
  }, null, 2), {
    status: errors.length === 0 ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
