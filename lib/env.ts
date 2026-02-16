/**
 * Environment variable helpers for serverless functions.
 * Throws clear errors when required vars are missing.
 */

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
}

export function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    'https://sloe-fit-26.vercel.app'
  );
}
