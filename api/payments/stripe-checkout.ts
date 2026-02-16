import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-01-28.clover',
});

// Price IDs from Stripe Dashboard
const PRICE_IDS = {
    monthly: process.env.STRIPE_PRICE_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_ANNUAL || '',
    trainer: process.env.STRIPE_PRICE_TRAINER || '',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers - restrict to allowed origins
    const allowedOrigins = [
        'https://app.sloefit.com',
        'https://sloefit.com',
        'https://sloe-fit-26.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
    ];

    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, email, plan, successUrl, cancelUrl } = req.body;

        if (!userId || !email || !plan) {
            return res.status(400).json({ error: 'Missing required fields: userId, email, plan' });
        }

        const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];
        if (!priceId) {
            return res.status(400).json({ error: `Invalid plan: ${plan}` });
        }

        // Create or retrieve Stripe customer
        const customers = await stripe.customers.list({ email, limit: 1 });
        let customer: Stripe.Customer;

        if (customers.data.length > 0) {
            customer = customers.data[0];
        } else {
            customer = await stripe.customers.create({
                email,
                metadata: { supabase_user_id: userId },
            });
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl || `${process.env.VITE_APP_URL || 'https://sloe-fit-26.vercel.app'}/settings?payment=success`,
            cancel_url: cancelUrl || `${process.env.VITE_APP_URL || 'https://sloe-fit-26.vercel.app'}/settings?payment=cancelled`,
            metadata: {
                supabase_user_id: userId,
                plan,
            },
            subscription_data: {
                metadata: {
                    supabase_user_id: userId,
                    plan,
                },
            },
            allow_promotion_codes: true,
        });

        return res.status(200).json({
            sessionId: session.id,
            url: session.url,
        });
    } catch (error) {
        console.error('Stripe checkout error:', error);
        return res.status(500).json({
            error: 'Failed to create checkout session',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
