import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { requireEnv, getAppUrl } from '../../lib/env';
import { checkPaymentRateLimit } from '../../lib/paymentRateLimit';

const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
    apiVersion: '2026-01-28.clover',
});

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

    if (await checkPaymentRateLimit(req, res)) return;

    try {
        const { customerId, returnUrl } = req.body;

        if (!customerId) {
            return res.status(400).json({ error: 'Missing customerId' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl || `${getAppUrl()}/settings`,
        });

        return res.status(200).json({ url: session.url });
    } catch (error) {
        console.error('Stripe portal error:', error);
        return res.status(500).json({
            error: 'Failed to create portal session',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
