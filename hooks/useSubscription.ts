import { useState, useCallback, useMemo, useEffect } from 'react';
import { getSubscriptionStatus, type SubscriptionStatus } from '../services/paymentService';

interface UseSubscriptionProps {
    userProfile: {
        subscription_status?: string | null;
        subscription_provider?: string | null;
        subscription_plan?: string | null;
        subscription_ends_at?: string | null;
        trial_started_at?: string | null;
        stripe_customer_id?: string | null;
    } | null;
}

interface UseSubscriptionReturn {
    subscription: SubscriptionStatus;
    showPaywall: boolean;
    setShowPaywall: (show: boolean) => void;
    requireSubscription: (feature?: string) => boolean;
    paywallFeature: string | null;
}

export function useSubscription({ userProfile }: UseSubscriptionProps): UseSubscriptionReturn {
    const [showPaywall, setShowPaywall] = useState(false);
    const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

    // C5 FIX: Re-evaluate subscription every 60s so trial expiry is caught in long sessions
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(id);
    }, []);

    // M8 FIX: Use specific fields as deps instead of entire userProfile object reference
    const subscription = useMemo(() => {
        if (!userProfile) {
            return {
                status: 'none' as const,
                provider: null,
                plan: null,
                endsAt: null,
                trialDaysRemaining: 0,
                isTrialExpired: true,
                canAccessPremium: false,
            };
        }
        return getSubscriptionStatus(userProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        userProfile?.subscription_status,
        userProfile?.subscription_ends_at,
        userProfile?.trial_started_at,
        userProfile?.subscription_provider,
        userProfile?.subscription_plan,
        tick, // C5: forces re-evaluation every 60 seconds
    ]);

    // C5 FIX: requireSubscription always re-checks live status (not cached memo)
    const requireSubscription = useCallback(
        (feature?: string): boolean => {
            // Re-evaluate at point of use to catch time-based expiry
            const liveStatus = userProfile
                ? getSubscriptionStatus(userProfile)
                : { canAccessPremium: false };

            if (liveStatus.canAccessPremium) {
                return true;
            }

            // Show paywall
            setPaywallFeature(feature || null);
            setShowPaywall(true);
            return false;
        },
        [userProfile]
    );

    return {
        subscription,
        showPaywall,
        setShowPaywall,
        requireSubscription,
        paywallFeature,
    };
}

// List of features that require subscription
export const PREMIUM_FEATURES = {
    AI_WORKOUTS: 'AI Workout Generation',
    MEAL_PHOTO_ANALYSIS: 'Meal Photo Analysis',
    BODY_ANALYSIS: 'Body Analysis',
    WEEKLY_INSIGHTS: 'Weekly AI Insights',
    PROGRESS_COMPARISON: 'Progress Photo Comparison',
    TRAINER_DASHBOARD: 'Trainer Dashboard',
} as const;

export type PremiumFeature = keyof typeof PREMIUM_FEATURES;
