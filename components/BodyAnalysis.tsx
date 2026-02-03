import React, { useState, useCallback, ChangeEvent, memo } from 'react';
import { analyzeBodyPhoto } from '../services/openaiService';
import { validateImage } from '../services/storageService';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import ResultDisplay from './ResultDisplay';
import ProductCard from './ProductCard';
import ProgressPhotos from './ProgressPhotos';
import { PRODUCT_IDS } from '../services/shopifyService';

interface BodyAnalysisProps {
  onAnalysisComplete: (result: string) => void;
}

type TabMode = 'analyze' | 'progress';

// Skeleton component for loading states
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse motion-reduce:animate-none bg-gray-800 rounded ${className}`} />
);

// Analysis result skeleton
const AnalysisResultSkeleton = () => (
  <div className="space-y-4">
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/5" />
    </div>
    <div className="grid grid-cols-2 gap-4 mt-6">
      <div className="p-4 bg-gray-800/50 rounded-xl space-y-2">
        <Skeleton className="h-8 w-16 mx-auto" />
        <Skeleton className="h-3 w-20 mx-auto" />
      </div>
      <div className="p-4 bg-gray-800/50 rounded-xl space-y-2">
        <Skeleton className="h-8 w-16 mx-auto" />
        <Skeleton className="h-3 w-20 mx-auto" />
      </div>
    </div>
    <div className="space-y-3 mt-4">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  </div>
);

const BodyAnalysis: React.FC<BodyAnalysisProps> = ({ onAnalysisComplete }) => {
  const [tabMode, setTabMode] = useState<TabMode>('analyze');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError("Please upload a photo first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    const analysisResult = await analyzeBodyPhoto(file);
    if (analysisResult.startsWith('An error occurred') || analysisResult.startsWith('Error:')) {
      setError(analysisResult);
    } else {
      setResult(analysisResult);
      onAnalysisComplete(analysisResult);
    }
    setIsLoading(false);
  }, [file, onAnalysisComplete]);

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="w-full space-y-6">
      <header>
        <h2 className="text-3xl font-black text-white tracking-tighter">BODY ANALYSIS</h2>
        <p className="text-gray-400 text-sm">Track your transformation journey.</p>
      </header>

      {/* Tab selector */}
      <div className="flex gap-2 p-1 bg-black/30 rounded-xl">
        <button
          onClick={() => setTabMode('analyze')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm uppercase transition-all ${
            tabMode === 'analyze'
              ? 'bg-[var(--color-primary)] text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          AI Analysis
        </button>
        <button
          onClick={() => setTabMode('progress')}
          className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm uppercase transition-all ${
            tabMode === 'progress'
              ? 'bg-[var(--color-primary)] text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Progress Photos
        </button>
      </div>

      {/* Progress Photos Tab */}
      {tabMode === 'progress' && (
        <div className="card">
          <ProgressPhotos />
        </div>
      )}

      {/* AI Analysis Tab */}
      {tabMode === 'analyze' && !result && !isLoading && (
        <div className="card flex flex-col items-center p-8">
          <input
            type="file"
            id="body-photo-upload"
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
          />
          <label
            htmlFor="body-photo-upload"
            className="w-full aspect-[4/5] max-w-sm cursor-pointer border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center hover:border-[var(--color-primary)] hover:bg-white/5 transition-all duration-300 relative overflow-hidden group"
          >
            {preview ? (
              <img src={preview} alt="Physique preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-gray-500 group-hover:text-white transition-colors">
                <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                  <CameraIcon className="w-8 h-8" />
                </div>
                <span className="font-bold uppercase tracking-wide">Upload Photo</span>
                <p className="text-xs mt-2 text-center px-4">Tap to select front facing photo</p>
              </div>
            )}
          </label>

          {file && (
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="btn-primary w-full mt-6"
            >
              Analyze Physique
            </button>
          )}
        </div>
      )}

      {tabMode === 'analyze' && isLoading && (
        <div className="space-y-4">
          <div className="card flex flex-col items-center justify-center text-center p-8">
            <div className="relative mb-4">
              <div className="w-20 h-20 border-4 border-gray-700 border-t-[var(--color-primary)] rounded-full animate-spin motion-reduce:animate-none" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl">💪</span>
              </div>
            </div>
            <p className="text-xl font-black text-white uppercase tracking-wide">Scanning Physique...</p>
            <p className="text-gray-400 mt-2 text-sm">AI is analyzing body composition</p>
          </div>
          <div className="card">
            <AnalysisResultSkeleton />
          </div>
        </div>
      )}

      {tabMode === 'analyze' && error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-center font-medium">{error}</div>
      )}

      {tabMode === 'analyze' && result && (
        <div className="space-y-6">
          <div className="card">
            <ResultDisplay result={result} />
          </div>

          <button
            onClick={resetState}
            className="btn-secondary w-full"
          >
            Scan New Photo
          </button>

          {/* Supplement Recommendations */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-8 bg-[var(--color-primary)] rounded-full"></span>
              RECOMMENDED STACK
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

export default memo(BodyAnalysis);
