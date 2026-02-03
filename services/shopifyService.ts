import Client from '@shopify/buy-button-js';

// Shopify Store Configuration
const SHOPIFY_CONFIG = {
    domain: import.meta.env.VITE_SHOPIFY_STORE_DOMAIN || 'sloe-fit.myshopify.com',
    storefrontAccessToken: import.meta.env.VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN || '',
};

// Create Shopify client
let client: any = null;

export const isShopifyConfigured = () => {
    return Boolean(SHOPIFY_CONFIG.storefrontAccessToken);
};

export const initializeShopifyClient = () => {
    if (!isShopifyConfigured()) {
        return null;
    }
    if (!client) {
        client = Client.buildClient({
            domain: SHOPIFY_CONFIG.domain,
            storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken,
        });
    }
    return client;
};

// Product IDs (you'll need to get these from your Shopify admin)
export const PRODUCT_IDS = {
    CREATINE: 'YOUR_CREATINE_PRODUCT_ID',
    PRE_WORKOUT: 'YOUR_PRE_WORKOUT_PRODUCT_ID',
};

export interface ShopifyProduct {
    id: string;
    title: string;
    description: string;
    variants: any[];
    images: any[];
    availableForSale: boolean;
}

// Fetch product by ID
export const fetchProduct = async (productId: string): Promise<ShopifyProduct | null> => {
    const shopifyClient = initializeShopifyClient();
    if (!shopifyClient) return null;

    try {
        const product = await shopifyClient.product.fetch(productId);
        return product as ShopifyProduct;
    } catch (error) {
                return null;
    }
};

// Fetch multiple products
export const fetchProducts = async (productIds: string[]): Promise<ShopifyProduct[]> => {
    const shopifyClient = initializeShopifyClient();
    if (!shopifyClient) return [];

    try {
        const productsPromises = productIds.map(id => shopifyClient.product.fetch(id));
        const products = await Promise.all(productsPromises);
        return products.filter(Boolean) as ShopifyProduct[];
    } catch (error) {
                return [];
    }
};

// Create a checkout
export const createCheckout = async () => {
    const shopifyClient = initializeShopifyClient();
    if (!shopifyClient) return null;

    try {
        const checkout = await shopifyClient.checkout.create();
        return checkout;
    } catch (error) {
                return null;
    }
};

// Add line item to checkout
export const addToCart = async (checkoutId: string, variantId: string, quantity: number = 1) => {
    const shopifyClient = initializeShopifyClient();
    if (!shopifyClient) return null;

    try {
        const lineItemsToAdd = [
            {
                variantId,
                quantity,
            },
        ];
        const checkout = await shopifyClient.checkout.addLineItems(checkoutId, lineItemsToAdd);
        return checkout;
    } catch (error) {
                return null;
    }
};

// Remove line item from checkout
export const removeFromCart = async (checkoutId: string, lineItemId: string) => {
    const shopifyClient = initializeShopifyClient();
    if (!shopifyClient) return null;

    try {
        const checkout = await shopifyClient.checkout.removeLineItems(checkoutId, [lineItemId]);
        return checkout;
    } catch (error) {
                return null;
    }
};

// Update line item quantity
export const updateCartQuantity = async (checkoutId: string, lineItemId: string, quantity: number) => {
    const shopifyClient = initializeShopifyClient();
    if (!shopifyClient) return null;

    try {
        const lineItemsToUpdate = [
            {
                id: lineItemId,
                quantity,
            },
        ];
        const checkout = await shopifyClient.checkout.updateLineItems(checkoutId, lineItemsToUpdate);
        return checkout;
    } catch (error) {
                return null;
    }
};

// Get checkout URL for completing purchase
export const getCheckoutUrl = (checkout: any): string => {
    return checkout.webUrl;
};
