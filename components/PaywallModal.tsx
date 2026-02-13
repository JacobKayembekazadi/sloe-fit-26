import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
    createCheckout,
    PRICING,
    type SubscriptionPlan,
    type PaymentProvider,
} from '../services/paymentService';

interface PaywallModalProps {
    isOpen: boolean;
    onClose: () => void;
    trialDaysRemaining?: number;
    feature?: string; // e.g., "AI Workouts" - what they tried to access
}

const PaywallModal: React.FC<PaywallModalProps> = ({
    isOpen,
    onClose,
    trialDaysRemaining = 0,
    feature,
}) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('monthly');
    const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('stripe');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleCheckout = async () => {
        if (!user?.id || !user?.email) {
            showToast('Please log in to subscribe', 'error');
            return;
        }

        setIsLoading(true);

        const result = await createCheckout({
            userId: user.id,
            email: user.email,
            plan: selectedPlan,
            provider: selectedProvider,
        });

        setIsLoading(false);

        if ('error' in result) {
            showToast(result.error, 'error');
            return;
        }

        // Redirect to checkout
        window.location.href = result.url;
    };

    const plans: SubscriptionPlan[] = ['monthly', 'annual', 'trainer'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[var(--bg-card)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/10">
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">
                            {trialDaysRemaining > 0
                                ? `${trialDaysRemaining} Days Left in Trial`
                                : 'Upgrade to Premium'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    {feature && (
                        <p className="text-gray-400 mt-2">
                            Subscribe to access <span className="text-[var(--color-primary)]">{feature}</span>
                        </p>
                    )}
                </div>

                {/* Plans */}
                <div className="p-6 space-y-4">
                    {plans.map((plan) => {
                        const pricing = PRICING[plan];
                        const isSelected = selectedPlan === plan;
                        const isBestValue = plan === 'annual';

                        return (
                            <button
                                key={plan}
                                onClick={() => setSelectedPlan(plan)}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all relative ${
                                    isSelected
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                        : 'border-white/10 hover:border-white/30'
                                }`}
                            >
                                {isBestValue && (
                                    <span className="absolute -top-3 right-4 bg-[var(--color-primary)] text-black text-xs font-bold px-2 py-1 rounded-full">
                                        BEST VALUE
                                    </span>
                                )}

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{pricing.label}</h3>
                                        <p className="text-sm text-gray-400">{pricing.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-white">${pricing.price}</p>
                                        {'pricePerMonth' in pricing && (
                                            <p className="text-xs text-gray-400">${pricing.pricePerMonth}/mo</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {pricing.features.map((feature, i) => (
                                        <span
                                            key={i}
                                            className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded"
                                        >
                                            {feature}
                                        </span>
                                    ))}
                                </div>

                                {/* Selection indicator */}
                                <div className="absolute top-4 right-4">
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                            isSelected
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                                                : 'border-gray-500'
                                        }`}
                                    >
                                        {isSelected && (
                                            <span className="material-symbols-outlined text-black text-sm">check</span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Payment Provider Toggle */}
                <div className="px-6 pb-4">
                    <p className="text-sm text-gray-400 mb-2">Payment method:</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedProvider('stripe')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                selectedProvider === 'stripe'
                                    ? 'bg-[var(--color-primary)] text-black'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            💳 Card (Stripe)
                        </button>
                        <button
                            onClick={() => setSelectedProvider('lemonsqueezy')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                selectedProvider === 'lemonsqueezy'
                                    ? 'bg-[var(--color-primary)] text-black'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            🍋 Lemon Squeezy
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        {selectedProvider === 'stripe'
                            ? 'Secure card payments via Stripe'
                            : 'Tax-inclusive pricing via Lemon Squeezy (PayPal available)'}
                    </p>
                </div>

                {/* CTA */}
                <div className="p-6 border-t border-white/10">
                    <button
                        onClick={handleCheckout}
                        disabled={isLoading}
                        className="w-full py-4 bg-[var(--color-primary)] text-black font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined animate-spin">refresh</span>
                                Processing...
                            </span>
                        ) : (
                            `Subscribe - $${PRICING[selectedPlan].price}/${selectedPlan === 'annual' ? 'year' : 'month'}`
                        )}
                    </button>

                    <p className="text-center text-xs text-gray-500 mt-4">
                        Cancel anytime. 30-day money-back guarantee.
                    </p>
                </div>

                {/* Trust badges */}
                <div className="px-6 pb-6">
                    <div className="flex items-center justify-center gap-4 text-gray-500 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">lock</span>
                            Secure
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">verified</span>
                            Encrypted
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">support_agent</span>
                            24/7 Support
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaywallModal;
