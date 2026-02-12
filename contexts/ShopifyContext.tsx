import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { createCheckout, addToCart as addToCartService, removeFromCart, updateCartQuantity, getCheckoutUrl, initializeShopifyClient, ShopifyProduct } from '../services/shopifyService';
import { reportError } from '../utils/sentryHelpers';

interface ShopifyContextType {
    checkout: any | null;
    isLoading: boolean;
    addToCart: (variantId: string, quantity?: number) => Promise<void>;
    removeLineItem: (lineItemId: string) => Promise<void>;
    updateQuantity: (lineItemId: string, quantity: number) => Promise<void>;
    getCartURL: () => string;
    lineItemsCount: number;
    // RALPH LOOP 13: Product caching to prevent N+1 API calls
    getProduct: (productId: string) => ShopifyProduct | undefined;
    cacheProduct: (productId: string, product: ShopifyProduct) => void;
}

const ShopifyContext = createContext<ShopifyContextType | undefined>(undefined);

export const useShopify = () => {
    const context = useContext(ShopifyContext);
    if (!context) {
        throw new Error('useShopify must be used within a ShopifyProvider');
    }
    return context;
};

interface ShopifyProviderProps {
    children: ReactNode;
}

export const ShopifyProvider: React.FC<ShopifyProviderProps> = ({ children }) => {
    const [checkout, setCheckout] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // RALPH LOOP 13: Product cache to prevent N+1 Shopify API calls
    // Using useRef to persist across renders without causing re-renders
    const productCacheRef = useRef<Map<string, ShopifyProduct>>(new Map());

    // RALPH LOOP 13: Get cached product
    const getProduct = useCallback((productId: string): ShopifyProduct | undefined => {
        return productCacheRef.current.get(productId);
    }, []);

    // RALPH LOOP 13: Cache a product after fetching
    const cacheProduct = useCallback((productId: string, product: ShopifyProduct): void => {
        productCacheRef.current.set(productId, product);
    }, []);

    // Initialize Shopify client and checkout on mount
    useEffect(() => {
        // Skip Shopify initialization in development to avoid CORS errors
        if (import.meta.env.DEV) {
            console.info('[Shopify] Disabled in development mode to avoid CORS issues');
            setIsLoading(false);
            return;
        }

        const initCheckout = async () => {
            try {
                initializeShopifyClient();

                // Check if we have a saved checkout ID in localStorage
                const savedCheckoutId = localStorage.getItem('shopify_checkout_id');

                if (savedCheckoutId) {
                    // TODO: Fetch existing checkout
                    // For now, create a new one
                }

                // Create new checkout
                const response = await createCheckout();
                if (response.data) {
                    setCheckout(response.data);
                    localStorage.setItem('shopify_checkout_id', response.data.id);
                }
            } catch (error) {
                reportError(error, {
                    category: 'payment',
                    operation: 'initCheckout',
                });
            } finally {
                setIsLoading(false);
            }
        };

        initCheckout();
    }, []);

    const addToCart = useCallback(async (variantId: string, quantity: number = 1) => {
        if (!checkout) return;

        try {
            setIsLoading(true);
            const response = await addToCartService(checkout.id, variantId, quantity);
            if (response.data) {
                setCheckout(response.data);
            }
        } catch (error) {
            reportError(error, {
                category: 'payment',
                operation: 'addToCart',
                context: { variantId, quantity },
            });
        } finally {
            setIsLoading(false);
        }
    }, [checkout]);

    const removeLineItem = useCallback(async (lineItemId: string) => {
        if (!checkout) return;

        try {
            setIsLoading(true);
            const response = await removeFromCart(checkout.id, lineItemId);
            if (response.data) {
                setCheckout(response.data);
            }
        } catch (error) {
            reportError(error, {
                category: 'payment',
                operation: 'removeFromCart',
                context: { lineItemId },
            });
        } finally {
            setIsLoading(false);
        }
    }, [checkout]);

    const updateQuantity = useCallback(async (lineItemId: string, quantity: number) => {
        if (!checkout) return;

        try {
            setIsLoading(true);
            const response = await updateCartQuantity(checkout.id, lineItemId, quantity);
            if (response.data) {
                setCheckout(response.data);
            }
        } catch (error) {
            reportError(error, {
                category: 'payment',
                operation: 'updateQuantity',
                context: { lineItemId, quantity },
            });
        } finally {
            setIsLoading(false);
        }
    }, [checkout]);

    const getCartURL = useCallback((): string => {
        if (!checkout) return '';
        return getCheckoutUrl(checkout);
    }, [checkout]);

    const lineItemsCount = checkout?.lineItems?.reduce((total: number, item: any) => total + item.quantity, 0) || 0;

    const value: ShopifyContextType = {
        checkout,
        isLoading,
        addToCart,
        removeLineItem,
        updateQuantity,
        getCartURL,
        lineItemsCount,
        // RALPH LOOP 13: Expose product cache methods
        getProduct,
        cacheProduct,
    };

    return <ShopifyContext.Provider value={value}>{children}</ShopifyContext.Provider>;
};
