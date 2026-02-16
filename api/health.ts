export const config = {
  runtime: 'edge',
};

export default function handler(req: Request): Response {
  const checks = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
    STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    UPSTASH_REDIS_REST_URL: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    APP_URL: Boolean(process.env.APP_URL),
  };

  const allPresent = Object.values(checks).every(Boolean);

  return new Response(
    JSON.stringify({
      status: allPresent ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
      checks,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}
