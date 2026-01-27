import React, { useState, useCallback, ChangeEvent } from 'react';
import { analyzeMealPhoto, MealAnalysisResult, TextMealAnalysisResult } from '../services/openaiService';
import { validateImage } from '../services/storageService';
import { useToast } from '../contexts/ToastContext';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import CheckIcon from './icons/CheckIcon';
import ResultDisplay from './ResultDisplay';
import ProductCard from './ProductCard';
import DailyNutritionRing from './DailyNutritionRing';
import TextMealInput from './TextMealInput';
import QuickAddMeal, { SavedMeal } from './QuickAddMeal';
import { PRODUCT_IDS } from '../services/shopifyService';

type InputMode = 'text' | 'photo' | 'quick';

interface MealTrackerProps {
  userGoal: string | null;
  onLogMeal: (macros: { calories: number; protein: number; carbs: number; fats: number }) => Promise<void>;
  todayNutrition?: { calories: number; protein: number; carbs: number; fats: number };
  nutritionTargets?: { calories: number; protein: number; carbs: number; fats: number };
}

const MealTracker: React.FC<MealTrackerProps> = ({
  userGoal,
  onLogMeal,
  todayNutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 },
  nutritionTargets = { calories: 2200, protein: 180, carbs: 220, fats: 70 }
}) => {
  const { showToast } = useToast();
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [macros, setMacros] = useState<MealAnalysisResult['macros']>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLogged, setIsLogged] = useState(false);
  const [todaysMeals, setTodaysMeals] = useState<{ name: string; calories: number; time: string }[]>([]);

  // Mock data for favorites and recent - in production, fetch from Supabase
  const [favorites] = useState<SavedMeal[]>([
    { id: '1', name: 'Chicken & Rice', calories: 450, protein: 40, carbs: 45, fats: 8, isFavorite: true },
    { id: '2', name: 'Protein Shake', calories: 180, protein: 25, carbs: 8, fats: 3, isFavorite: true },
  ]);
  const [recentMeals] = useState<SavedMeal[]>([]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      const validation = validateImage(selectedFile);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file');
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setError(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handlePhotoAnalyze = useCallback(async () => {
    if (!file) {
      setError("Please upload a photo of your meal.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    setMacros(null);
    setIsLogged(false);

    const analysisResult = await analyzeMealPhoto(file, userGoal);
    if (analysisResult.markdown.startsWith('An error occurred') || analysisResult.markdown.startsWith('Error:')) {
      setError(analysisResult.markdown);
    } else {
      setResult(analysisResult.markdown);
      setMacros(analysisResult.macros);
    }
    setIsLoading(false);
  }, [file, userGoal]);

  const handleTextAnalysisComplete = (analysisResult: TextMealAnalysisResult) => {
    setMacros(analysisResult.totals);
    setResult(`**Analyzed Meal**\n\n${analysisResult.foods.map(f => `- ${f.name} (${f.portion}): ${f.calories} cal, ${f.protein}g protein`).join('\n')}\n\n**Confidence:** ${analysisResult.confidence}\n\n${analysisResult.notes}`);
  };

  const handleQuickAdd = async (meal: SavedMeal) => {
    try {
      await onLogMeal({
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats
      });
      setTodaysMeals(prev => [...prev, {
        name: meal.name,
        calories: meal.calories,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      }]);
      showToast(`Added ${meal.name} - ${meal.calories} cal`, 'success');
    } catch {
      showToast('Failed to log meal', 'error');
    }
  };

  const handleLogMeal = useCallback(async () => {
    if (!macros) return;
    try {
      await onLogMeal(macros);
      setIsLogged(true);
      setTodaysMeals(prev => [...prev, {
        name: 'Logged Meal',
        calories: macros.calories,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      }]);
      showToast(`Logged ${macros.calories} calories`, 'success');
    } catch {
      showToast('Failed to log meal', 'error');
    }
  }, [macros, onLogMeal, showToast]);

  const resetForNextMeal = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setMacros(null);
    setError(null);
    setIsLoading(false);
    setIsLogged(false);
  };

  const InputModeTab: React.FC<{ mode: InputMode; label: string; icon?: React.ReactNode }> = ({ mode, label }) => (
    <button
      onClick={() => {
        setInputMode(mode);
        resetForNextMeal();
      }}
      className={`flex-1 py-3 text-sm font-bold uppercase transition-all ${
        inputMode === mode
          ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
          : 'text-gray-500 border-b-2 border-transparent hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full space-y-6">
      <header>
        <h2 className="text-3xl font-black text-white tracking-tighter">MEAL TRACKER</h2>
        <p className="text-gray-400 text-sm">Track your nutrition with AI.</p>
      </header>

      {/* Daily Calorie Ring */}
      <div className="card py-6">
        <DailyNutritionRing
          consumed={todayNutrition.calories}
          target={nutritionTargets.calories}
          showMacros={true}
          protein={{ consumed: todayNutrition.protein, target: nutritionTargets.protein }}
          carbs={{ consumed: todayNutrition.carbs, target: nutritionTargets.carbs }}
          fats={{ consumed: todayNutrition.fats, target: nutritionTargets.fats }}
        />
      </div>

      {/* Input Mode Tabs */}
      <div className="flex border-b border-gray-800">
        <InputModeTab mode="text" label="Text" />
        <InputModeTab mode="photo" label="Photo" />
        <InputModeTab mode="quick" label="Quick Add" />
      </div>

      {/* Input Content */}
      {!result && !isLoading && (
        <div className="card">
          {inputMode === 'text' && (
            <TextMealInput
              userGoal={userGoal}
              onAnalysisComplete={handleTextAnalysisComplete}
            />
          )}

          {inputMode === 'photo' && (
            <div className="flex flex-col items-center">
              <input
                type="file"
                id="meal-photo-upload"
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
              />
              <label
                htmlFor="meal-photo-upload"
                className="w-full aspect-square max-w-sm cursor-pointer border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center hover:border-[var(--color-primary)] hover:bg-white/5 transition-all duration-300 relative overflow-hidden group"
              >
                {preview ? (
                  <img src={preview} alt="Meal preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-gray-500 group-hover:text-white transition-colors">
                    <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                      <CameraIcon className="w-8 h-8" />
                    </div>
                    <span className="font-bold uppercase tracking-wide">Snap Meal</span>
                  </div>
                )}
              </label>

              {file && (
                <button
                  onClick={handlePhotoAnalyze}
                  disabled={isLoading}
                  className="btn-primary w-full mt-6"
                >
                  Scan Macros
                </button>
              )}
            </div>
          )}

          {inputMode === 'quick' && (
            <QuickAddMeal
              recentMeals={recentMeals}
              favorites={favorites}
              onQuickAdd={handleQuickAdd}
            />
          )}
        </div>
      )}

      {isLoading && (
        <div className="card flex flex-col items-center justify-center text-center p-12 min-h-[200px]">
          <LoaderIcon className="w-12 h-12 text-[var(--color-primary)] animate-spin mb-4" />
          <p className="text-xl font-black text-white animate-pulse">ANALYZING...</p>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-center font-medium">{error}</div>}

      {result && (
        <div className="space-y-6">
          <div className="card">
            <ResultDisplay result={result} />
          </div>

          {/* Log This Meal Button */}
          {macros && !isLogged && (
            <button
              onClick={handleLogMeal}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Log This Meal ({macros.calories} cal, {macros.protein}g protein)
            </button>
          )}

          {isLogged && (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 font-bold">
              <CheckIcon className="w-5 h-5" /> Meal Logged
            </div>
          )}

          <button
            onClick={resetForNextMeal}
            className="btn-secondary w-full"
          >
            Log Another Meal
          </button>
        </div>
      )}

      {/* Today's Meals List */}
      {todaysMeals.length > 0 && !result && (
        <div className="card">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Today's Meals</h3>
          <div className="space-y-2">
            {todaysMeals.map((meal, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-white font-medium">{meal.name}</span>
                  <span className="text-gray-500 text-xs ml-2">{meal.time}</span>
                </div>
                <span className="text-gray-400 text-sm">{meal.calories} cal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supplement Recommendations */}
      {result && (
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-8 bg-[var(--color-primary)] rounded-full"></span>
            PERFORMANCE FUEL
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <ProductCard productId={PRODUCT_IDS.CREATINE} />
            <ProductCard productId={PRODUCT_IDS.PRE_WORKOUT} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MealTracker;
