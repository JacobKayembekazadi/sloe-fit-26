/**
 * Product Recommendations — Maps coaching contexts to Shopify product keys
 *
 * Uses PRODUCT_IDS from services/shopifyService.ts for Shopify GIDs.
 */

import { PRODUCT_IDS, isValidProductId } from '../services/shopifyService';

const STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN || 'sloe-fit.com';

// ============================================================================
// Product Mapping
// ============================================================================

/**
 * Maps coaching context keys to arrays of Shopify product keys.
 * First product in array is the primary recommendation.
 */
export const PRODUCT_MAP: Record<string, string[]> = {
  legs_recovery: ['CREATINE'],
  low_protein: ['WHEY_PROTEIN'],
  low_energy: ['PRE_WORKOUT'],
  fat_loss_plateau: ['FAT_BURNER'],
  general_recovery: ['CREATINE'],
  testosterone: ['ALPHA_MALE'],
  sleep_deficit: ['CREATINE'], // Future: SLEEP_STACK
  post_workout: ['CREATINE', 'WHEY_PROTEIN'],
};

/**
 * CTA labels per product context — short, King Kay voice
 */
export const PRODUCT_CTA_LABELS: Record<string, string> = {
  legs_recovery: 'Shop Recovery',
  low_protein: 'Shop Protein',
  low_energy: 'Shop Pre-Workout',
  fat_loss_plateau: 'Shop Fat Burner',
  general_recovery: 'Shop Recovery',
  testosterone: 'Shop Alpha Male',
  sleep_deficit: 'Shop Recovery',
  post_workout: 'Shop Recovery',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Maps product keys to their Shopify URL handles.
 * Falls back to /collections/all if handle is unknown.
 */
const PRODUCT_HANDLES: Record<string, string> = {
  CREATINE: 'creatine',
  PRE_WORKOUT: 'pre-workout',
  WHEY_PROTEIN: 'whey-protein',
  FAT_BURNER: 'fat-burner',
  ALPHA_MALE: 'alpha-male',
};

export interface ProductRecommendation {
  productKey: string;
  productId: string;
  ctaLabel: string;
  productUrl: string;
}

/**
 * Resolve a coaching context key to a Shopify product recommendation.
 * Returns null if no valid product ID is configured.
 */
export function getProductRecommendation(
  contextKey: string | undefined
): ProductRecommendation | null {
  if (!contextKey) return null;

  const productKeys = PRODUCT_MAP[contextKey];
  if (!productKeys || productKeys.length === 0) return null;

  // Find the first product that has a valid Shopify ID configured
  for (const key of productKeys) {
    const productId = PRODUCT_IDS[key as keyof typeof PRODUCT_IDS];
    if (isValidProductId(productId)) {
      const handle = PRODUCT_HANDLES[key];
      const productUrl = handle
        ? `https://${STORE_DOMAIN}/products/${handle}`
        : `https://${STORE_DOMAIN}/collections/all`;
      return {
        productKey: key,
        productId,
        ctaLabel: PRODUCT_CTA_LABELS[contextKey] || 'Shop Now',
        productUrl,
      };
    }
  }

  return null;
}
