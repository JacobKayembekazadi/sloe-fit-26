import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createCheckout, addToCart as addToCartService, removeFromCart, updateCartQuantity, getCheckoutUrl, initializeShopifyClient } from '../services/shopifyService';

interface ShopifyContextType {
    checkout: any | null;
    isLoading: boolean;
    addToCart: (variantId: string, quantity?: number) => Promise<void>;
    removeLineItem: (lineItemId: string) => Promise<void>;
    updateQuantity: (lineItemId: string, quantity: number) => Promise<void>;
    getCartURL: () => string;
    lineItemsCount: number;
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
                const newCheckout = await createCheckout();
                setCheckout(newCheckout);

                if (newCheckout) {
                    localStorage.setItem('shopify_checkout_id', newCheckout.id);
                }
            } catch (error) {
                console.error('Failed to initialize checkout:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initCheckout();
    }, []);

    const addToCart = async (variantId: string, quantity: number = 1) => {
        if (!checkout) return;

        try {
            setIsLoading(true);
            const updatedCheckout = await addToCartService(checkout.id, variantId, quantity);
            if (updatedCheckout) {
                setCheckout(updatedCheckout);
            }
        } catch (error) {
            console.error('Failed to add to cart:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const removeLineItem = async (lineItemId: string) => {
        if (!checkout) return;

        try {
            setIsLoading(true);
            const updatedCheckout = await removeFromCart(checkout.id, lineItemId);
            if (updatedCheckout) {
                setCheckout(updatedCheckout);
            }
        } catch (error) {
            console.error('Failed to remove from cart:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateQuantity = async (lineItemId: string, quantity: number) => {
        if (!checkout) return;

        try {
            setIsLoading(true);
            const updatedCheckout = await updateCartQuantity(checkout.id, lineItemId, quantity);
            if (updatedCheckout) {
                setCheckout(updatedCheckout);
            }
        } catch (error) {
            console.error('Failed to update quantity:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getCartURL = (): string => {
        if (!checkout) return '';
        return getCheckoutUrl(checkout);
    };

    const lineItemsCount = checkout?.lineItems?.reduce((total: number, item: any) => total + item.quantity, 0) || 0;

    const value: ShopifyContextType = {
        checkout,
        isLoading,
        addToCart,
        removeLineItem,
        updateQuantity,
        getCartURL,
        lineItemsCount,
    };

    return <ShopifyContext.Provider value={value}>{children}</ShopifyContext.Provider>;
};
