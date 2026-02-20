import React, { useState, useCallback, useEffect, ChangeEvent, memo, useRef } from 'react';
import { analyzeBodyPhoto } from '../services/aiService';
import { validateImage } from '../services/storageService';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { supabaseGet } from '../services/supabaseRawFetch';
import CameraIcon from './icons/CameraIcon';
import LoaderIcon from './icons/LoaderIcon';
import ResultDisplay from './ResultDisplay';
import ProductCard from './ProductCard';
import ProgressPhotos from './ProgressPhotos';
import { PRODUCT_IDS } from '../services/shopifyService';
import { safeJSONParse, safeLocalStorageSet } from '../utils/safeStorage';
import { reportError } from '../utils/sentryHelpers';
import { useSubscriptionContext } from '../contexts/SubscriptionContext';
import { PREMIUM_FEATURES } from '../hooks/useSubscription';

// H4 FIX: Timeout for body analysis (60 seconds)
const ANALYSIS_TIMEOUT_MS = 60000;

interface BodyAnalysisProps {
  onAnalysisComplete: (result: string) => void;
}

type TabMode = 'analyze' | 'progress' | 'history';

// Namespaced by userId to prevent cross-user body photo leaks on shared devices
const getBodyStorageKey = (userId?: string) => `sloefit_body_analysis_${userId || 'anon'}`;
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

interface SavedBodyAnalysis {
  id: string;
  result_markdown: string;
  provider: string | null;
  created_at: string;
}

