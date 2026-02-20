/**
 * Server-Side Environment Variable Helpers
 *
 * Throws on missing required vars instead of falling back to empty strings.
 * Prevents silent failures in payment and auth endpoints.
 */

/**
 * Require a non-empty environment variable. Throws if missing or empty.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get the app URL for redirects. Checks APP_URL (server-side) first,
 * falls back to VITE_APP_URL, then hardcoded default.
 */
export function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    'https://sloe-fit-26.vercel.app'
  );
}

/**
 * Get the Supabase URL. Checks server-side SUPABASE_URL first,
 * falls back to VITE_SUPABASE_URL.
 */
export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing required environment variable: SUPABASE_URL or VITE_SUPABASE_URL');
  }
  return url;
}
