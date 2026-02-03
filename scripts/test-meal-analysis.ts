/**
 * Test script for meal analysis validation
 * Run with: npx ts-node scripts/test-meal-analysis.ts
 *
 * This tests the validateAndCorrectMealAnalysis function with various scenarios
 */

// Mock the DEBUG_MODE for testing
const DEBUG_MODE = true;

// Type definitions
interface TextMealAnalysisResult {
  foods: { name: string; portion: string; calories: number; protein: number; carbs: number; fats: number }[];
  totals: { calories: number; protein: number; carbs: number; fats: number };
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

interface MealValidationResult {
  isValid: boolean;
  correctedResult?: TextMealAnalysisResult;
  issues: string[];
}

// Copy of the validation function for testing
function validateAndCorrectMealAnalysis(result: unknown): MealValidationResult {
  const issues: string[] = [];

  if (!result || typeof result !== 'object') {
    return { isValid: false, issues: ['Invalid response structure'] };
  }

  const data = result as Record<string, unknown>;

  if (!Array.isArray(data.foods)) {
    return { isValid: false, issues: ['Missing or invalid foods array'] };
  }

  if (!data.totals || typeof data.totals !== 'object') {
    return { isValid: false, issues: ['Missing or invalid totals object'] };
  }

  const totals = data.totals as Record<string, unknown>;

  const validatedFoods: TextMealAnalysisResult['foods'] = [];
  let calculatedCalories = 0;
  let calculatedProtein = 0;
  let calculatedCarbs = 0;
  let calculatedFats = 0;

  for (const food of data.foods) {
    if (!food || typeof food !== 'object') continue;

    const f = food as Record<string, unknown>;
    const name = typeof f.name === 'string' ? f.name : 'Unknown food';
    const portion = typeof f.portion === 'string' ? f.portion : 'standard portion';
    const calories = typeof f.calories === 'number' ? Math.round(f.calories) : 0;
    const protein = typeof f.protein === 'number' ? Math.round(f.protein) : 0;
    const carbs = typeof f.carbs === 'number' ? Math.round(f.carbs) : 0;
    const fats = typeof f.fats === 'number' ? Math.round(f.fats) : 0;

    const expectedCalories = (protein * 4) + (carbs * 4) + (fats * 9);
    const calorieDiff = Math.abs(calories - expectedCalories);
    const tolerance = Math.max(20, expectedCalories * 0.15);

    let correctedCalories = calories;
    if (calorieDiff > tolerance && expectedCalories > 0) {
      issues.push(`${name}: calories adjusted from ${calories} to ${expectedCalories} based on macros`);
      correctedCalories = expectedCalories;
    }

    if (correctedCalories > 2000) {
      issues.push(`${name}: unusually high calories (${correctedCalories}) - verify portion`);
    }
    if (protein > 100) {
      issues.push(`${name}: unusually high protein (${protein}g) - verify portion`);
    }

    validatedFoods.push({
      name,
      portion,
      calories: correctedCalories,
      protein,
      carbs,
      fats
    });

    calculatedCalories += correctedCalories;
    calculatedProtein += protein;
    calculatedCarbs += carbs;
    calculatedFats += fats;
  }

  const reportedCalories = typeof totals.calories === 'number' ? Math.round(totals.calories) : 0;

  const caloriesDiff = Math.abs(reportedCalories - calculatedCalories);
  if (caloriesDiff > 50) {
    issues.push(`Total calories corrected from ${reportedCalories} to ${calculatedCalories}`);
  }

  if (calculatedCalories < 10 && validatedFoods.length > 0) {
    issues.push('Warning: Total calories suspiciously low');
  }
  if (calculatedCalories > 5000) {
    issues.push('Warning: Total calories unusually high for a single meal');
  }

  const confidence = (data.confidence === 'high' || data.confidence === 'medium' || data.confidence === 'low')
    ? data.confidence
    : 'medium';

  let notes = typeof data.notes === 'string' ? data.notes : '';
  if (issues.length > 0) {
    notes = notes ? `${notes} [Auto-corrected: ${issues.length} adjustment(s)]` : `[Auto-corrected: ${issues.length} adjustment(s)]`;
  }

  const correctedResult: TextMealAnalysisResult = {
    foods: validatedFoods,
    totals: {
      calories: calculatedCalories,
      protein: calculatedProtein,
      carbs: calculatedCarbs,
      fats: calculatedFats
    },
    confidence,
    notes
  };

  return {
    isValid: true,
    correctedResult,
    issues
  };
}

// Test cases
const testCases = [
  {
    name: "Valid simple meal - chicken and rice",
    input: {
      foods: [
        { name: "Grilled chicken breast", portion: "6 oz", calories: 248, protein: 47, carbs: 0, fats: 5 },
        { name: "White rice", portion: "1 cup", calories: 205, protein: 4, carbs: 45, fats: 0 }
      ],
      totals: { calories: 453, protein: 51, carbs: 45, fats: 5 },
      confidence: "high",
      notes: "Standard chicken and rice meal"
    },
    expectedValid: true,
    expectCorrections: false
  },
  {
    name: "Incorrect calorie calculation - needs correction",
    input: {
      foods: [
        { name: "Eggs", portion: "2 large", calories: 200, protein: 12, carbs: 0, fats: 10 },  // Should be ~138
      ],
      totals: { calories: 200, protein: 12, carbs: 0, fats: 10 },
      confidence: "high",
      notes: "Two eggs"
    },
    expectedValid: true,
    expectCorrections: true
  },
  {
    name: "Totals don't match foods",
    input: {
      foods: [
        { name: "Protein shake", portion: "1 scoop", calories: 120, protein: 24, carbs: 3, fats: 1 },
        { name: "Banana", portion: "1 medium", calories: 105, protein: 1, carbs: 27, fats: 0 }
      ],
      totals: { calories: 500, protein: 25, carbs: 30, fats: 1 },  // Wrong totals
      confidence: "high",
      notes: "Post workout shake"
    },
    expectedValid: true,
    expectCorrections: true
  },
  {
    name: "Missing required fields",
    input: {
      foods: [
        { name: "Mystery food" }  // Missing calories/macros
      ],
      confidence: "low"
      // Missing totals
    },
    expectedValid: false,
    expectCorrections: false
  },
  {
    name: "Complex Chipotle bowl",
    input: {
      foods: [
        { name: "Cilantro-lime rice", portion: "1 cup", calories: 210, protein: 4, carbs: 40, fats: 4 },
        { name: "Chicken", portion: "4 oz", calories: 180, protein: 32, carbs: 0, fats: 6 },
        { name: "Black beans", portion: "0.5 cup", calories: 115, protein: 8, carbs: 20, fats: 0 },
        { name: "Cheese", portion: "1 oz", calories: 110, protein: 7, carbs: 0, fats: 9 },
        { name: "Sour cream", portion: "2 tbsp", calories: 60, protein: 1, carbs: 1, fats: 6 },
        { name: "Guacamole", portion: "2 oz", calories: 100, protein: 1, carbs: 6, fats: 8 }
      ],
      totals: { calories: 775, protein: 53, carbs: 67, fats: 33 },
      confidence: "medium",
      notes: "Chipotle bowl with standard toppings"
    },
    expectedValid: true,
    expectCorrections: false
  },
  {
    name: "Suspiciously high calories",
    input: {
      foods: [
        { name: "Giant burger", portion: "1 whole", calories: 6000, protein: 80, carbs: 100, fats: 300 }
      ],
      totals: { calories: 6000, protein: 80, carbs: 100, fats: 300 },
      confidence: "low",
      notes: "Huge burger"
    },
    expectedValid: true,
    expectCorrections: true  // Should flag as unusually high
  }
];

// Run tests
console.log("=== Meal Analysis Validation Tests ===\n");

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = validateAndCorrectMealAnalysis(test.input);

