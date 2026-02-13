/**
 * USDA Integration Module
 *
 * Bridges AI food identification with deterministic USDA nutrition lookups.
 * Vision models identify foods → this module looks up real nutrition data.
 */

import { lookupFoodWithConfidence, extractMacrosFromUSDA, searchFood } from '../../services/nutritionService';
import type { MacroTotals } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Food identified by AI vision model
 */
export interface IdentifiedFood {
  name: string;           // "chicken breast"
  portion: string;        // "6oz", "1 cup", "medium"
  portionGrams?: number;  // 170 (AI may provide this)
  confidence: number;     // 0.0-1.0
}

/**
 * Food with nutrition data (after USDA lookup or fallback estimate)
 */
export interface FoodWithNutrition extends IdentifiedFood {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  source: 'usda' | 'estimate';  // Where macros came from
  fdcId?: number;               // USDA FDC ID if matched
  usdaDescription?: string;     // USDA's official food name
}

/**
 * Result of enriching foods with nutrition data
 */
export interface EnrichedFoodsResult {
  foods: FoodWithNutrition[];
  totals: MacroTotals;
  hasUSDAData: boolean;  // True if ANY food matched USDA
}

// ============================================================================
// Portion Parsing
// ============================================================================

/**
 * Common portion sizes in grams.
 * Used to convert portions like "6oz" or "1 cup" to grams.
 */
const PORTION_CONVERSIONS: Record<string, number> = {
  // Weight
  'oz': 28.35,
  'ounce': 28.35,
  'ounces': 28.35,
  'lb': 453.6,
  'pound': 453.6,
  'pounds': 453.6,
  'g': 1,
  'gram': 1,
  'grams': 1,

  // Volume (approximate for foods)
  'cup': 240,
  'cups': 240,
  'tbsp': 15,
  'tablespoon': 15,
  'tablespoons': 15,
  'tsp': 5,
  'teaspoon': 5,
  'teaspoons': 5,
  'ml': 1,
  'milliliter': 1,
  'milliliters': 1,

  // Generic sizes (protein portions)
  'small': 85,    // ~3oz
  'medium': 170,  // ~6oz
  'large': 255,   // ~9oz

  // Pieces (rough averages)
  'piece': 100,
  'pieces': 100,
  'slice': 30,
  'slices': 30,
};

/**
 * Default portion sizes by food category.
 * Fallback when AI doesn't provide portion info.
 */
const DEFAULT_PORTIONS: Record<string, number> = {
  // Proteins (grams)
  'chicken': 170,
  'beef': 170,
  'fish': 170,
  'salmon': 170,
  'tuna': 140,
  'steak': 200,
  'pork': 170,
  'shrimp': 115,
  'egg': 50,
  'tofu': 120,

  // Carbs
  'rice': 150,      // 1 cup cooked
  'pasta': 140,     // 1 cup cooked
  'bread': 30,      // 1 slice
  'potato': 150,    // 1 medium
  'oatmeal': 40,    // 1/2 cup dry

  // Vegetables
  'broccoli': 90,
  'spinach': 30,
  'salad': 100,
  'carrot': 60,
  'tomato': 120,

  // Fruits
  'apple': 180,
  'banana': 120,
  'orange': 130,
  'berries': 140,

  // Default for unknown
  'default': 100,
};

/**
 * Parse a portion string like "6oz" or "1 cup" into grams.
 */
export function parsePortionToGrams(portion: string, foodName: string): number {
  const normalized = portion.toLowerCase().trim();

  // Try to extract number + unit (e.g., "6oz", "1.5 cups", "2 slices")
  const match = normalized.match(/^([\d.]+)\s*(.+)$/);

  if (match) {
    const quantity = parseFloat(match[1]);
    const unit = match[2].trim();

    // Look up unit conversion
    const gramsPerUnit = PORTION_CONVERSIONS[unit];
    if (gramsPerUnit && !isNaN(quantity)) {
      return Math.round(quantity * gramsPerUnit);
    }
  }

  // Try just the unit (e.g., "medium", "large")
  const sizeGrams = PORTION_CONVERSIONS[normalized];
  if (sizeGrams) {
    return sizeGrams;
  }

  // Fall back to food-specific default
  const foodKey = Object.keys(DEFAULT_PORTIONS).find(key =>
    foodName.toLowerCase().includes(key)
  );
  return DEFAULT_PORTIONS[foodKey || 'default'];
}

// ============================================================================
// Food Name Normalization
// ============================================================================

/**
 * Normalize food names for better USDA matching.
 * Removes cooking methods, adjectives, etc.
 */
export function normalizeFoodName(name: string): string {
  // Common words to remove for better matching
  const wordsToRemove = [
    'grilled', 'fried', 'baked', 'roasted', 'steamed', 'sauteed', 'raw',
    'fresh', 'frozen', 'organic', 'homemade', 'restaurant-style',
    'crispy', 'tender', 'juicy', 'seasoned', 'marinated',
    'sliced', 'diced', 'chopped', 'shredded', 'whole',
    'with', 'and', 'the', 'a', 'an',
  ];

  let normalized = name.toLowerCase().trim();

  // Remove words
  for (const word of wordsToRemove) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  }

  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// ============================================================================
