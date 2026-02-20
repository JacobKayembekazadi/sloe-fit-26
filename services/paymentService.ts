// Payment Service - Stripe & Lemon Squeezy Integration
// Handles subscription checkout, portal access, and status checks

export type PaymentProvider = 'stripe' | 'lemonsqueezy';
export type SubscriptionPlan = 'monthly' | 'annual' | 'trainer';

export interface SubscriptionStatus {
    status: 'trial' | 'active' | 'expired' | 'none';
    provider: PaymentProvider | null;
    plan: SubscriptionPlan | null;
    endsAt: string | null;
    trialDaysRemaining: number;
    isTrialExpired: boolean;
    canAccessPremium: boolean;
}

export interface CheckoutOptions {
    userId: string;
    email: string;
    plan: SubscriptionPlan;
    provider: PaymentProvider;
    successUrl?: string;
    cancelUrl?: string;
}

// Pricing configuration
export const PRICING = {
    monthly: {
        price: 9.99,
        label: 'Monthly',
        description: 'Billed monthly',
        features: ['AI Workouts', 'Meal Tracking', 'Body Analysis', 'Progress Photos'],
    },
    annual: {
        price: 79.99,
        label: 'Annual',
        description: 'Save 33%',
        pricePerMonth: 6.67,
        features: ['Everything in Monthly', 'Priority Support', '2 Months Free'],
    },
    trainer: {
        price: 29.99,
        label: 'Trainer',
        description: 'For coaches',
        features: ['All Premium Features', 'Client Management', 'Custom Templates', '10 Clients Included'],
    },
} as const;

// Calculate trial days remaining — uses UTC calendar days for consistency
export function getTrialDaysRemaining(trialStartedAt: string | null): number {
    if (!trialStartedAt) return 0;
    const start = new Date(trialStartedAt);
    if (isNaN(start.getTime())) return 0;
    const now = new Date();
    // Use UTC calendar days to avoid timezone inconsistencies
    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const daysPassed = Math.floor((nowUTC - startUTC) / (1000 * 60 * 60 * 24));
    return Math.max(0, 7 - daysPassed);
}

// Check if trial is expired — uses same UTC logic as getTrialDaysRemaining
export function isTrialExpired(trialStartedAt: string | null): boolean {
    if (!trialStartedAt) return true;
    return getTrialDaysRemaining(trialStartedAt) <= 0;
}

// Get subscription status from profile
export function getSubscriptionStatus(profile: {
    subscription_status?: string | null;
    subscription_provider?: string | null;
    subscription_plan?: string | null;
    subscription_ends_at?: string | null;
    trial_started_at?: string | null;
}): SubscriptionStatus {
    const status = (profile.subscription_status || 'trial') as SubscriptionStatus['status'];
    const provider = (profile.subscription_provider || null) as PaymentProvider | null;
    const plan = (profile.subscription_plan || null) as SubscriptionPlan | null;
    const endsAt = profile.subscription_ends_at || null;
    const trialDaysRemaining = getTrialDaysRemaining(profile.trial_started_at || null);
    const trialExpired = isTrialExpired(profile.trial_started_at || null);

    // Check if a paid subscription has expired based on subscription_ends_at
    // This catches cases where the webhook fails to update status to 'expired'
    let effectiveStatus = status;
    if (status === 'active' && endsAt) {
        const endsAtDate = new Date(endsAt);
        const now = new Date();
        // 3-day grace period for payment retries before treating as expired
        const graceMs = 3 * 24 * 60 * 60 * 1000;
        if (now.getTime() > endsAtDate.getTime() + graceMs) {
            effectiveStatus = 'expired';
        }
    }

    // User can access premium if:
    // 1. Active subscription (not past expiry + grace period)
    // 2. Trial not expired
    const canAccessPremium = effectiveStatus === 'active' || (effectiveStatus === 'trial' && !trialExpired);

    return {
        status: effectiveStatus,
        provider,
        plan,
        endsAt,
        trialDaysRemaining,
        isTrialExpired: trialExpired,
        canAccessPremium,
    };
}

// Create checkout session
export async function createCheckout(options: CheckoutOptions): Promise<{ url: string } | { error: string }> {
    const { provider, ...rest } = options;
    const endpoint = provider === 'stripe'
        ? '/api/payments/stripe-checkout'
        : '/api/payments/lemonsqueezy-checkout';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rest),
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.error || 'Failed to create checkout' };
        }

        return { url: data.url };
    } catch (error) {
        console.error('Checkout error:', error);
        return { error: 'Network error. Please try again.' };
    }
}

// Open Stripe Customer Portal
export async function openStripePortal(customerId: string): Promise<{ url: string } | { error: string }> {
    try {
        const response = await fetch('/api/payments/stripe-portal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId }),
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: data.error || 'Failed to open portal' };
        }

        return { url: data.url };
    } catch (error) {
        console.error('Portal error:', error);
        return { error: 'Network error. Please try again.' };
    }
}

// Lemon Squeezy doesn't have a portal API - users manage via email links
export function getLemonSqueezyPortalUrl(): string {
    return 'https://app.lemonsqueezy.com/my-orders';
}
