import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Disable body parsing - we need raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    let event: Stripe.Event;

    try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['stripe-signature'] as string;

        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log(`[Stripe Webhook] Event: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutComplete(session);
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionUpdate(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleSubscriptionCancelled(subscription);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handlePaymentFailed(invoice);
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('[Stripe Webhook] Handler error:', error);
        return res.status(500).json({ error: 'Webhook handler failed' });
    }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.supabase_user_id;
    const plan = session.metadata?.plan || 'monthly';
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!userId) {
        console.error('[Stripe] No user ID in checkout session metadata');
        return;
    }

    console.log(`[Stripe] Checkout complete for user ${userId}, plan: ${plan}`);

    // Get subscription details for end date
    let endsAt: string | null = null;
    if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        endsAt = new Date(subscription.current_period_end * 1000).toISOString();
    }

    // Update user profile
    const { error } = await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_provider: 'stripe',
            subscription_plan: plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_ends_at: endsAt,
        })
        .eq('id', userId);

    if (error) {
        console.error('[Stripe] Failed to update profile:', error);
        throw error;
    }

    console.log(`[Stripe] Activated subscription for user ${userId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const status = subscription.status;

    // Find user by Stripe customer ID
    const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (findError || !profile) {
        console.error('[Stripe] User not found for customer:', customerId);
        return;
    }

    const subscriptionStatus = status === 'active' || status === 'trialing' ? 'active' : 'expired';
    const endsAt = new Date(subscription.current_period_end * 1000).toISOString();

    const { error } = await supabase
        .from('profiles')
        .update({
            subscription_status: subscriptionStatus,
            stripe_subscription_id: subscription.id,
            subscription_ends_at: endsAt,
        })
        .eq('id', profile.id);

    if (error) {
        console.error('[Stripe] Failed to update subscription:', error);
        throw error;
    }

    console.log(`[Stripe] Updated subscription for user ${profile.id}: ${subscriptionStatus}`);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (findError || !profile) {
        console.error('[Stripe] User not found for customer:', customerId);
        return;
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            subscription_status: 'expired',
            subscription_ends_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

    if (error) {
        console.error('[Stripe] Failed to cancel subscription:', error);
        throw error;
    }

    console.log(`[Stripe] Cancelled subscription for user ${profile.id}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;

    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (profile) {
        console.log(`[Stripe] Payment failed for user ${profile.id}`);
        // Could send email notification here
    }
}
