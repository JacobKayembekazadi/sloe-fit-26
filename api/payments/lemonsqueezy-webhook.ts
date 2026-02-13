import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Disable body parsing for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(req: VercelRequest): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
            data += chunk;
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('LEMONSQUEEZY_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['x-signature'] as string;

        if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
            console.error('Lemon Squeezy webhook signature verification failed');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = JSON.parse(rawBody);
        const eventName = event.meta?.event_name;
        const customData = event.meta?.custom_data || {};

        console.log(`[LemonSqueezy Webhook] Event: ${eventName}`);

        switch (eventName) {
            case 'subscription_created':
            case 'subscription_updated': {
                await handleSubscriptionUpdate(event, customData);
                break;
            }

            case 'subscription_cancelled':
            case 'subscription_expired': {
                await handleSubscriptionCancelled(event, customData);
                break;
            }

            case 'subscription_payment_success': {
                console.log('[LemonSqueezy] Payment success');
                break;
            }

            case 'subscription_payment_failed': {
                await handlePaymentFailed(event, customData);
                break;
            }

            case 'order_created': {
                // One-time purchase (if applicable)
                console.log('[LemonSqueezy] Order created');
                break;
            }

            default:
                console.log(`[LemonSqueezy] Unhandled event: ${eventName}`);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('[LemonSqueezy Webhook] Handler error:', error);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }
}

async function handleSubscriptionUpdate(
    event: Record<string, unknown>,
    customData: { supabase_user_id?: string; plan?: string }
) {
    const data = event.data as { id?: string; attributes?: Record<string, unknown> };
    const attributes = data?.attributes || {};

    const userId = customData.supabase_user_id;
    const plan = customData.plan || 'monthly';
    const subscriptionId = String(data?.id || '');
    const customerId = String(attributes.customer_id || '');
    const status = attributes.status as string;
    const endsAt = attributes.renews_at as string || attributes.ends_at as string;

    if (!userId) {
        console.error('[LemonSqueezy] No user ID in custom data');
        // Try to find user by customer ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('lemon_squeezy_customer_id', customerId)
            .single();

        if (!profile) {
            console.error('[LemonSqueezy] User not found');
            return;
        }
    }

    const subscriptionStatus = ['active', 'on_trial'].includes(status) ? 'active' : 'expired';

    const updateData: Record<string, unknown> = {
        subscription_status: subscriptionStatus,
        subscription_provider: 'lemonsqueezy',
        subscription_plan: plan,
        lemon_squeezy_customer_id: customerId,
        lemon_squeezy_subscription_id: subscriptionId,
    };

    if (endsAt) {
        updateData.subscription_ends_at = endsAt;
    }

    const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

    if (error) {
        console.error('[LemonSqueezy] Failed to update profile:', error);
        throw error;
    }

    console.log(`[LemonSqueezy] Updated subscription for user ${userId}: ${subscriptionStatus}`);
}

async function handleSubscriptionCancelled(
    event: Record<string, unknown>,
    customData: { supabase_user_id?: string }
) {
    const data = event.data as { attributes?: Record<string, unknown> };
    const attributes = data?.attributes || {};
    const customerId = String(attributes.customer_id || '');
    let userId = customData.supabase_user_id;

    if (!userId) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('lemon_squeezy_customer_id', customerId)
            .single();

        if (profile) {
            userId = profile.id;
        }
    }

    if (!userId) {
        console.error('[LemonSqueezy] User not found for cancellation');
        return;
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            subscription_status: 'expired',
            subscription_ends_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (error) {
        console.error('[LemonSqueezy] Failed to cancel subscription:', error);
        throw error;
    }

    console.log(`[LemonSqueezy] Cancelled subscription for user ${userId}`);
}

async function handlePaymentFailed(
    event: Record<string, unknown>,
    customData: { supabase_user_id?: string }
) {
    const userId = customData.supabase_user_id;
    if (userId) {
        console.log(`[LemonSqueezy] Payment failed for user ${userId}`);
        // Could send email notification here
    }
}
