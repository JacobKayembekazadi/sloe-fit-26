import React, { useState, useCallback, ChangeEvent } from 'react';
import { analyzeMealPhoto, MealAnalysisResult } from '../services/geminiService';
import { validateImage } from '../services/storageService';
import { useToast } from '../contexts/ToastContext';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import CheckIcon from './icons/CheckIcon';
import ResultDisplay from './ResultDisplay';
import ProductCard from './ProductCard';
import { PRODUCT_IDS } from '../services/shopifyService';

interface MealTrackerProps {
  userGoal: string | null;
  onLogMeal: (macros: { calories: number; protein: number; carbs: number; fats: number }) => Promise<void>;
}

const MealTracker: React.FC<MealTrackerProps> = ({ userGoal, onLogMeal }) => {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [macros, setMacros] = useState<MealAnalysisResult['macros']>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLogged, setIsLogged] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validate image before accepting
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

  const handleAnalyze = useCallback(async () => {
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

  const handleLogMeal = useCallback(async () => {
    if (!macros) return;
    try {
      await onLogMeal(macros);
      setIsLogged(true);
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

  if (!userGoal && !result) {
    return (
      <div className="card text-center p-8 mt-10">
        <h3 className="text-xl font-bold text-white mb-2">Setup Required</h3>
        <p className="text-gray-400 mb-6">
          To get personalized meal feedback, please complete the Body Analysis first.
        </p>
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <span className="text-[var(--color-primary)] font-bold">Tip: Go to the 'Body' tab</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h2 className="text-3xl font-black text-white tracking-tighter">MEAL TRACKER</h2>
        <p className="text-gray-400 text-sm">Snap a photo to track macros.</p>
      </header>

      {!result && !isLoading && (
        <div className="card flex flex-col items-center p-8">
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
              onClick={handleAnalyze}
              disabled={isLoading}
              className="btn-primary w-full mt-6"
            >
              Scan Macros
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="card flex flex-col items-center justify-center text-center p-12 min-h-[300px]">
          <LoaderIcon className="w-12 h-12 text-[var(--color-primary)] animate-spin mb-4" />
          <p className="text-xl font-black text-white animate-pulse">ANALYZING FOOD...</p>
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
              <CheckIcon className="w-5 h-5" /> Meal Logged to Daily Totals
            </div>
          )}

          <button
            onClick={resetForNextMeal}
            className="btn-secondary w-full"
          >
            Log Another Meal
          </button>

          {/* Supplement Recommendations */}
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
        </div>
      )}
    </div>
  );
};

export default MealTracker;
