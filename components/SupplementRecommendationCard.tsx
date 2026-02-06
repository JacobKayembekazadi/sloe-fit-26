import React, { useEffect, useState } from 'react';
import { useShopify } from '../contexts/ShopifyContext';
import { ShopifyProduct } from '../services/shopifyService';
import { SupplementRecommendation } from '../services/supplementService';
import ShopIcon from './icons/ShopIcon';

interface SupplementRecommendationCardProps {
    recommendation: SupplementRecommendation;
}

const SupplementRecommendationCard: React.FC<SupplementRecommendationCardProps> = ({ recommendation }) => {
    const { addToCart, isLoading } = useShopify();
    const [product, setProduct] = useState<ShopifyProduct | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);

    useEffect(() => {
        const loadProduct = async () => {
            if (!recommendation.shopifyProductId) {
                setLoadingProduct(false);
                return;
            }

            try {
                const { fetchProduct } = await import('../services/shopifyService');
                const response = await fetchProduct(recommendation.shopifyProductId);
                if (response.data) {
                    setProduct(response.data);
                }
            } catch {
                // Product failed to load - will show dosage info only
            } finally {
                setLoadingProduct(false);
            }
        };

        loadProduct();
    }, [recommendation.shopifyProductId]);

    const handleAddToCart = async () => {
        if (!product || !product.variants || product.variants.length === 0) return;

        const defaultVariant = product.variants[0];
        await addToCart(defaultVariant.id, 1);
    };

    const price = product?.variants?.[0]?.price?.amount || null;
    const image = product?.images?.[0]?.src || null;

    if (loadingProduct) {
        return (
            <div className="card animate-pulse p-4">
                <div className="flex gap-4">
                    <div className="w-20 h-20 bg-gray-800 rounded-lg flex-shrink-0"></div>
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
        <div className="card group p-4 hover:border-[var(--color-primary)]/50 transition-colors">
            <div className="flex gap-4">
                {/* Product Image or Icon */}
                {image ? (
                    <div className="w-20 h-20 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                            src={image}
                            alt={recommendation.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-20 h-20 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">
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
                            <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">straighten</span>
                            <span>{recommendation.dosage}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="material-symbols-outlined text-sm text-gray-500">schedule</span>
                            <span>{recommendation.timing}</span>
                        </div>
                        <div className="flex items-start gap-2 text-gray-400">
                            <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">auto_awesome</span>
                            <span className="line-clamp-2">{recommendation.personalBenefit}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add to Cart Button */}
            {product && product.availableForSale && (
                <button
                    onClick={handleAddToCart}
                    disabled={isLoading}
                    className="w-full mt-4 btn-secondary text-sm py-2 min-h-[44px] flex items-center justify-center gap-2 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-all"
                >
                    <ShopIcon className="w-4 h-4" />
                    {isLoading ? 'Adding...' : `Add to Cart${price ? ` - $${price}` : ''}`}
                </button>
            )}
        </div>
    );
};

export default SupplementRecommendationCard;
