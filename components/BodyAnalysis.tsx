import React, { useState, useCallback, useEffect, ChangeEvent, memo } from 'react';
import { analyzeBodyPhoto, AnnotatedImage } from '../services/aiService';
import { validateImage } from '../services/storageService';
import { useToast } from '../contexts/ToastContext';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import ResultDisplay from './ResultDisplay';
import ProductCard from './ProductCard';
import ProgressPhotos from './ProgressPhotos';
import { PRODUCT_IDS } from '../services/shopifyService';
import { safeJSONParse, safeLocalStorageSet } from '../utils/safeStorage';

interface BodyAnalysisProps {
  onAnalysisComplete: (result: string) => void;
}

type TabMode = 'analyze' | 'progress';

const STORAGE_KEY = 'sloefit_body_analysis';
const STALENESS_DAYS = 30;

interface StoredAnalysis {
  result: string;
  timestamp: number;
  photoPreview: string | null;
}

import Skeleton from './ui/Skeleton';

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
  const { showToast } = useToast();
  const [tabMode, setTabMode] = useState<TabMode>('analyze');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzeRetry, setAnalyzeRetry] = useState<(() => void) | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [restoredTimestamp, setRestoredTimestamp] = useState<number | null>(null);
  // Progressive loading phase for Agentic Vision (Gemini 3 Flash takes longer)
  const [loadingPhase, setLoadingPhase] = useState<string>('Scanning physique...');
  // Annotated images from Gemini 3 Agentic Vision
  const [annotatedImages, setAnnotatedImages] = useState<AnnotatedImage[] | undefined>(undefined);

  // Progressive loading messages for Agentic Vision (Gemini 3 Flash takes longer)
  useEffect(() => {
    if (!isLoading) {
      setLoadingPhase('Scanning physique...');
      return;
    }

    const phases = [
      { delay: 0, text: 'Scanning physique...' },
      { delay: 5000, text: 'Analyzing body composition...' },
      { delay: 12000, text: 'Examining muscle groups...' },
      { delay: 20000, text: 'Assessing posture...' },
      { delay: 30000, text: 'Generating workout plan...' },
      { delay: 45000, text: 'Finalizing recommendations...' },
    ];

    const timers = phases.map(({ delay, text }) =>
      setTimeout(() => setLoadingPhase(text), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  // Restore previous analysis from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = safeJSONParse<StoredAnalysis | null>(stored, null);
      if (!parsed || !parsed.result || !parsed.timestamp) return;

      const ageMs = Date.now() - parsed.timestamp;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (ageDays > STALENESS_DAYS) {
        // Too old to auto-restore — clear it
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      setResult(parsed.result);
      setPreview(parsed.photoPreview);
      setIsRestored(true);
      setRestoredTimestamp(parsed.timestamp);
    } catch {
      // Corrupted data — clear and move on
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

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

      // FIX T10: Use blob URL instead of base64 to reduce memory usage
      const blobUrl = URL.createObjectURL(selectedFile);
      setPreview(blobUrl);
    }
  };

  // FIX T10: Clean up blob URL when preview changes or component unmounts
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleAnalyze = useCallback(async () => {
    if (!file) {
      setError("Please upload a photo first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAnnotatedImages(undefined);
    setAnalyzeRetry(null);

    try {
      const analysisResult = await analyzeBodyPhoto(file);
      if (analysisResult.markdown.startsWith('An error occurred') || analysisResult.markdown.startsWith('Error:')) {
        setError(analysisResult.markdown);
        setAnalyzeRetry(() => handleAnalyze);
        showToast('Body analysis failed', 'error');
      } else {
        setResult(analysisResult.markdown);
        setAnnotatedImages(analysisResult.annotatedImages);
        setIsRestored(false);
        setRestoredTimestamp(null);
        onAnalysisComplete(analysisResult.markdown);
        showToast('Analysis complete', 'success');

        // Persist to localStorage (compress preview to avoid quota issues)
        try {
          let thumbPreview: string | null = null;
          if (preview) {
            try {
              const img = new Image();
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject();
                img.src = preview;
              });
              const c = document.createElement('canvas');
              const scale = Math.min(200 / img.width, 200 / img.height, 1);
              c.width = Math.round(img.width * scale);
              c.height = Math.round(img.height * scale);
              c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
              thumbPreview = c.toDataURL('image/jpeg', 0.5);
            } catch {
              thumbPreview = null;
            }
          }
          const toStore: StoredAnalysis = {
            result: analysisResult.markdown,
            timestamp: Date.now(),
            photoPreview: thumbPreview,
          };
          safeLocalStorageSet(STORAGE_KEY, JSON.stringify(toStore));
        } catch {
          // Thumbnail creation failed — save without it
        }
      }
    } catch {
      setError('Body analysis failed. Please check your connection and try again.');
      setAnalyzeRetry(() => handleAnalyze);
      showToast('Body analysis failed', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [file, preview, onAnalysisComplete, showToast]);

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsLoading(false);
    setAnalyzeRetry(null);
    setIsRestored(false);
    setRestoredTimestamp(null);
    setAnnotatedImages(undefined);
    localStorage.removeItem(STORAGE_KEY);
  };

  const dismissError = () => {
    setError(null);
    setAnalyzeRetry(null);
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
          className={`flex-1 py-3 min-h-[44px] px-4 rounded-lg font-bold text-sm uppercase transition-all ${
            tabMode === 'analyze'
              ? 'bg-[var(--color-primary)] text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          AI Analysis
        </button>
        <button
          onClick={() => setTabMode('progress')}
          className={`flex-1 py-3 min-h-[44px] px-4 rounded-lg font-bold text-sm uppercase transition-all ${
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

      {/* Loading State - Progressive phases for Agentic Vision */}
      {tabMode === 'analyze' && isLoading && (
        <div className="space-y-4">
          <div className="card flex flex-col items-center justify-center text-center p-8">
            <div className="relative mb-4">
              <div className="w-20 h-20 border-4 border-gray-700 border-t-[var(--color-primary)] rounded-full animate-spin motion-reduce:animate-none" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl">💪</span>
              </div>
            </div>
            <p className="text-xl font-black text-white uppercase tracking-wide">{loadingPhase}</p>
            <p className="text-gray-400 mt-2 text-sm">AI is examining your physique in detail</p>
          </div>
          <div className="card">
            <AnalysisResultSkeleton />
          </div>
        </div>
      )}

      {tabMode === 'analyze' && error && !isLoading && (
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

      {tabMode === 'analyze' && result && (
        <div className="space-y-6">
          {isRestored && restoredTimestamp && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
              <p className="text-sm text-blue-300">
                Previous analysis from {new Date(restoredTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          )}

          <div className="card">
            <ResultDisplay result={result} annotatedImages={annotatedImages} />
          </div>

          <button
            onClick={resetState}
            className="btn-secondary w-full"
          >
            {isRestored ? 'New Analysis' : 'Scan New Photo'}
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
