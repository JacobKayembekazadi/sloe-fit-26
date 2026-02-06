import type { TextMealAnalysis, PhotoMealAnalysis } from './types';

// ============================================================================
// Shared Validation Helpers (used by all AI providers)
// ============================================================================

export function validateAndCorrectMealAnalysis(result: unknown): TextMealAnalysis | null {
  if (!result || typeof result !== 'object') return null;

  const data = result as Record<string, unknown>;
  if (!Array.isArray(data.foods) || !data.totals || typeof data.totals !== 'object') return null;

  const foods: TextMealAnalysis['foods'] = [];
  let calculatedCalories = 0;
  let calculatedProtein = 0;
  let calculatedCarbs = 0;
  let calculatedFats = 0;

  for (const food of data.foods) {
    if (!food || typeof food !== 'object') continue;

    const f = food as Record<string, unknown>;
    const name = typeof f.name === 'string' ? f.name : 'Unknown food';
    const portion = typeof f.portion === 'string' ? f.portion : 'standard portion';
    let protein = Math.max(0, typeof f.protein === 'number' ? Math.round(f.protein) : 0);
    let carbs = Math.max(0, typeof f.carbs === 'number' ? Math.round(f.carbs) : 0);
    let fats = Math.max(0, typeof f.fats === 'number' ? Math.round(f.fats) : 0);
    let calories = Math.max(0, typeof f.calories === 'number' ? Math.round(f.calories) : 0);

    // Verify calorie calculation
    const expectedCalories = (protein * 4) + (carbs * 4) + (fats * 9);
    const tolerance = Math.max(15, expectedCalories * 0.10);

    if (Math.abs(calories - expectedCalories) > tolerance && expectedCalories > 0) {
      calories = expectedCalories;
    }

    foods.push({ name, portion, calories, protein, carbs, fats });
    calculatedCalories += calories;
    calculatedProtein += protein;
    calculatedCarbs += carbs;
    calculatedFats += fats;
  }

  // Recalculate totals
  const expectedTotalCalories = (calculatedProtein * 4) + (calculatedCarbs * 4) + (calculatedFats * 9);
  if (Math.abs(calculatedCalories - expectedTotalCalories) > 20) {
    calculatedCalories = expectedTotalCalories;
  }

  const confidence: 'high' | 'medium' | 'low' =
    (data.confidence === 'high' || data.confidence === 'medium' || data.confidence === 'low')
      ? data.confidence
      : 'medium';

  const notes = typeof data.notes === 'string' ? data.notes : '';

  return {
    foods,
    totals: {
      calories: calculatedCalories,
      protein: calculatedProtein,
      carbs: calculatedCarbs,
      fats: calculatedFats,
    },
    confidence,
    notes,
    markdown: '',
  };
}

export interface ParsedMacrosResult {
  macros: PhotoMealAnalysis['macros'];
  foods: string[];
}

export function parseMacrosFromResponse(text: string): ParsedMacrosResult {
  try {
    const jsonMatch = text.match(/---MACROS_JSON---\s*(\{[\s\S]*?\})\s*---END_MACROS---/);
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (
        typeof parsed.calories === 'number' &&
        typeof parsed.protein === 'number' &&
        typeof parsed.carbs === 'number' &&
        typeof parsed.fats === 'number'
      ) {
        // Extract foods array if present, clean up any markdown artifacts
        let foods: string[] = [];
        if (Array.isArray(parsed.foods)) {
          foods = parsed.foods
            .filter((f: unknown) => typeof f === 'string')
            .map((f: string) => f.replace(/\*+/g, '').trim()) // Remove any ** markdown
            .filter((f: string) => f.length > 0);
        }

        return {
          macros: {
            calories: Math.round(parsed.calories),
            protein: Math.round(parsed.protein),
            carbs: Math.round(parsed.carbs),
            fats: Math.round(parsed.fats),
          },
          foods,
        };
      }
    }
  } catch {
    // Failed to parse
  }
  return { macros: null, foods: [] };
}

export function stripMacrosBlock(text: string): string {
  return text.replace(/---MACROS_JSON---[\s\S]*?---END_MACROS---/g, '').trim();
}
