import React, { useEffect, useState } from 'react';
import { useShopify } from '../contexts/ShopifyContext';
import { ShopifyProduct, isValidProductId } from '../services/shopifyService';
import { SupplementRecommendation } from '../services/supplementService';
import ShopIcon from './icons/ShopIcon';

interface SupplementRecommendationCardProps {
    recommendation: SupplementRecommendation;
}

const SupplementRecommendationCard: React.FC<SupplementRecommendationCardProps> = ({ recommendation }) => {
    const { addToCart, isLoading, getProduct } = useShopify();
    const [product, setProduct] = useState<ShopifyProduct | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);
    // RALPH LOOP 19: Track load errors for user feedback
    const [loadError, setLoadError] = useState(false);

    // Check if product ID is valid
    const hasValidProductId = isValidProductId(recommendation.shopifyProductId);

    // RALPH LOOP 12: Fixed memory leak with cleanup function
    useEffect(() => {
        let isMounted = true;

        const loadProduct = async () => {
            // Skip loading if product ID is missing or invalid
            if (!hasValidProductId) {
                if (isMounted) setLoadingProduct(false);
                return;
            }

            try {
                // RALPH LOOP 13: Use cached product from context if available
                const cachedProduct = getProduct?.(recommendation.shopifyProductId);
                if (cachedProduct) {
                    if (isMounted) {
                        setProduct(cachedProduct);
                        setLoadingProduct(false);
                    }
                    return;
                }

                const { fetchProduct } = await import('../services/shopifyService');
                const response = await fetchProduct(recommendation.shopifyProductId);
                // RALPH LOOP 12: Check if still mounted before setting state
                if (isMounted) {
                    if (response.data) {
                        setProduct(response.data);
                    } else if (response.error) {
                        // RALPH LOOP 19: Track error for user feedback
                        setLoadError(true);
                    }
                }
            } catch {
                // RALPH LOOP 19: Track error for user feedback
                if (isMounted) setLoadError(true);
            } finally {
                // RALPH LOOP 12: Check if still mounted
                if (isMounted) setLoadingProduct(false);
            }
        };

        loadProduct();

        // RALPH LOOP 12: Cleanup function to prevent setState on unmounted component
        return () => {
            isMounted = false;
        };
    }, [recommendation.shopifyProductId, hasValidProductId, getProduct]);

    const handleAddToCart = async () => {
        if (!product || !product.variants || product.variants.length === 0) return;

        const defaultVariant = product.variants[0];
        await addToCart(defaultVariant.id, 1);
    };

    const price = product?.variants?.[0]?.price?.amount || null;
    const image = product?.images?.[0]?.src || null;

    // RALPH LOOP 14: Badge aria-label for screen readers
    const badgeLabel = recommendation.isUserSelected
        ? 'From your supplement stack'
        : 'AI suggested supplement';

    if (loadingProduct) {
        return (
            // RALPH LOOP 14: Added aria-label for loading state
            <div className="card animate-pulse p-4" aria-label={`Loading ${recommendation.name} details`} role="status">
                {/* RALPH LOOP 25: Responsive sizing for mobile */}
                <div className="flex gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-800 rounded-lg flex-shrink-0"></div>
                    <div className="flex-1">
                        <div className="bg-gray-800 h-5 rounded w-3/4 mb-2"></div>
                        <div className="bg-gray-800 h-4 rounded w-full mb-1"></div>
                        <div className="bg-gray-800 h-4 rounded w-2/3"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        // RALPH LOOP 14: Added aria-label for the card
        <article
            className="card group p-4 hover:border-[var(--color-primary)]/50 transition-colors"
            aria-label={`${recommendation.name} supplement recommendation`}
        >
            {/* Source Badge - RALPH LOOP 14: Added aria-label */}
            <div className="flex justify-end mb-2">
                {recommendation.isUserSelected ? (
                    <span
                        className="text-xs px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] rounded-full flex items-center gap-1"
                        aria-label={badgeLabel}
                        role="status"
                    >
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">check_circle</span>
                        Your Stack
                    </span>
                ) : (
                    <span
                        className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1"
                        aria-label={badgeLabel}
                        role="status"
                    >
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">auto_awesome</span>
                        AI Suggested
                    </span>
                )}
            </div>

            <div className="flex gap-4">
                {/* Product Image or Icon - RALPH LOOP 25: Responsive sizing */}
                {image ? (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                            src={image}
                            alt={recommendation.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-2xl sm:text-3xl text-[var(--color-primary)]" aria-hidden="true">
                            {recommendation.icon}
                        </span>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-sm mb-2 truncate">{recommendation.name}</h4>

                    {/* Dosage Info */}
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-gray-300">
                            <span className="material-symbols-outlined text-sm text-[var(--color-primary)]" aria-hidden="true">straighten</span>
                            <span>Dosage: {recommendation.dosage}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="material-symbols-outlined text-sm text-gray-500" aria-hidden="true">schedule</span>
                            <span>Timing: {recommendation.timing}</span>
                        </div>
                        <div className="flex items-start gap-2 text-gray-400">
                            <span className="material-symbols-outlined text-sm text-[var(--color-primary)]" aria-hidden="true">auto_awesome</span>
                            <span className="line-clamp-2">{recommendation.personalBenefit}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RALPH LOOP 19: Show error message if product load failed */}
            {loadError && (
                <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">info</span>
                    <span>Product details unavailable</span>
                </div>
            )}

            {/* Add to Cart Button - Only show if product ID is valid and product loaded */}
            {/* RALPH LOOP 14: Added aria-label with product name */}
            {hasValidProductId && product && product.availableForSale && (
                <button
                    onClick={handleAddToCart}
                    disabled={isLoading}
                    aria-label={`Add ${recommendation.name} to cart${price ? ` for $${price}` : ''}`}
                    className="w-full mt-4 btn-secondary text-sm py-2 min-h-[44px] flex items-center justify-center gap-2 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-all"
                >
                    <ShopIcon className="w-4 h-4" aria-hidden="true" />
                    {isLoading ? 'Adding...' : `Add to Cart${price ? ` - $${price}` : ''}`}
                </button>
            )}
        </article>
    );
};

export default SupplementRecommendationCard;
