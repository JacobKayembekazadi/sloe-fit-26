import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireEnv, getAppUrl } from '../../lib/env';
import { checkPaymentRateLimit } from '../../lib/paymentRateLimit';

// Lemon Squeezy Variant IDs from Dashboard
const VARIANT_IDS = {
    monthly: process.env.LEMONSQUEEZY_VARIANT_MONTHLY || '',
    annual: process.env.LEMONSQUEEZY_VARIANT_ANNUAL || '',
    trainer: process.env.LEMONSQUEEZY_VARIANT_TRAINER || '',
};

const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || '';

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
        const { userId, email, plan, successUrl, cancelUrl } = req.body;

        if (!userId || !email || !plan) {
            return res.status(400).json({ error: 'Missing required fields: userId, email, plan' });
        }

        const variantId = VARIANT_IDS[plan as keyof typeof VARIANT_IDS];
        if (!variantId) {
            return res.status(400).json({ error: `Invalid plan: ${plan}` });
        }

        // Create checkout via Lemon Squeezy API
        const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${requireEnv('LEMONSQUEEZY_API_KEY')}`,
                'Content-Type': 'application/vnd.api+json',
                'Accept': 'application/vnd.api+json',
            },
            body: JSON.stringify({
                data: {
                    type: 'checkouts',
                    attributes: {
                        checkout_data: {
                            email,
                            custom: {
                                supabase_user_id: userId,
                                plan,
                            },
                        },
                        checkout_options: {
                            embed: false,
                            media: false,
                            button_color: '#D4FF00', // Sloe Volt
                        },
                        product_options: {
                            enabled_variants: [parseInt(variantId)],
                            redirect_url: successUrl || `${getAppUrl()}/?payment=success`,
                        },
                    },
                    relationships: {
                        store: {
                            data: {
                                type: 'stores',
                                id: STORE_ID,
                            },
                        },
                        variant: {
                            data: {
                                type: 'variants',
                                id: variantId,
                            },
                        },
                    },
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Lemon Squeezy API error:', error);
            return res.status(response.status).json({ error: 'Failed to create checkout' });
        }

        const data = await response.json();
        const checkoutUrl = data.data?.attributes?.url;

        if (!checkoutUrl) {
            return res.status(500).json({ error: 'No checkout URL returned' });
        }

        return res.status(200).json({
            url: checkoutUrl,
        });
    } catch (error) {
        console.error('Lemon Squeezy checkout error:', error);
        return res.status(500).json({
            error: 'Failed to create checkout session',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