const BodyAnalysis: React.FC<BodyAnalysisProps> = ({ onAnalysisComplete }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [tabMode, setTabMode] = useState<TabMode>('analyze');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzeRetry, setAnalyzeRetry] = useState<(() => void) | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [restoredTimestamp, setRestoredTimestamp] = useState<number | null>(null);
  // History state
  const [history, setHistory] = useState<SavedBodyAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  // Progressive loading phase for AI analysis
  const [loadingPhase, setLoadingPhase] = useState<string>('Scanning physique...');
  // H4 FIX: Track if user cancelled or timed out
  const analysisCancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setLoadingPhase('Scanning physique...');
      return;
    }

    const phases = [
      { delay: 0, text: 'Scanning physique...' },
      { delay: 3000, text: 'Analyzing body composition...' },
      { delay: 8000, text: 'Examining muscle groups...' },
      { delay: 15000, text: 'Finalizing assessment...' },
    ];

    const timers = phases.map(({ delay, text }) =>
      setTimeout(() => setLoadingPhase(text), delay)
    );

    return () => timers.forEach(clearTimeout);
  }, [isLoading]);

  // Restore previous analysis: try DB first, fall back to localStorage
  useEffect(() => {
    let cancelled = false;

    async function loadLatestAnalysis() {
      // Try DB first if user is logged in
      if (user?.id) {
        try {
          const { data } = await supabaseGet<SavedBodyAnalysis[]>(
            `body_analyses?user_id=eq.${user.id}&order=created_at.desc&limit=1`
          );
          if (!cancelled && data && data.length > 0) {
            const entry = data[0];
            const ageMs = Date.now() - new Date(entry.created_at).getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);
            if (ageDays <= STALENESS_DAYS) {
              setResult(entry.result_markdown);
              setIsRestored(true);
              setRestoredTimestamp(new Date(entry.created_at).getTime());
              return;
            }
          }
        } catch {
          // DB fetch failed — fall through to localStorage
        }
      }

      // Fallback: localStorage
      if (cancelled) return;
      try {
        const stored = localStorage.getItem(getBodyStorageKey(user?.id));
        if (!stored) return;

        const parsed = safeJSONParse<StoredAnalysis | null>(stored, null);
        if (!parsed || !parsed.result || !parsed.timestamp) return;

        const ageMs = Date.now() - parsed.timestamp;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        if (ageDays > STALENESS_DAYS) {
          localStorage.removeItem(getBodyStorageKey(user?.id));
          return;
        }

        if (!cancelled) {
          setResult(parsed.result);
          setPreview(parsed.photoPreview);
          setIsRestored(true);
          setRestoredTimestamp(parsed.timestamp);
        }
      } catch {
        localStorage.removeItem(getBodyStorageKey(user?.id));
      }
    }

    loadLatestAnalysis();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load analysis history when history tab is selected
  useEffect(() => {
    if (tabMode !== 'history' || !user?.id) return;
    let cancelled = false;
    setHistoryLoading(true);

    async function loadHistory() {
      try {
        const { data } = await supabaseGet<SavedBodyAnalysis[]>(
          `body_analyses?user_id=eq.${user!.id}&order=created_at.desc&limit=20`
        );
        if (!cancelled && data) {
          setHistory(data);
        }
      } catch {
        // Silent fail — history is non-critical
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [tabMode, user?.id]);

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

  // H4 FIX: Cancel ongoing analysis
  const handleCancelAnalysis = useCallback(() => {
    analysisCancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLoading(false);
    setLoadingPhase('Scanning physique...');
    showToast('Cancelled.', 'info');
  }, [showToast]);

  const { requireSubscription } = useSubscriptionContext();

  const handleAnalyze = useCallback(async () => {
    if (!requireSubscription(PREMIUM_FEATURES.BODY_ANALYSIS)) return;
    if (!file) {
      setError("Please upload a photo first.");
      return;
    }

    // H4 FIX: Reset cancellation flag
    analysisCancelledRef.current = false;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setAnalyzeRetry(null);

    // H4 FIX: Set timeout for analysis
    timeoutRef.current = setTimeout(() => {
      if (!analysisCancelledRef.current) {
        analysisCancelledRef.current = true;
        setIsLoading(false);
        setError('Analysis timed out. Please try again with a smaller image or better connection.');
        setAnalyzeRetry(() => handleAnalyze);
        showToast('Timed out. Try a smaller photo.', 'error');
      }
    }, ANALYSIS_TIMEOUT_MS);

    try {
      const analysisResult = await analyzeBodyPhoto(file);

      // H4 FIX: Check if cancelled before processing result
      if (analysisCancelledRef.current) {
        return;
      }

      // Clear timeout on success
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (analysisResult.markdown.startsWith('An error occurred') || analysisResult.markdown.startsWith('Error:')) {
        const errorMsg = analysisResult.markdown.replace(/^(An error occurred|Error):\s*/i, '');
        console.error('[BodyAnalysis] Analysis returned error:', errorMsg);
        reportError(new Error(errorMsg), {
          category: 'ai',
          operation: 'analyzeBodyPhoto',
          severity: 'warning',
          context: { responseType: 'soft_error', fullMessage: analysisResult.markdown.substring(0, 500) },
          userId: user?.id,
        });

        // Map error keywords to actionable user messages
        const lower = errorMsg.toLowerCase();
        let userMessage: string;
        let toastMsg: string;
        if (lower.includes('content') || lower.includes('filter') || lower.includes('moderation') || lower.includes('safety')) {
          userMessage = 'The AI flagged this image. Try a different angle or ensure good lighting with a neutral background.';
          toastMsg = 'Image flagged. Try a different angle.';
        } else if (lower.includes('rate') || lower.includes('limit') || lower.includes('too many')) {
          userMessage = 'You\'ve hit the analysis limit. Wait 60 seconds before trying again.';
          toastMsg = 'Rate limit. Wait 60s.';
        } else if (lower.includes('timeout') || lower.includes('took too long')) {
          userMessage = 'Analysis timed out. Try a smaller image or check your connection.';
          toastMsg = 'Timed out. Try smaller image.';
        } else if (lower.includes('subscription') || lower.includes('trial')) {
          userMessage = errorMsg;
          toastMsg = 'Subscription required.';
        } else if (lower.includes('large') || lower.includes('size')) {
          userMessage = 'Image is too large. Use a photo under 2MB or take a new one at lower resolution.';
          toastMsg = 'Image too large.';
        } else {
          userMessage = 'Analysis failed. Try again, or use a different photo if the issue persists.';
          toastMsg = 'Analysis failed. Try again.';
        }
        setError(userMessage);
        setAnalyzeRetry(() => handleAnalyze);
        showToast(toastMsg, 'error');
      } else {
        setResult(analysisResult.markdown);
        setIsRestored(false);
        setRestoredTimestamp(null);
        onAnalysisComplete(analysisResult.markdown);
        showToast('Analysis done.', 'success');

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
          safeLocalStorageSet(getBodyStorageKey(user?.id), JSON.stringify(toStore));
        } catch {
          // Thumbnail creation failed — save without it
        }
      }
    } catch (err) {
      // H4 FIX: Don't show error if cancelled
      if (analysisCancelledRef.current) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : 'Unknown error');
      console.error('[BodyAnalysis] Exception during analysis:', errorMessage, err);
      reportError(err, {
        category: 'ai',
        operation: 'analyzeBodyPhoto',
        context: { errorMessage, fileSize: file?.size, fileType: file?.type },
        userId: user?.id,
      });
      // Map exception messages to actionable guidance
      const lower = errorMessage.toLowerCase();
      let userError: string;
      if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
        userError = 'Connection issue. Check your internet and try again.';
      } else if (lower.includes('timeout') || lower.includes('abort')) {
        userError = 'Request timed out. Try a smaller image or better connection.';
      } else if (lower === 'unknown error') {
        userError = 'Something went wrong. Try again, or use a different photo.';
      } else {
        userError = `Analysis failed: ${errorMessage}`;
      }
      setError(userError);
      setAnalyzeRetry(() => handleAnalyze);
      showToast("Analysis failed. Try again.", 'error');
    } finally {
      // H4 FIX: Clear timeout and only update loading if not cancelled
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (!analysisCancelledRef.current) {
        setIsLoading(false);
      }
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
    localStorage.removeItem(getBodyStorageKey(user?.id));
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
      <div className="flex gap-2 p-1 bg-black/30 rounded-xl" role="tablist" aria-label="Body analysis views">
        <button
          role="tab"
          aria-selected={tabMode === 'analyze'}
          aria-controls="panel-analyze"
          id="tab-analyze"
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
          role="tab"
          aria-selected={tabMode === 'history'}
          aria-controls="panel-history"
          id="tab-history"
          onClick={() => setTabMode('history')}
          className={`flex-1 py-3 min-h-[44px] px-4 rounded-lg font-bold text-sm uppercase transition-all ${
            tabMode === 'history'
              ? 'bg-[var(--color-primary)] text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          History
        </button>
        <button
          role="tab"
          aria-selected={tabMode === 'progress'}
          aria-controls="panel-progress"
          id="tab-progress"
          onClick={() => setTabMode('progress')}
          className={`flex-1 py-3 min-h-[44px] px-4 rounded-lg font-bold text-sm uppercase transition-all ${
            tabMode === 'progress'
              ? 'bg-[var(--color-primary)] text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Progress
        </button>
      </div>

      {/* History Tab */}
      {tabMode === 'history' && (
        <div className="space-y-4" role="tabpanel" id="panel-history" aria-labelledby="tab-history">
          {historyLoading ? (
            <div className="card"><AnalysisResultSkeleton /></div>
          ) : history.length === 0 ? (
            <div className="card text-center p-8">
              <p className="text-gray-400">No past analyses yet. Run your first analysis to start tracking.</p>
            </div>
          ) : (
            history.map((entry) => {
              const date = new Date(entry.created_at);
              const isExpanded = expandedHistoryId === entry.id;
              return (
                <div key={entry.id} className="card">
                  <button
                    onClick={() => setExpandedHistoryId(isExpanded ? null : entry.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-white font-bold">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {entry.provider && ` · ${entry.provider}`}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <ResultDisplay result={entry.result_markdown} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Progress Photos Tab */}
      {tabMode === 'progress' && (
        <div className="card" role="tabpanel" id="panel-progress" aria-labelledby="tab-progress">
          <ProgressPhotos />
        </div>
      )}

      {/* AI Analysis Tab */}
      {tabMode === 'analyze' && !result && !isLoading && (
        <div className="card flex flex-col items-center p-8" role="tabpanel" id="panel-analyze" aria-labelledby="tab-analyze">
          <input
            type="file"
            id="body-photo-upload"
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            aria-label="Upload body photo for AI analysis"
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
                <span className="font-bold uppercase tracking-wide">See Your Starting Point</span>
                <p className="text-xs mt-2 text-center px-4">Upload a front-facing photo for AI analysis</p>
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

      {/* Loading State */}
      {tabMode === 'analyze' && isLoading && (
        <div className="space-y-4" role="status" aria-live="polite" aria-label="Analyzing body photo">
          <div className="card flex flex-col items-center justify-center text-center p-8">
            <div className="relative mb-4" aria-hidden="true">
              <div className="w-20 h-20 border-4 border-gray-700 border-t-[var(--color-primary)] rounded-full animate-spin motion-reduce:animate-none" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl">💪</span>
              </div>
            </div>
            <p className="text-xl font-black text-white uppercase tracking-wide">{loadingPhase}</p>
            <p className="text-gray-400 mt-2 text-sm">AI is examining your physique in detail</p>
            {/* Progress bar — fills over analysis timeout duration */}
            <div className="w-full max-w-xs mt-4 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary)] rounded-full"
                style={{
                  animation: `progressFill ${ANALYSIS_TIMEOUT_MS / 1000}s linear forwards`,
                }}
              />
            </div>
            <style>{`@keyframes progressFill { from { width: 0%; } to { width: 100%; } }`}</style>
            {/* H4 FIX: Cancel button for long-running analysis */}
            <button
              onClick={handleCancelAnalysis}
              aria-label="Cancel body analysis"
              className="mt-4 px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="card">
            <AnalysisResultSkeleton />
          </div>
        </div>
      )}

      {tabMode === 'analyze' && error && !isLoading && (
        <div className="card border border-red-500/30 bg-red-500/5" role="alert">
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
        <div className="space-y-6" role="tabpanel" id="panel-analyze" aria-labelledby="tab-analyze">
          {isRestored && restoredTimestamp && (() => {
            const ageDays = Math.floor((Date.now() - restoredTimestamp) / (1000 * 60 * 60 * 24));
            const isStale = ageDays > 7;
            return (
              <div className={`${isStale ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'} border rounded-lg p-3`}>
                <p className={`text-sm ${isStale ? 'text-amber-300' : 'text-blue-300'}`}>
                  {isStale
                    ? `This analysis is ${ageDays} days old. Take a new photo for accurate tracking.`
                    : `Previous analysis from ${new Date(restoredTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  }
                </p>
              </div>
            );
          })()}

          <div className="card">
            <ResultDisplay result={result} />
          </div>

          <button
            onClick={resetState}
            className="btn-secondary w-full"
          >
            {isRestored ? 'New Analysis' : 'Scan New Photo'}
          </button>

          {/* Supplement Recommendations — personalized based on analysis */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-8 bg-[var(--color-primary)] rounded-full"></span>
              RECOMMENDED STACK
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {(() => {
                const lower = (result || '').toLowerCase();
                const wantsBulk = lower.includes('bulk') || lower.includes('mass') || lower.includes('lean') || lower.includes('underweight') || lower.includes('muscle');
                const wantsCut = lower.includes('cut') || lower.includes('fat loss') || lower.includes('overweight') || lower.includes('body fat') || lower.includes('lean out');
                const wantsEndurance = lower.includes('cardio') || lower.includes('endurance') || lower.includes('stamina');

                return (
                  <>
                    {/* Creatine: always good for bulking/muscle, skip if purely cardio-focused */}
                    {(!wantsEndurance || wantsBulk) && <ProductCard productId={PRODUCT_IDS.CREATINE} />}
                    {/* Pre-workout: good for everyone except pure bulk/recovery focus */}
                    {(wantsEndurance || wantsCut || !wantsBulk) && <ProductCard productId={PRODUCT_IDS.PRE_WORKOUT} />}
                    {/* Whey protein: show for bulk/muscle building */}
                    {wantsBulk && PRODUCT_IDS.WHEY_PROTEIN && <ProductCard productId={PRODUCT_IDS.WHEY_PROTEIN} />}
                    {/* Fat burner: show for cut/fat loss goals */}
                    {wantsCut && PRODUCT_IDS.FAT_BURNER && <ProductCard productId={PRODUCT_IDS.FAT_BURNER} />}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(BodyAnalysis);
