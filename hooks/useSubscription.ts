import { useState, useCallback, useMemo } from 'react';
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
    }, [userProfile]);

    // Call this before allowing access to premium features
    // Returns true if user can access, false if paywall should show
    const requireSubscription = useCallback(
        (feature?: string): boolean => {
            if (subscription.canAccessPremium) {
                return true;
            }

            // Show paywall
            setPaywallFeature(feature || null);
            setShowPaywall(true);
            return false;
        },
        [subscription.canAccessPremium]
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
