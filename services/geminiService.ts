
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { BODY_ANALYSIS_PROMPT, MEAL_ANALYSIS_PROMPT, PROGRESS_ANALYSIS_PROMPT, WORKOUT_GENERATION_PROMPT, TEXT_MEAL_ANALYSIS_PROMPT } from '../prompts';
import { fileToGenerativePart } from '../utils/fileUtils';
import { RecoveryState } from '../components/RecoveryCheckIn';
import { UserProfile } from '../hooks/useUserData';

// Interface for parsed meal analysis result
export interface MealAnalysisResult {
  markdown: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  } | null;
}

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("VITE_GEMINI_API_KEY environment variable not set. Please check your .env file.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-2.0-flash';

export const analyzeBodyPhoto = async (image: File): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(image);
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: "Analyze the attached body photo." },
          imagePart,
        ],
      },
      config: {
        systemInstruction: BODY_ANALYSIS_PROMPT,
      }
    });

    if (response.text) {
      return response.text;
    } else {
      return "Error: The model did not return a valid response. Please check your image and try again.";
    }
  } catch (error) {
    console.error("Error analyzing body photo:", error);
    return `An error occurred while analyzing the image: ${error instanceof Error ? error.message : String(error)}. Please try again later.`;
  }
};

// Helper function to parse macros JSON from AI response
const parseMacrosFromResponse = (text: string): MealAnalysisResult['macros'] => {
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
        return {
          calories: Math.round(parsed.calories),
          protein: Math.round(parsed.protein),
          carbs: Math.round(parsed.carbs),
          fats: Math.round(parsed.fats)
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse macros JSON from response:', e);
  }
  return null;
};

// Helper function to strip macros JSON block from markdown
const stripMacrosBlock = (text: string): string => {
  return text.replace(/---MACROS_JSON---[\s\S]*?---END_MACROS---/g, '').trim();
};

export const analyzeMealPhoto = async (image: File, userGoal: string | null): Promise<MealAnalysisResult> => {
  try {
    const imagePart = await fileToGenerativePart(image);

    let goalText = "The user has not set a specific goal yet. Provide general nutrition advice.";
    if (userGoal) {
      goalText = `The user's current goal is: ${userGoal}. Tailor your feedback to this goal.`
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: `Analyze the attached meal photo. ${goalText}` },
          imagePart
        ]
      },
      config: {
        systemInstruction: MEAL_ANALYSIS_PROMPT,
      }
    });

    if (response.text) {
      const fullText = response.text;
      const macros = parseMacrosFromResponse(fullText);
      const markdown = stripMacrosBlock(fullText);
      return { markdown, macros };
    } else {
      return {
        markdown: "Error: The model did not return a valid response. Please check your image and try again.",
        macros: null
      };
    }
  } catch (error) {
    console.error("Error analyzing meal photo:", error);
    return {
      markdown: `An error occurred while analyzing the image: ${error instanceof Error ? error.message : String(error)}. Please try again later.`,
      macros: null
    };
  }
};

export const analyzeProgress = async (images: File[], metrics: string): Promise<string> => {
  try {
    const imageParts: Part[] = await Promise.all(
      images.map(file => fileToGenerativePart(file))
    );

    const textPart: Part = { text: `Analyze the attached progress photos (front, side, back) and the user's latest metrics:\n${metrics}` };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          textPart,
          ...imageParts,
        ],
      },
      config: {
        systemInstruction: PROGRESS_ANALYSIS_PROMPT,
      }
    });

    if (response.text) {
      return response.text;
    } else {
      return "Error: The model did not return a valid response. Please check your images and try again.";
    }
  } catch (error) {
    console.error("Error analyzing progress:", error);
    return `An error occurred while analyzing your progress: ${error instanceof Error ? error.message : String(error)}. Please try again later.`;
  }
};

// Workout generation types
export interface GeneratedWorkout {
  title: string;
  duration_minutes: number;
  intensity: 'light' | 'moderate' | 'intense';
  recovery_adjusted: boolean;
  recovery_notes?: string;
  warmup: {
    duration_minutes: number;
    exercises: { name: string; duration: string }[];
  };
  exercises: {
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    notes?: string;
    target_muscles: string[];
  }[];
  cooldown: {
    duration_minutes: number;
    exercises: { name: string; duration: string }[];
  };
}

export interface WorkoutGenerationInput {
  profile: UserProfile;
  recovery: RecoveryState;
  recentWorkouts: { title: string; date: string; muscles: string[] }[];
}

export const generateWorkout = async (input: WorkoutGenerationInput): Promise<GeneratedWorkout | null> => {
  try {
    const prompt = `
Generate a workout for this user:

USER PROFILE:
- Goal: ${input.profile.goal || 'RECOMP'}
- Training Experience: ${input.profile.training_experience || 'beginner'}
- Equipment Access: ${input.profile.equipment_access || 'gym'}
- Days Per Week: ${input.profile.days_per_week || 4}

RECOVERY STATE:
- Energy Level: ${input.recovery.energyLevel}/5
- Sleep Last Night: ${input.recovery.sleepHours} hours
- Sore Areas: ${input.recovery.sorenessAreas.length > 0 ? input.recovery.sorenessAreas.join(', ') : 'None'}
- Last Workout Rating: ${input.recovery.lastWorkoutRating}/5

RECENT WORKOUTS (last 3):
${input.recentWorkouts.length > 0
  ? input.recentWorkouts.map(w => `- ${w.title} (${w.date}): ${w.muscles.join(', ')}`).join('\n')
  : 'No recent workouts recorded'}

Generate an appropriate workout based on the above data.
`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: WORKOUT_GENERATION_PROMPT,
      }
    });

    if (response.text) {
      try {
        // Clean up the response - remove any markdown code blocks
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.slice(7);
        }
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith('```')) {
          jsonText = jsonText.slice(0, -3);
        }
        jsonText = jsonText.trim();

        const workout = JSON.parse(jsonText) as GeneratedWorkout;
        return workout;
      } catch (parseError) {
        console.error("Error parsing workout JSON:", parseError, response.text);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating workout:", error);
    return null;
  }
};

// Text meal analysis types
export interface TextMealAnalysisResult {
  foods: { name: string; portion: string; calories: number; protein: number; carbs: number; fats: number }[];
  totals: { calories: number; protein: number; carbs: number; fats: number };
  confidence: 'high' | 'medium' | 'low';
  notes: string;
}

export const analyzeTextMeal = async (description: string, userGoal: string | null): Promise<TextMealAnalysisResult | null> => {
  try {
    const goalContext = userGoal
      ? `The user's goal is ${userGoal}. Consider this when estimating portions.`
      : 'No specific goal set.';

    const prompt = `Analyze this meal: "${description}"\n\n${goalContext}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: TEXT_MEAL_ANALYSIS_PROMPT,
      }
    });

    if (response.text) {
      try {
        // Clean up the response - remove any markdown code blocks
        let jsonText = response.text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.slice(7);
        }
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith('```')) {
          jsonText = jsonText.slice(0, -3);
        }
        jsonText = jsonText.trim();

        const result = JSON.parse(jsonText) as TextMealAnalysisResult;
        return result;
      } catch (parseError) {
        console.error("Error parsing meal JSON:", parseError, response.text);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error analyzing text meal:", error);
    return null;
  }
};