// Fallback Estimates
// ============================================================================

/**
 * Fallback nutrition estimates for common foods when USDA lookup fails.
 * Values are per 100g.
 */
const FALLBACK_ESTIMATES: Record<string, { cal: number; protein: number; carbs: number; fats: number }> = {
  // Proteins
  'chicken breast': { cal: 165, protein: 31, carbs: 0, fats: 3.6 },
  'chicken': { cal: 165, protein: 31, carbs: 0, fats: 3.6 },
  'beef': { cal: 250, protein: 26, carbs: 0, fats: 15 },
  'steak': { cal: 271, protein: 26, carbs: 0, fats: 18 },
  'salmon': { cal: 208, protein: 20, carbs: 0, fats: 13 },
  'fish': { cal: 180, protein: 24, carbs: 0, fats: 8 },
  'tuna': { cal: 132, protein: 28, carbs: 0, fats: 1 },
  'shrimp': { cal: 99, protein: 24, carbs: 0, fats: 0.3 },
  'egg': { cal: 155, protein: 13, carbs: 1, fats: 11 },
  'tofu': { cal: 76, protein: 8, carbs: 2, fats: 4 },
  'pork': { cal: 242, protein: 27, carbs: 0, fats: 14 },
  'turkey': { cal: 135, protein: 30, carbs: 0, fats: 1 },

  // Carbs
  'rice': { cal: 130, protein: 2.7, carbs: 28, fats: 0.3 },
  'white rice': { cal: 130, protein: 2.7, carbs: 28, fats: 0.3 },
  'brown rice': { cal: 111, protein: 2.6, carbs: 23, fats: 0.9 },
  'pasta': { cal: 131, protein: 5, carbs: 25, fats: 1.1 },
  'bread': { cal: 265, protein: 9, carbs: 49, fats: 3.2 },
  'potato': { cal: 77, protein: 2, carbs: 17, fats: 0.1 },
  'sweet potato': { cal: 86, protein: 1.6, carbs: 20, fats: 0.1 },
  'oatmeal': { cal: 68, protein: 2.5, carbs: 12, fats: 1.4 },

  // Vegetables
  'broccoli': { cal: 34, protein: 2.8, carbs: 7, fats: 0.4 },
  'spinach': { cal: 23, protein: 2.9, carbs: 3.6, fats: 0.4 },
  'salad': { cal: 20, protein: 1.5, carbs: 3, fats: 0.2 },
  'carrot': { cal: 41, protein: 0.9, carbs: 10, fats: 0.2 },
  'tomato': { cal: 18, protein: 0.9, carbs: 3.9, fats: 0.2 },
  'asparagus': { cal: 20, protein: 2.2, carbs: 3.9, fats: 0.1 },
  'green beans': { cal: 31, protein: 1.8, carbs: 7, fats: 0.1 },

  // Fruits
  'apple': { cal: 52, protein: 0.3, carbs: 14, fats: 0.2 },
  'banana': { cal: 89, protein: 1.1, carbs: 23, fats: 0.3 },
  'orange': { cal: 47, protein: 0.9, carbs: 12, fats: 0.1 },
  'berries': { cal: 57, protein: 0.7, carbs: 14, fats: 0.3 },
  'strawberry': { cal: 32, protein: 0.7, carbs: 7.7, fats: 0.3 },
  'blueberry': { cal: 57, protein: 0.7, carbs: 14, fats: 0.3 },

  // Dairy
  'milk': { cal: 42, protein: 3.4, carbs: 5, fats: 1 },
  'cheese': { cal: 402, protein: 25, carbs: 1.3, fats: 33 },
  'yogurt': { cal: 59, protein: 10, carbs: 3.6, fats: 0.7 },
  'greek yogurt': { cal: 59, protein: 10, carbs: 3.6, fats: 0.7 },

  // Fats/Oils
  'avocado': { cal: 160, protein: 2, carbs: 9, fats: 15 },
  'olive oil': { cal: 884, protein: 0, carbs: 0, fats: 100 },
  'butter': { cal: 717, protein: 0.9, carbs: 0.1, fats: 81 },
  'nuts': { cal: 607, protein: 20, carbs: 21, fats: 54 },
  'almonds': { cal: 579, protein: 21, carbs: 22, fats: 50 },
};

/**
 * Get fallback estimate for a food when USDA lookup fails.
 * Returns nutrition per 100g.
 */
