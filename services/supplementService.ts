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
  recommendedForGoals: string[]; // Goals where this supplement is recommended
}

export interface SupplementRecommendation extends SupplementDefinition {
  personalBenefit: string;
  isUserSelected: boolean; // true if user explicitly selected this, false if AI-recommended
}

export interface SupplementPreferences {
  enabled: boolean;
  products: string[]; // Array of supplement IDs user is taking
  openToRecommendations: boolean;
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
    recommendedForGoals: ['BULK', 'RECOMP'],
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
    recommendedForGoals: ['BULK', 'CUT', 'RECOMP'],
    goalBenefits: {
      CUT: 'Maintain workout intensity during deficit',
      BULK: 'Push through high-volume sessions',
      RECOMP: 'Fuel intense training sessions',
      MAINTAIN: 'Consistent energy for workouts'
    }
  },
  {
    id: 'whey_protein',
    name: 'Whey Protein',
    shopifyProductId: PRODUCT_IDS.WHEY_PROTEIN,
    dosage: '1-2 scoops (25-50g protein)',
    timing: 'Post-workout or between meals',
    benefit: 'Muscle recovery & protein intake',
    icon: 'nutrition',
    recommendedForGoals: ['BULK', 'CUT', 'RECOMP'],
    goalBenefits: {
      CUT: 'Preserve muscle while hitting protein goals on low calories',
      BULK: 'Convenient way to hit high protein targets for growth',
      RECOMP: 'Support muscle building with quality protein',
      MAINTAIN: 'Easy protein to maintain muscle mass'
    }
  },
  {
    id: 'fat_burner',
    name: 'Fat Burner',
    shopifyProductId: PRODUCT_IDS.FAT_BURNER,
    dosage: '1-2 capsules',
    timing: 'Morning with breakfast',
    benefit: 'Metabolic support & energy',
    icon: 'local_fire_department',
    recommendedForGoals: ['CUT'],
    goalBenefits: {
      CUT: 'Boost metabolism and energy during caloric deficit',
      BULK: 'Not typically needed during bulking phase',
      RECOMP: 'Can support fat loss phase of recomposition',
      MAINTAIN: 'Optional metabolic support'
    }
  },
  {
    id: 'alpha_male',
    name: 'Alpha Male',
    shopifyProductId: PRODUCT_IDS.ALPHA_MALE,
    dosage: 'As directed on label',
    timing: 'Morning with food',
    benefit: 'Natural testosterone support',
    icon: 'trending_up',
    recommendedForGoals: ['BULK', 'RECOMP'],
    goalBenefits: {
      CUT: 'Maintain hormone levels during deficit',
      BULK: 'Support natural testosterone for maximum gains',
      RECOMP: 'Optimize hormones for muscle building and fat loss',
      MAINTAIN: 'Keep testosterone levels optimized'
    }
  }
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Get personalized supplement recommendations based on user goal
 * @deprecated Use getSmartRecommendations instead for preference-aware recommendations
 */
export function getRecommendations(userGoal: string | null): SupplementRecommendation[] {
  const goal = userGoal?.toUpperCase() || '';

  return SUPPLEMENT_CATALOG.map(supp => ({
    ...supp,
    personalBenefit: supp.goalBenefits[goal] || supp.benefit,
    isUserSelected: false // Deprecated function, assume all are AI-recommended
  }));
}

/**
 * Get smart supplement recommendations based on user preferences and goal
 * Only returns supplements the user has opted into or that are recommended for their goal
 */
export function getSmartRecommendations(
  userGoal: string | null,
  preferences: SupplementPreferences | null
): SupplementRecommendation[] {
  // If supplements not enabled, return empty array
  if (!preferences?.enabled) {
    return [];
  }

  const goal = userGoal?.toUpperCase() || '';
  const userProducts = preferences.products || [];
  const openToRecs = preferences.openToRecommendations;

  // Filter supplements based on user preferences
  const filteredSupplements = SUPPLEMENT_CATALOG.filter(supp => {
    // Always include supplements user has explicitly selected
    if (userProducts.includes(supp.id)) {
      return true;
    }
    // If open to recommendations, include goal-based suggestions
    if (openToRecs && supp.recommendedForGoals.includes(goal)) {
      return true;
    }
    return false;
  });

  // Map to recommendations with personal benefits and track source
  return filteredSupplements.map(supp => ({
    ...supp,
    personalBenefit: supp.goalBenefits[goal] || supp.benefit,
    isUserSelected: userProducts.includes(supp.id)
  }));
}

/**
 * Get goal-based supplement recommendations (for AI prompts)
 * Returns supplements recommended for a specific goal
 */
export function getGoalBasedRecommendations(userGoal: string | null): SupplementRecommendation[] {
  const goal = userGoal?.toUpperCase() || '';

  return SUPPLEMENT_CATALOG
    .filter(supp => supp.recommendedForGoals.includes(goal))
    .map(supp => ({
      ...supp,
      personalBenefit: supp.goalBenefits[goal] || supp.benefit,
      isUserSelected: false // Goal-based are always AI-recommended
    }));
}

/**
 * Get a single supplement recommendation by ID
 */
export function getSupplementById(id: string, userGoal: string | null, userProducts: string[] = []): SupplementRecommendation | null {
  const supplement = SUPPLEMENT_CATALOG.find(s => s.id === id);
  if (!supplement) return null;

  const goal = userGoal?.toUpperCase() || '';
  return {
    ...supplement,
    personalBenefit: supplement.goalBenefits[goal] || supplement.benefit,
    isUserSelected: userProducts.includes(id)
  };
}

/**
 * Get all available supplements for selection UI
 */
export function getAllSupplements(): SupplementDefinition[] {
  return SUPPLEMENT_CATALOG;
}

/**
 * Build supplement context string for AI prompts
 * Returns empty string if user has no supplements enabled
 */
export function buildSupplementPromptContext(
  userGoal: string | null,
  preferences: SupplementPreferences | null
): string {
  if (!preferences?.enabled) {
    return ''; // No supplement section for users who opted out
  }

  const recommendations = getSmartRecommendations(userGoal, preferences);
  if (recommendations.length === 0) {
    return '';
  }

  const supplementList = recommendations
    .map(s => `- ${s.name}: ${s.dosage} (${s.timing}) - ${s.personalBenefit}`)
    .join('\n');

  return `
## USER'S SUPPLEMENT STACK
The user is taking the following supplements. Reference these naturally in your recommendations:
${supplementList}
`;
}
