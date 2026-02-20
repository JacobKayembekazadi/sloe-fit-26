import { createContext, useContext } from 'react';
import type { SubscriptionStatus } from '../services/paymentService';

interface SubscriptionContextType {
    subscription: SubscriptionStatus;
    requireSubscription: (feature?: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    subscription: {
        status: 'none',
        provider: null,
        plan: null,
        endsAt: null,
        trialDaysRemaining: 0,
        isTrialExpired: true,
        canAccessPremium: false,
    },
    requireSubscription: () => false,
});

export const useSubscriptionContext = () => useContext(SubscriptionContext);

export default SubscriptionContext;
