/**
 * Shopify Service - E-commerce Integration
 *
 * Features:
 * - Structured error handling and logging
 * - Request timeout handling
 * - Retry logic for transient failures
 * - Type-safe interfaces
 * - Development mode logging
 */

import Client from '@shopify/buy-button-js';

// ============================================================================
// Types
// ============================================================================

export type ShopifyErrorType =
  | 'not_configured'
  | 'network'
  | 'timeout'
  | 'not_found'
  | 'validation'
  | 'server_error'
  | 'unknown';

export interface ShopifyError {
  type: ShopifyErrorType;
  message: string;
  code?: string;
  retryable: boolean;
  originalError?: unknown;
}

export interface ShopifyResponse<T> {
  data: T | null;
  error: ShopifyError | null;
}

export interface ShopifyProductImage {
  id: string;
  src: string;
  altText?: string;
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  handle: string;
  variants: ShopifyProductVariant[];
  images: ShopifyProductImage[];
  availableForSale: boolean;
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  variant: ShopifyProductVariant;
}

export interface ShopifyCheckout {
  id: string;
  webUrl: string;
  lineItems: ShopifyLineItem[];
  subtotalPrice: { amount: string; currencyCode: string };
  totalPrice: { amount: string; currencyCode: string };
  completedAt?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_MODE = import.meta.env.DEV;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1000;

const SHOPIFY_CONFIG = {
  domain: import.meta.env.VITE_SHOPIFY_STORE_DOMAIN || '',
  storefrontAccessToken: import.meta.env.VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN || '',
};

// Product IDs - Configure these in your Shopify admin
export const PRODUCT_IDS = {
  CREATINE: import.meta.env.VITE_SHOPIFY_CREATINE_ID || '',
  PRE_WORKOUT: import.meta.env.VITE_SHOPIFY_PRE_WORKOUT_ID || '',
};

// ============================================================================
// Logging
// ============================================================================

function logShopify(operation: string, message: string, data?: unknown) {
  if (DEBUG_MODE) {
    console.log(`[Shopify] ${operation}: ${message}`, data || '');
  }
}

function logShopifyError(operation: string, error: ShopifyError, originalError?: unknown) {
  if (DEBUG_MODE) {
    console.error(`[Shopify] ${operation} failed:`, {
      type: error.type,
      message: error.message,
      retryable: error.retryable,
      originalError,
    });
  }
}

// ============================================================================
// Client Management
// ============================================================================

interface ShopifyClient {
  product: {
    fetch: (id: string) => Promise<unknown>;
    fetchAll: () => Promise<unknown[]>;
  };
  checkout: {
    create: () => Promise<unknown>;
    fetch: (id: string) => Promise<unknown>;
    addLineItems: (checkoutId: string, lineItems: unknown[]) => Promise<unknown>;
    removeLineItems: (checkoutId: string, lineItemIds: string[]) => Promise<unknown>;
    updateLineItems: (checkoutId: string, lineItems: unknown[]) => Promise<unknown>;
  };
}

let client: ShopifyClient | null = null;

export const isShopifyConfigured = (): boolean => {
  const configured = Boolean(SHOPIFY_CONFIG.domain && SHOPIFY_CONFIG.storefrontAccessToken);
  if (!configured && DEBUG_MODE) {
    logShopify('Config', 'Shopify not configured - missing domain or access token');
  }
  return configured;
};

export const initializeShopifyClient = (): ShopifyClient | null => {
  if (!isShopifyConfigured()) {
    return null;
  }
  if (!client) {
    try {
      client = Client.buildClient({
        domain: SHOPIFY_CONFIG.domain,
        storefrontAccessToken: SHOPIFY_CONFIG.storefrontAccessToken,
      }) as ShopifyClient;
      logShopify('Init', 'Shopify client initialized successfully');
    } catch (error) {
      logShopifyError('Init', {
        type: 'unknown',
        message: 'Failed to initialize Shopify client',
        retryable: false,
      }, error);
      return null;
    }
  }
  return client;
};

// ============================================================================
// Error Classification
// ============================================================================

function classifyError(error: unknown): ShopifyError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network error - please check your connection',
      retryable: true,
      originalError: error,
    };
  }

  // Timeout/abort errors
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      type: 'timeout',
      message: 'Request timed out - please try again',
      retryable: true,
      originalError: error,
    };
  }

  // Shopify GraphQL errors
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // GraphQL error format
    if (Array.isArray(err.errors)) {
      const firstError = err.errors[0] as { message?: string; extensions?: { code?: string } };
      const code = firstError?.extensions?.code;

      if (code === 'NOT_FOUND') {
        return {
          type: 'not_found',
          message: 'Product or resource not found',
          code,
          retryable: false,
          originalError: error,
        };
      }

      if (code === 'INVALID') {
        return {
          type: 'validation',
          message: firstError?.message || 'Invalid request',
          code,
          retryable: false,
          originalError: error,
        };
      }
    }

    // Parse message if available
    if ('message' in err && typeof err.message === 'string') {
      return {
        type: 'unknown',
        message: err.message,
        retryable: false,
        originalError: error,
      };
    }
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    retryable: false,
    originalError: error,
  };
}

function createNotConfiguredError(): ShopifyError {
  return {
    type: 'not_configured',
    message: 'Shopify is not configured. Please add your store domain and access token.',
    retryable: false,
  };
}

