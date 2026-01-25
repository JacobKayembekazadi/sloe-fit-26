
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { BODY_ANALYSIS_PROMPT, MEAL_ANALYSIS_PROMPT, PROGRESS_ANALYSIS_PROMPT } from '../prompts';
import { fileToGenerativePart } from '../utils/fileUtils';

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
const model = 'gemini-3-flash-preview';

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
