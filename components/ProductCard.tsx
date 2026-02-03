import React, { useEffect, useState } from 'react';
import { useShopify } from '../contexts/ShopifyContext';
import { ShopifyProduct } from '../services/shopifyService';
import ShopIcon from './icons/ShopIcon';

interface ProductCardProps {
    productId: string;
    showDescription?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ productId, showDescription = true }) => {
    const { addToCart, isLoading } = useShopify();
    const [product, setProduct] = useState<ShopifyProduct | null>(null);
    const [loadingProduct, setLoadingProduct] = useState(true);

    useEffect(() => {
        const loadProduct = async () => {
            try {
                // Import the fetch function dynamically to avoid circular deps
                const { fetchProduct } = await import('../services/shopifyService');
                const data = await fetchProduct(productId);
                setProduct(data);
            } catch (error) {
            } finally {
                setLoadingProduct(false);
            }
        };

        loadProduct();
    }, [productId]);

    const handleAddToCart = async () => {
        if (!product || !product.variants || product.variants.length === 0) return;

        const defaultVariant = product.variants[0];
        await addToCart(defaultVariant.id, 1);
    };

    if (loadingProduct) {
        return (
            <div className="card animate-pulse">
                <div className="bg-gray-800 h-48 rounded-md mb-4"></div>
                <div className="bg-gray-800 h-6 rounded w-3/4 mb-2"></div>
                <div className="bg-gray-800 h-4 rounded w-full"></div>
            </div>
        );
    }

    if (!product) {
        return null; // Don't show anything if product fails to load
    }

    const defaultVariant = product.variants[0];
    const price = defaultVariant?.price || '0.00';
    const image = product.images[0]?.src || '';

    return (
        <div className="card group p-0 overflow-hidden hover:border-[var(--color-primary)]/50">
            {image && (
                <div className="aspect-square bg-gray-800 relative overflow-hidden">
                    <img
                        src={image}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold text-white">
                        ${price}
                    </div>
                </div>
            )}
            <div className="p-4">
                <h3 className="text-lg font-bold text-white mb-2 leading-tight">{product.title}</h3>

                {showDescription && product.description && (
                    <p className="text-gray-400 text-xs mb-4 line-clamp-2">{product.description}</p>
                )}

                <button
                    onClick={handleAddToCart}
                    disabled={isLoading || !product.availableForSale}
                    className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-all"
                >
                    <ShopIcon className="w-4 h-4" />
                    {isLoading ? 'Adding...' : 'Add to Cart'}
                </button>
            </div>
        </div>
    );
};

export default ProductCard;
