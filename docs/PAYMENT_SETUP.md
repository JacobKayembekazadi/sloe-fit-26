# Payment Integration Setup Guide

> **Last Updated:** 2026-02-13

This guide covers setting up Stripe and/or Lemon Squeezy for subscription billing.

---

## Quick Start (Stripe)

### 1. Run Database Migration

In Supabase SQL Editor, run:
```sql
-- Copy contents of: supabase/migrations/20260213_payment_providers.sql
```

### 2. Create Stripe Products

Via [Stripe Dashboard](https://dashboard.stripe.com/products):

| Product | Price | Billing |
|---------|-------|---------|
| Sloe Fit Monthly | $9.99 | Monthly |
| Sloe Fit Annual | $79.99 | Yearly |
| Sloe Fit Trainer | $29.99 | Monthly |

Or via CLI:
```bash
stripe products create --name="Sloe Fit Monthly"
stripe prices create --product="Sloe Fit Monthly" --unit-amount=999 --currency=usd --recurring[interval]=month
```

### 3. Create Webhook

In [Stripe Webhooks](https://dashboard.stripe.com/webhooks):

- **URL**: `https://sloe-fit-26.vercel.app/api/payments/stripe-webhook`
- **Events**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

### 4. Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Source |
|----------|-------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | [API Keys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Webhook endpoint |
| `STRIPE_PRICE_MONTHLY` | `price_...` | Product > Prices |
| `STRIPE_PRICE_ANNUAL` | `price_...` | Product > Prices |
| `STRIPE_PRICE_TRAINER` | `price_...` | Product > Prices |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase > Settings > API |

### 5. Deploy

```bash
git push origin main
```

---

## Lemon Squeezy Setup (Alternative)

### 1. Create Products

In [Lemon Squeezy Dashboard](https://app.lemonsqueezy.com):

1. Create Store (if not exists)
2. Add 3 Products with subscription pricing
3. Note the Variant IDs

### 2. Create Webhook

In Store Settings → Webhooks:

- **URL**: `https://sloe-fit-26.vercel.app/api/payments/lemonsqueezy-webhook`
- **Events**: `subscription_created`, `subscription_updated`, `subscription_cancelled`

### 3. Add Environment Variables

| Variable | Value |
|----------|-------|
| `LEMONSQUEEZY_API_KEY` | From Settings → API |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | From webhook creation |
| `LEMONSQUEEZY_STORE_ID` | From Store URL |
| `LEMONSQUEEZY_VARIANT_MONTHLY` | From Product |
| `LEMONSQUEEZY_VARIANT_ANNUAL` | From Product |
| `LEMONSQUEEZY_VARIANT_TRAINER` | From Product |

---

## Usage in Code

### Show Paywall

```tsx
import PaywallModal from './components/PaywallModal';
import { useSubscription, PREMIUM_FEATURES } from './hooks/useSubscription';

function MyComponent() {
    const { subscription, showPaywall, setShowPaywall, requireSubscription } =
        useSubscription({ userProfile: profile });

    const handlePremiumAction = () => {
        if (!requireSubscription(PREMIUM_FEATURES.AI_WORKOUTS)) {
            return; // Paywall shows automatically
        }
        // User has access, proceed...
    };

    return (
        <>
            <button onClick={handlePremiumAction}>Start AI Workout</button>
            <PaywallModal
                isOpen={showPaywall}
                onClose={() => setShowPaywall(false)}
                trialDaysRemaining={subscription.trialDaysRemaining}
            />
        </>
    );
}
```

### Check Subscription Status

```tsx
const { subscription } = useSubscription({ userProfile });

if (subscription.canAccessPremium) {
    // User is active subscriber or in trial
}

if (subscription.isTrialExpired) {
    // Trial ended, needs to subscribe
}

subscription.trialDaysRemaining // 0-7
subscription.status // 'trial' | 'active' | 'expired' | 'none'
subscription.provider // 'stripe' | 'lemonsqueezy' | null
```

---

## Testing

### Local Webhook Testing

```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Forward Stripe events
stripe listen --forward-to localhost:3000/api/payments/stripe-webhook
```

### Test Cards

| Scenario | Card Number |
|----------|-------------|
| Success | 4242 4242 4242 4242 |
| Decline | 4000 0000 0000 0002 |
| 3D Secure | 4000 0025 0000 3155 |

---

## Pricing Config

Edit `services/paymentService.ts` to change pricing:

```typescript
export const PRICING = {
    monthly: { price: 9.99, label: 'Monthly', ... },
    annual: { price: 79.99, label: 'Annual', ... },
    trainer: { price: 29.99, label: 'Trainer', ... },
};
```

---

## Troubleshooting

### Webhook not receiving events
- Check webhook URL is correct (no trailing slash)
- Verify signing secret matches
- Check Vercel function logs

### Subscription not updating
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Check webhook handler logs in Vercel

### Customer portal not working
- Enable Customer Portal in Stripe Dashboard
- Set return URL in portal settings
