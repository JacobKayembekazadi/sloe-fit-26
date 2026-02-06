/**
 * Supplement Service - Dosage Recommendations
 *
 * Provides personalized supplement dosage recommendations based on user goals.
 */

import { PRODUCT_IDS } from './shopifyService';

// ============================================================================
// Types
// ============================================================================

export interface SupplementDefinition {
  id: string;
  name: string;
  shopifyProductId: string;
  dosage: string;
  timing: string;
  benefit: string;
  icon: string;
  goalBenefits: Record<string, string>;
}

export interface SupplementRecommendation extends SupplementDefinition {
  personalBenefit: string;
}

// ============================================================================
// Supplement Catalog
// ============================================================================

export const SUPPLEMENT_CATALOG: SupplementDefinition[] = [
  {
    id: 'creatine',
    name: 'Creatine Monohydrate',
    shopifyProductId: PRODUCT_IDS.CREATINE,
    dosage: '5g daily',
    timing: 'Any consistent time',
    benefit: 'Strength & muscle recovery',
    icon: 'fitness_center',
    goalBenefits: {
      CUT: 'Preserve muscle mass during caloric deficit',
      BULK: 'Maximize strength and size gains',
      RECOMP: 'Support muscle building while leaning out',
      MAINTAIN: 'Maintain strength and performance'
    }
  },
  {
    id: 'pre_workout',
    name: 'Pre-Workout',
    shopifyProductId: PRODUCT_IDS.PRE_WORKOUT,
    dosage: '1 scoop',
    timing: '15-30 min before training',
    benefit: 'Energy & focus for training',
    icon: 'bolt',
    goalBenefits: {
      CUT: 'Maintain workout intensity during deficit',
      BULK: 'Push through high-volume sessions',
      RECOMP: 'Fuel intense training sessions',
      MAINTAIN: 'Consistent energy for workouts'
    }
  }
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Get personalized supplement recommendations based on user goal
 */
export function getRecommendations(userGoal: string | null): SupplementRecommendation[] {
  const goal = userGoal?.toUpperCase() || '';

  return SUPPLEMENT_CATALOG.map(supp => ({
    ...supp,
    personalBenefit: supp.goalBenefits[goal] || supp.benefit
  }));
}

/**
 * Get a single supplement recommendation by ID
 */
export function getSupplementById(id: string, userGoal: string | null): SupplementRecommendation | null {
  const supplement = SUPPLEMENT_CATALOG.find(s => s.id === id);
  if (!supplement) return null;

  const goal = userGoal?.toUpperCase() || '';
  return {
    ...supplement,
    personalBenefit: supplement.goalBenefits[goal] || supplement.benefit
  };
}