function getFallbackEstimate(foodName: string): { cal: number; protein: number; carbs: number; fats: number } | null {
  const normalized = foodName.toLowerCase();

  // Try exact match first
  if (FALLBACK_ESTIMATES[normalized]) {
    return FALLBACK_ESTIMATES[normalized];
  }

  // Try partial match
  for (const [key, value] of Object.entries(FALLBACK_ESTIMATES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return null;
}

// ============================================================================
// Main USDA Lookup Functions
// ============================================================================

/**
 * Look up nutrition for a single identified food.
 * Tries USDA first, falls back to estimates.
 */
export async function lookupSingleFood(food: IdentifiedFood): Promise<FoodWithNutrition> {
  const portionGrams = food.portionGrams || parsePortionToGrams(food.portion, food.name);
  const normalizedName = normalizeFoodName(food.name);

  // Try USDA lookup
  try {
    const usdaResult = await lookupFoodWithConfidence(normalizedName, 0.6);

    if (usdaResult) {
      // USDA values are per 100g, scale by portion
      const scale = portionGrams / 100;

      return {
        ...food,
        portionGrams,
        calories: Math.round(usdaResult.calories * scale),
        protein: Math.round(usdaResult.protein * scale),
        carbs: Math.round(usdaResult.carbs * scale),
        fats: Math.round(usdaResult.fats * scale),
        source: 'usda',
        fdcId: usdaResult.fdcId,
        usdaDescription: usdaResult.description,
      };
    }
  } catch (error) {
    console.warn('[usdaIntegration] USDA lookup failed for:', normalizedName, error);
  }

  // Fall back to estimates
  const estimate = getFallbackEstimate(normalizedName);

  if (estimate) {
    const scale = portionGrams / 100;
    return {
      ...food,
      portionGrams,
      calories: Math.round(estimate.cal * scale),
      protein: Math.round(estimate.protein * scale),
      carbs: Math.round(estimate.carbs * scale),
      fats: Math.round(estimate.fats * scale),
      source: 'estimate',
    };
  }

  // Last resort: generic estimate (protein-like food)
  const scale = portionGrams / 100;
  return {
    ...food,
    portionGrams,
    calories: Math.round(150 * scale),
    protein: Math.round(20 * scale),
    carbs: Math.round(5 * scale),
    fats: Math.round(5 * scale),
    source: 'estimate',
  };
}

/**
 * Enrich an array of AI-identified foods with nutrition data.
 * Performs lookups in parallel for speed.
 */
export async function enrichFoodsWithNutrition(foods: IdentifiedFood[]): Promise<EnrichedFoodsResult> {
  if (!foods || foods.length === 0) {
    return {
      foods: [],
      totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
      hasUSDAData: false,
    };
  }

  // Look up all foods in parallel
  const enrichedFoods = await Promise.all(foods.map(lookupSingleFood));

  // Calculate totals
  const totals = enrichedFoods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.calories,
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fats: acc.fats + food.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  // Check if any food matched USDA
  const hasUSDAData = enrichedFoods.some(f => f.source === 'usda');

  return {
    foods: enrichedFoods,
    totals,
    hasUSDAData,
  };
}

/**
 * Generate a human-readable markdown summary of the meal.
 */
export function generateMealMarkdown(
  foods: FoodWithNutrition[],
  totals: MacroTotals,
  userGoal: string | null
): string {
  const lines: string[] = [];

  // Header
  lines.push('## Meal Analysis\n');

  // Food breakdown
  lines.push('### Foods Identified\n');
  for (const food of foods) {
    const badge = food.source === 'usda' ? '✓' : '~';
    lines.push(`- **${food.name}** (${food.portion}) ${badge}`);
    lines.push(`  ${food.calories} cal | ${food.protein}g P | ${food.carbs}g C | ${food.fats}g F\n`);
  }

  // Totals
  lines.push('### Total Macros\n');
  lines.push(`- **Calories:** ${totals.calories}`);
  lines.push(`- **Protein:** ${totals.protein}g`);
  lines.push(`- **Carbs:** ${totals.carbs}g`);
  lines.push(`- **Fats:** ${totals.fats}g\n`);

  // Goal context
  if (userGoal) {
    lines.push('### Goal Fit\n');
    const goal = userGoal.toUpperCase();
    if (goal === 'CUT') {
      const isHighProtein = totals.protein >= 30;
      const isModerateCalories = totals.calories <= 600;
      if (isHighProtein && isModerateCalories) {
        lines.push('This meal supports your cutting goal with good protein and moderate calories.');
      } else if (!isHighProtein) {
        lines.push('Consider adding more protein to support muscle retention during your cut.');
      } else {
        lines.push('Portion sizes look generous for a cutting phase. Consider scaling back slightly.');
      }
    } else if (goal === 'BULK') {
      if (totals.protein >= 30 && totals.calories >= 500) {
        lines.push('Solid meal for bulking. Good protein and calorie density.');
      } else {
        lines.push('You might need larger portions or an extra protein source to support your bulk.');
      }
    } else {
      lines.push('This meal provides balanced macros for body recomposition.');
    }
  }

  // Data source note
  const usdaCount = foods.filter(f => f.source === 'usda').length;
  const estimateCount = foods.length - usdaCount;

  if (estimateCount > 0) {
    lines.push('\n---');
    lines.push(`*${usdaCount} food(s) matched USDA database (✓), ${estimateCount} estimated (~)*`);
  }

  return lines.join('\n');
}