  const validMatch = result.isValid === test.expectedValid;
  const correctionsMatch = test.expectCorrections ? result.issues.length > 0 : result.issues.length === 0;

  const testPassed = validMatch && (test.expectedValid ? correctionsMatch : true);

  if (testPassed) {
    console.log(`✅ PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.name}`);
    console.log(`   Expected valid: ${test.expectedValid}, Got: ${result.isValid}`);
    console.log(`   Expected corrections: ${test.expectCorrections}, Got issues: ${result.issues.length}`);
    failed++;
  }

  if (result.issues.length > 0) {
    console.log(`   Issues: ${result.issues.join(', ')}`);
  }

  if (result.correctedResult) {
    console.log(`   Totals: ${result.correctedResult.totals.calories} cal, ${result.correctedResult.totals.protein}p/${result.correctedResult.totals.carbs}c/${result.correctedResult.totals.fats}f`);
  }

  console.log('');
}

console.log("=== Results ===");
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

// Expected meal descriptions and their reasonable calorie ranges
const mealExpectations = [
  { desc: "chicken and rice", minCal: 350, maxCal: 550, minProtein: 35, maxProtein: 55 },
  { desc: "2 eggs with toast", minCal: 250, maxCal: 400, minProtein: 14, maxProtein: 22 },
  { desc: "protein shake with banana", minCal: 200, maxCal: 350, minProtein: 20, maxProtein: 35 },
  { desc: "chipotle bowl double chicken", minCal: 800, maxCal: 1200, minProtein: 55, maxProtein: 85 },
  { desc: "large salad with grilled chicken", minCal: 350, maxCal: 600, minProtein: 30, maxProtein: 50 },
  { desc: "burger and fries", minCal: 800, maxCal: 1400, minProtein: 25, maxProtein: 45 }
];

console.log("\n=== Expected Calorie Ranges for Common Meals ===");
console.log("(Use these to verify AI responses are reasonable)\n");

for (const meal of mealExpectations) {
  console.log(`"${meal.desc}"`);
  console.log(`  Calories: ${meal.minCal}-${meal.maxCal}`);
  console.log(`  Protein: ${meal.minProtein}-${meal.maxProtein}g\n`);
}