// ============================================================================
// Retry Logic
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<ShopifyResponse<T>> {
  let lastError: ShopifyError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new DOMException('Timeout', 'AbortError')), REQUEST_TIMEOUT_MS);
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      logShopify(operation, 'Success', { attempt });
      return { data: result, error: null };

    } catch (error) {
      lastError = classifyError(error);
      logShopifyError(operation, lastError, error);

      if (lastError.retryable && attempt < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        logShopify(operation, `Retrying in ${delay}ms...`, { attempt: attempt + 1 });
        await sleep(delay);
        continue;
      }

      return { data: null, error: lastError };
    }
  }

  return { data: null, error: lastError || classifyError(new Error('Max retries exceeded')) };
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Fetch a single product by ID
 */
export const fetchProduct = async (productId: string): Promise<ShopifyResponse<ShopifyProduct>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  if (!productId) {
    return {
      data: null,
      error: {
        type: 'validation',
        message: 'Product ID is required',
        retryable: false,
      },
    };
  }

  return withRetry('fetchProduct', async () => {
    const product = await shopifyClient.product.fetch(productId);
    return product as ShopifyProduct;
  });
};

/**
 * Fetch multiple products by IDs
 */
export const fetchProducts = async (productIds: string[]): Promise<ShopifyResponse<ShopifyProduct[]>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  if (!productIds.length) {
    return { data: [], error: null };
  }

  return withRetry('fetchProducts', async () => {
    const productsPromises = productIds.map(id => shopifyClient.product.fetch(id));
    const products = await Promise.all(productsPromises);
    return products.filter(Boolean) as ShopifyProduct[];
  });
};

/**
 * Fetch all products from the store
 */
export const fetchAllProducts = async (): Promise<ShopifyResponse<ShopifyProduct[]>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  return withRetry('fetchAllProducts', async () => {
    const products = await shopifyClient.product.fetchAll();
    return products as ShopifyProduct[];
  });
};

/**
 * Create a new checkout session
 */
export const createCheckout = async (): Promise<ShopifyResponse<ShopifyCheckout>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  return withRetry('createCheckout', async () => {
    const checkout = await shopifyClient.checkout.create();
    return checkout as ShopifyCheckout;
  });
};

/**
 * Fetch an existing checkout by ID
 */
export const fetchCheckout = async (checkoutId: string): Promise<ShopifyResponse<ShopifyCheckout>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  if (!checkoutId) {
    return {
      data: null,
      error: {
        type: 'validation',
        message: 'Checkout ID is required',
        retryable: false,
      },
    };
  }

  return withRetry('fetchCheckout', async () => {
    const checkout = await shopifyClient.checkout.fetch(checkoutId);
    return checkout as ShopifyCheckout;
  });
};

/**
 * Add items to cart
 */
export const addToCart = async (
  checkoutId: string,
  variantId: string,
  quantity: number = 1
): Promise<ShopifyResponse<ShopifyCheckout>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  if (!checkoutId || !variantId) {
    return {
      data: null,
      error: {
        type: 'validation',
        message: 'Checkout ID and variant ID are required',
        retryable: false,
      },
    };
  }

  if (quantity < 1) {
    return {
      data: null,
      error: {
        type: 'validation',
        message: 'Quantity must be at least 1',
        retryable: false,
      },
    };
  }

  return withRetry('addToCart', async () => {
    const lineItemsToAdd = [{ variantId, quantity }];
    const checkout = await shopifyClient.checkout.addLineItems(checkoutId, lineItemsToAdd);
    return checkout as ShopifyCheckout;
  });
};

/**
 * Remove items from cart
 */
export const removeFromCart = async (
  checkoutId: string,
  lineItemId: string
): Promise<ShopifyResponse<ShopifyCheckout>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  if (!checkoutId || !lineItemId) {
    return {
      data: null,
      error: {
        type: 'validation',
        message: 'Checkout ID and line item ID are required',
        retryable: false,
      },
    };
  }

  return withRetry('removeFromCart', async () => {
    const checkout = await shopifyClient.checkout.removeLineItems(checkoutId, [lineItemId]);
    return checkout as ShopifyCheckout;
  });
};

/**
 * Update cart item quantity
 */
export const updateCartQuantity = async (
  checkoutId: string,
  lineItemId: string,
  quantity: number
): Promise<ShopifyResponse<ShopifyCheckout>> => {
  const shopifyClient = initializeShopifyClient();
  if (!shopifyClient) {
    return { data: null, error: createNotConfiguredError() };
  }

  if (!checkoutId || !lineItemId) {
    return {
      data: null,
      error: {
        type: 'validation',
        message: 'Checkout ID and line item ID are required',
        retryable: false,
      },
    };
  }

  if (quantity < 0) {
    return {
      data: null,
      error: {
        type: 'validation',
        message: 'Quantity cannot be negative',
        retryable: false,
      },
    };
  }

  return withRetry('updateCartQuantity', async () => {
    const lineItemsToUpdate = [{ id: lineItemId, quantity }];
    const checkout = await shopifyClient.checkout.updateLineItems(checkoutId, lineItemsToUpdate);
    return checkout as ShopifyCheckout;
  });
};

/**
 * Get checkout URL for completing purchase
 */
export const getCheckoutUrl = (checkout: ShopifyCheckout | null): string | null => {
  if (!checkout?.webUrl) {
    logShopify('getCheckoutUrl', 'No checkout URL available');
    return null;
  }
  return checkout.webUrl;
};

/**
 * Format price for display
 */
export const formatPrice = (amount: string, currencyCode: string = 'USD'): string => {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount)) {
    return amount;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(numericAmount);
};
