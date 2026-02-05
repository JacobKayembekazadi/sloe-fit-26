import React, { useState, useCallback, ChangeEvent, memo, useMemo } from 'react';
import { analyzeMealPhoto, MealAnalysisResult, TextMealAnalysisResult } from '../services/aiService';
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
import { MealEntry, FavoriteFood } from '../hooks/useUserData';

type InputMode = 'text' | 'photo' | 'quick';

interface MealTrackerProps {
  userGoal: string | null;
  onLogMeal: (macros: { calories: number; protein: number; carbs: number; fats: number }) => Promise<void>;
  todayNutrition?: { calories: number; protein: number; carbs: number; fats: number };
  nutritionTargets?: { calories: number; protein: number; carbs: number; fats: number };
  // New props for meal persistence
  mealEntries?: MealEntry[];
  favorites?: FavoriteFood[];
  onSaveMealEntry?: (entry: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    inputMethod?: 'photo' | 'text' | 'quick_add';
    photoUrl?: string;
  }) => Promise<MealEntry | null>;
  onDeleteMealEntry?: (entryId: string) => Promise<boolean>;
  onAddToFavorites?: (meal: { name: string; calories: number; protein: number; carbs: number; fats: number }) => Promise<boolean>;
}

// Skeleton component for loading states
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse motion-reduce:animate-none bg-gray-800 rounded ${className}`} />
);

// Loading skeleton for analysis results
const AnalysisSkeleton = () => (
  <div className="card space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="text-center space-y-2">
          <Skeleton className="h-8 w-16 mx-auto" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
      ))}
    </div>
    <Skeleton className="h-20 w-full rounded-xl" />
    <Skeleton className="h-12 w-full rounded-xl" />
  </div>
);

const MealTracker: React.FC<MealTrackerProps> = ({
  userGoal,
  onLogMeal,
  todayNutrition = { calories: 0, protein: 0, carbs: 0, fats: 0 },
  nutritionTargets = { calories: 2200, protein: 180, carbs: 220, fats: 70 },
  mealEntries = [],
  favorites: favoritesProp = [],
  onSaveMealEntry,
  onDeleteMealEntry,
  onAddToFavorites
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
  const [isLogging, setIsLogging] = useState(false);
  const [analyzeRetry, setAnalyzeRetry] = useState<(() => void) | null>(null);
  const [mealDescription, setMealDescription] = useState<string>('');
  const [selectedMeal, setSelectedMeal] = useState<MealEntry | null>(null);

  // Derive today's meals from mealEntries - Bug #3 fix
  const todaysMeals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return mealEntries
      .filter(m => m.date === today)
      .map(m => ({
        id: m.id,
        name: m.description || 'Meal',
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fats: m.fats,
        time: new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        mealType: m.meal_type
      }));
  }, [mealEntries]);

  // Convert favorites to SavedMeal format for QuickAddMeal component
  const favorites: SavedMeal[] = useMemo(() =>
    favoritesProp.map(f => ({
      id: f.id,
      name: f.name,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fats: f.fats,
      isFavorite: true,
      timesLogged: f.times_logged
    }))
  , [favoritesProp]);

  // Get recent meals (last 10 unique meals, excluding favorites)
  const recentMeals: SavedMeal[] = useMemo(() => {
    const seenNames = new Set(favoritesProp.map(f => f.name.toLowerCase()));
    const recent: SavedMeal[] = [];

    for (const m of mealEntries) {
      if (!m.description) continue;
      const name = m.description.toLowerCase();
      if (seenNames.has(name)) continue;
      seenNames.add(name);
      recent.push({
        id: m.id,
        name: m.description,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fats: m.fats,
        isFavorite: false
      });
      if (recent.length >= 10) break;
    }

    return recent;
  }, [mealEntries, favoritesProp]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      const validation = validateImage(selectedFile);
      if (!validation.valid) {
        setError(validation.error || 'Invalid image file');
        setAnalyzeRetry(null);
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setError(null);
      setAnalyzeRetry(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handlePhotoAnalyze = useCallback(async () => {
    if (!file) {
      setError("Please upload a photo of your meal first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    setMacros(null);
    setIsLogged(false);
    setAnalyzeRetry(null);

    try {
      const analysisResult = await analyzeMealPhoto(file, userGoal);
      if (analysisResult.markdown.startsWith('An error occurred') || analysisResult.markdown.startsWith('Error:')) {
        setError(analysisResult.markdown);
        setAnalyzeRetry(() => handlePhotoAnalyze);
      } else {
        setResult(analysisResult.markdown);
        setMacros(analysisResult.macros);
        // Extract description from photo analysis - Bug #6 fix
        // Try to extract food items from the markdown response
        const foodMatch = analysisResult.markdown.match(/(?:identified|detected|found|see):\s*(.+?)(?:\n|$)/i);
        const description = foodMatch ? foodMatch[1].trim() : 'Photo meal';
        setMealDescription(description);
      }
    } catch (err) {
      setError('Failed to analyze photo. Please check your connection and try again.');
      setAnalyzeRetry(() => handlePhotoAnalyze);
      showToast('Photo analysis failed', 'error');
    }
    setIsLoading(false);
  }, [file, userGoal]);

  const handleTextAnalysisComplete = (analysisResult: TextMealAnalysisResult) => {
    setMacros(analysisResult.totals);
    // Extract description from food names - Bug #6 fix
    const description = analysisResult.foods.map(f => f.name).join(', ');
    setMealDescription(description);
    setResult(`**Analyzed Meal**\n\n${analysisResult.foods.map(f => `- ${f.name} (${f.portion}): ${f.calories} cal, ${f.protein}g protein`).join('\n')}\n\n**Confidence:** ${analysisResult.confidence}\n\n${analysisResult.notes}`);
  };

  const handleQuickAdd = async (meal: SavedMeal) => {
    try {
      // Use saveMealEntry if available, otherwise fall back to onLogMeal
      if (onSaveMealEntry) {
        await onSaveMealEntry({
          description: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          inputMethod: 'quick_add'
        });
      } else {
        await onLogMeal({
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats
        });
      }
      showToast(`Added ${meal.name} - ${meal.calories} cal`, 'success');
    } catch {
      showToast('Failed to log meal. Please try again.', 'error');
    }
  };

  const handleLogMeal = useCallback(async () => {
    if (!macros) return;
    setIsLogging(true);
    try {
      // Use saveMealEntry if available for proper persistence - Bug #1 fix
      if (onSaveMealEntry) {
        await onSaveMealEntry({
          description: mealDescription || 'Logged Meal',
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fats: macros.fats,
          inputMethod: inputMode === 'photo' ? 'photo' : 'text'
        });
      } else {
        await onLogMeal(macros);
      }
      setIsLogged(true);
      showToast(`Logged ${macros.calories} calories`, 'success');
    } catch {
      showToast('Failed to log meal. Please try again.', 'error');
    } finally {
      setIsLogging(false);
    }
  }, [macros, onLogMeal, onSaveMealEntry, mealDescription, inputMode, showToast]);

  const resetForNextMeal = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setMacros(null);
    setError(null);
    setIsLoading(false);
    setIsLogged(false);
    setAnalyzeRetry(null);
    setMealDescription('');
    setSelectedMeal(null);
  };

  const dismissError = () => {
    setError(null);
    setAnalyzeRetry(null);
  };

  const InputModeTab: React.FC<{ mode: InputMode; label: string; icon: React.ReactNode }> = ({ mode, label, icon }) => (
    <button
      onClick={() => {
        setInputMode(mode);
        resetForNextMeal();
      }}
      className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold uppercase transition-all ${
        inputMode === mode
          ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
          : 'text-gray-500 border-b-2 border-transparent hover:text-gray-300'
      }`}
    >
      {icon}
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
        <InputModeTab
          mode="text"
          label="Text"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
        <InputModeTab
          mode="photo"
          label="Photo"
          icon={<CameraIcon className="w-4 h-4" />}
        />
        <InputModeTab
          mode="quick"
          label="Quick"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
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
                  <>
                    <img src={preview} alt="Meal preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-white font-bold">Change Photo</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-gray-500 group-hover:text-white transition-colors">
                    <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                      <CameraIcon className="w-8 h-8" />
                    </div>
                    <span className="font-bold uppercase tracking-wide">Snap Meal</span>
                    <span className="text-xs text-gray-600 mt-1">or upload a photo</span>
                  </div>
                )}
              </label>

              {file && (
                <button
                  onClick={handlePhotoAnalyze}
                  disabled={isLoading}
                  className="btn-primary w-full mt-6 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
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

      {/* Loading State with Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="card flex flex-col items-center justify-center text-center p-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 border-4 border-gray-700 border-t-[var(--color-primary)] rounded-full animate-spin motion-reduce:animate-none" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">🍽️</span>
              </div>
            </div>
            <p className="text-xl font-black text-white">ANALYZING...</p>
            <p className="text-gray-500 text-sm mt-1">Scanning your meal for nutrition info</p>
          </div>
          <AnalysisSkeleton />
        </div>
      )}

      {/* Error State with Retry */}
      {error && !isLoading && (
        <div className="card border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-500/20 rounded-full">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-400 mb-1">Analysis Failed</h3>
              <p className="text-gray-400 text-sm">{error}</p>
              <div className="flex gap-2 mt-4">
                {analyzeRetry && (
                  <button
                    onClick={() => {
                      setError(null);
                      analyzeRetry();
                    }}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                )}
                <button
                  onClick={dismissError}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded-lg text-sm font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="card">
            <ResultDisplay result={result} />
          </div>

          {/* Log This Meal Button */}
          {macros && !isLogged && (
            <button
              onClick={handleLogMeal}
              disabled={isLogging}
              className="btn-primary w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {isLogging ? (
                <>
                  <LoaderIcon className="w-5 h-5 animate-spin motion-reduce:animate-none" />
                  Logging...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Log This Meal ({macros.calories} cal, {macros.protein}g protein)
                </>
              )}
            </button>
          )}

          {isLogged && (
            <div className="flex items-center justify-center gap-2 py-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 font-bold animate-pulse motion-reduce:animate-none">
              <CheckIcon className="w-6 h-6" />
              <span>Meal Logged Successfully!</span>
            </div>
          )}

          <button
            onClick={resetForNextMeal}
            className="btn-secondary w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Another Meal
          </button>
        </div>
      )}

      {/* Meal Detail Modal - Bug #4 fix */}
      {selectedMeal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMeal(null)}>
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">{selectedMeal.description || 'Meal'}</h3>
              <button onClick={() => setSelectedMeal(null)} className="text-gray-500 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-gray-400 text-sm mb-4">
              {new Date(selectedMeal.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {selectedMeal.meal_type && ` • ${selectedMeal.meal_type}`}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[var(--color-primary)]">{selectedMeal.calories}</div>
                <div className="text-xs text-gray-500 uppercase">Calories</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{selectedMeal.protein}g</div>
                <div className="text-xs text-gray-500 uppercase">Protein</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{selectedMeal.carbs}g</div>
                <div className="text-xs text-gray-500 uppercase">Carbs</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-pink-400">{selectedMeal.fats}g</div>
                <div className="text-xs text-gray-500 uppercase">Fats</div>
              </div>
            </div>

            <div className="flex gap-2">
              {onAddToFavorites && (
                <button
                  onClick={async () => {
                    if (selectedMeal.description) {
                      await onAddToFavorites({
                        name: selectedMeal.description,
                        calories: selectedMeal.calories,
                        protein: selectedMeal.protein,
                        carbs: selectedMeal.carbs,
                        fats: selectedMeal.fats
                      });
                      showToast('Added to favorites', 'success');
                    }
                  }}
                  className="flex-1 py-2 px-4 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>★</span> Favorite
                </button>
              )}
              {onDeleteMealEntry && (
                <button
                  onClick={async () => {
                    const success = await onDeleteMealEntry(selectedMeal.id);
                    if (success) {
                      showToast('Meal deleted', 'success');
                      setSelectedMeal(null);
                    } else {
                      showToast('Failed to delete meal', 'error');
                    }
                  }}
                  className="flex-1 py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Today's Meals List */}
      {todaysMeals.length > 0 && !result && (
        <div className="card">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Today's Meals
          </h3>
          <div className="space-y-2">
            {todaysMeals.map((meal) => (
              <button
                key={meal.id}
                onClick={() => {
                  // Find the full meal entry to show in modal
                  const fullMeal = mealEntries.find(m => m.id === meal.id);
                  if (fullMeal) setSelectedMeal(fullMeal);
                }}
                className="w-full flex justify-between items-center py-3 px-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🍽️</span>
                  <div className="text-left">
                    <span className="text-white font-medium">{meal.name}</span>
                    <span className="text-gray-500 text-xs ml-2">{meal.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-primary)] font-bold">{meal.calories} cal</span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
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

export default memo(MealTracker);
