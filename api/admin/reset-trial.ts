import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, requireEnv } from '../../lib/env';

const supabase = createClient(
  getSupabaseUrl(),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow in non-production or with admin secret
  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'] as string;

  if (!adminSecret || providedSecret !== adminSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  // Find user by email
  const { data: users, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    return res.status(500).json({ error: 'Failed to list users', details: authError.message });
  }

  const user = users.users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Reset trial
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'trial',
      trial_started_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return res.status(500).json({ error: 'Failed to update', details: error.message });
  }

  return res.status(200).json({
    success: true,
    userId: user.id,
    subscription_status: 'trial',
    trial_started_at: new Date().toISOString(),
    message: '7-day trial activated',
  });
}
