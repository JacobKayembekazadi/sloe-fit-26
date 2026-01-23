
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { BODY_ANALYSIS_PROMPT, MEAL_ANALYSIS_PROMPT, PROGRESS_ANALYSIS_PROMPT } from '../prompts';
import { fileToGenerativePart } from '../utils/fileUtils';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
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

export const analyzeMealPhoto = async (image: File, userGoal: string | null): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(image);
    
    let goalText = "The user has not set a specific goal yet. Provide general nutrition advice.";
    if(userGoal) {
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
      return response.text;
    } else {
      return "Error: The model did not return a valid response. Please check your image and try again.";
    }
  } catch (error) {
    console.error("Error analyzing meal photo:", error);
    return `An error occurred while analyzing the image: ${error instanceof Error ? error.message : String(error)}. Please try again later.`;
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
