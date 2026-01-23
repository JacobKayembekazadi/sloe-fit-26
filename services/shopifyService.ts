import Client from '@shopify/buy-button-js';

// Shopify Store Configuration
const SHOPIFY_CONFIG = {
    domain: 'sloe-fit.myshopify.com', // Replace with your actual Shopify store domain
    storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN || 'YOUR_STOREFRONT_ACCESS_TOKEN_HERE',
};

// Create Shopify client
let client: any = null;

export const initializeShopifyClient = () => {
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
    try {
        const shopifyClient = initializeShopifyClient();
        const product = await shopifyClient.product.fetch(productId);
        return product as ShopifyProduct;
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
};

// Fetch multiple products
export const fetchProducts = async (productIds: string[]): Promise<ShopifyProduct[]> => {
    try {
        const shopifyClient = initializeShopifyClient();
        const productsPromises = productIds.map(id => shopifyClient.product.fetch(id));
        const products = await Promise.all(productsPromises);
        return products.filter(Boolean) as ShopifyProduct[];
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
};

// Create a checkout
export const createCheckout = async () => {
    try {
        const shopifyClient = initializeShopifyClient();
        const checkout = await shopifyClient.checkout.create();
        return checkout;
    } catch (error) {
        console.error('Error creating checkout:', error);
        return null;
    }
};

// Add line item to checkout
export const addToCart = async (checkoutId: string, variantId: string, quantity: number = 1) => {
    try {
        const shopifyClient = initializeShopifyClient();
        const lineItemsToAdd = [
            {
                variantId,
                quantity,
            },
        ];
        const checkout = await shopifyClient.checkout.addLineItems(checkoutId, lineItemsToAdd);
        return checkout;
    } catch (error) {
        console.error('Error adding to cart:', error);
        return null;
    }
};

// Remove line item from checkout
export const removeFromCart = async (checkoutId: string, lineItemId: string) => {
    try {
        const shopifyClient = initializeShopifyClient();
        const checkout = await shopifyClient.checkout.removeLineItems(checkoutId, [lineItemId]);
        return checkout;
    } catch (error) {
        console.error('Error removing from cart:', error);
        return null;
    }
};

// Update line item quantity
export const updateCartQuantity = async (checkoutId: string, lineItemId: string, quantity: number) => {
    try {
        const shopifyClient = initializeShopifyClient();
        const lineItemsToUpdate = [
            {
                id: lineItemId,
                quantity,
            },
        ];
        const checkout = await shopifyClient.checkout.updateLineItems(checkoutId, lineItemsToUpdate);
        return checkout;
    } catch (error) {
        console.error('Error updating cart:', error);
        return null;
    }
};

// Get checkout URL for completing purchase
export const getCheckoutUrl = (checkout: any): string => {
    return checkout.webUrl;
};
