import OpenAI from 'openai';
import { BODY_ANALYSIS_PROMPT, MEAL_ANALYSIS_PROMPT, PROGRESS_ANALYSIS_PROMPT, WORKOUT_GENERATION_PROMPT, TEXT_MEAL_ANALYSIS_PROMPT } from '../prompts';
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

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!API_KEY) {
  console.warn("VITE_OPENAI_API_KEY not set. AI features will not work.");
}

const openai = new OpenAI({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true // Required for client-side usage
});

const MODEL = 'gpt-4o-mini';

// Helper to convert File to base64 data URL
const fileToDataUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeBodyPhoto = async (image: File): Promise<string> => {
  try {
    const imageUrl = await fileToDataUrl(image);

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: BODY_ANALYSIS_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze the attached body photo.' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 1500
    });

    return response.choices[0]?.message?.content || "Error: No response from model.";
  } catch (error) {
    console.error("Error analyzing body photo:", error);
    return `An error occurred while analyzing the image: ${error instanceof Error ? error.message : String(error)}`;
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
    const imageUrl = await fileToDataUrl(image);

    let goalText = "The user has not set a specific goal yet. Provide general nutrition advice.";
    if (userGoal) {
      goalText = `The user's current goal is: ${userGoal}. Tailor your feedback to this goal.`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: MEAL_ANALYSIS_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Analyze the attached meal photo. ${goalText}` },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 1500
    });

    const fullText = response.choices[0]?.message?.content || "";
    if (fullText) {
      const macros = parseMacrosFromResponse(fullText);
      const markdown = stripMacrosBlock(fullText);
      return { markdown, macros };
    }

    return { markdown: "Error: No response from model.", macros: null };
  } catch (error) {
    console.error("Error analyzing meal photo:", error);
    return {
      markdown: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
      macros: null
    };
  }
};

export const analyzeProgress = async (images: File[], metrics: string): Promise<string> => {
  try {
    const imageUrls = await Promise.all(images.map(fileToDataUrl));

    const imageContent = imageUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url }
    }));

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: PROGRESS_ANALYSIS_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Analyze the attached progress photos and metrics:\n${metrics}` },
            ...imageContent
          ]
        }
      ],
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || "Error: No response from model.";
  } catch (error) {
    console.error("Error analyzing progress:", error);
    return `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
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

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: WORKOUT_GENERATION_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        return JSON.parse(content) as GeneratedWorkout;
      } catch (parseError) {
        console.error("Error parsing workout JSON:", parseError, content);
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

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: TEXT_MEAL_ANALYSIS_PROMPT },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        return JSON.parse(content) as TextMealAnalysisResult;
      } catch (parseError) {
        console.error("Error parsing meal JSON:", parseError, content);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error analyzing text meal:", error);
    return null;
  }
};

// Voice transcription using Whisper
export const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
  try {
    const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    return transcription.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return null;
  }
};
