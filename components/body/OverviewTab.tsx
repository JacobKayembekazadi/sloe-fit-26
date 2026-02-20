import React, { useState, useCallback, useEffect, useRef, ChangeEvent, memo } from 'react';
import CheckinForm from './CheckinForm';
import { generateBodyInsight, calculateDelta, type BodyCheckin } from '../../utils/bodyInsights';
import { analyzeBodyPhoto } from '../../services/aiService';
import { validateImage } from '../../services/storageService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscriptionContext } from '../../contexts/SubscriptionContext';
import { PREMIUM_FEATURES } from '../../hooks/useSubscription';
import { supabaseGet, supabaseInsert } from '../../services/supabaseRawFetch';
import { safeJSONParse, safeLocalStorageSet } from '../../utils/safeStorage';
import { reportError } from '../../utils/sentryHelpers';
import ResultDisplay from '../ResultDisplay';
import ProductCard from '../ProductCard';
import { PRODUCT_IDS } from '../../services/shopifyService';
import CameraIcon from '../icons/CameraIcon';

const ANALYSIS_TIMEOUT_MS = 60000;
const STALENESS_DAYS = 30;
const getBodyStorageKey = (userId?: string) => `sloefit_body_analysis_${userId || 'anon'}`;

interface StoredAnalysis {
  result: string;
  timestamp: number;
  photoPreview: string | null;
}

interface SavedBodyAnalysis {
  id: string;
  result_markdown: string;
  provider: string | null;
  created_at: string;
}

interface OverviewTabProps {
  checkins: BodyCheckin[];
  onAddCheckin: (data: { weight_lbs: number; body_fat_pct: number | null; notes: string | null }) => Promise<boolean>;
  defaultWeight: number | null;
  goal: string | null;
  onAnalysisComplete: (result: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  checkins,
  onAddCheckin,
  defaultWeight,
  goal,
  onAnalysisComplete,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { requireSubscription } = useSubscriptionContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Photo Analysis state (preserved from old BodyAnalysis)
  const [showAiSection, setShowAiSection] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('Scanning physique...');
  const analysisCancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest metrics for summary cards
  const latest = checkins[0] || null;
  const delta7Weight = calculateDelta(checkins, 'weight_lbs', 7, goal);
  const delta7Bf = calculateDelta(checkins, 'body_fat_pct', 7, goal);
  const delta7Muscle = calculateDelta(checkins, 'muscle_mass_lbs', 7, goal);
  const insight = generateBodyInsight(checkins, goal);

  // Loading phases for AI analysis
  useEffect(() => {
    if (!aiLoading) { setLoadingPhase('Scanning physique...'); return; }
    const phases = [
      { delay: 0, text: 'Scanning physique...' },
      { delay: 3000, text: 'Analyzing body composition...' },
      { delay: 8000, text: 'Examining muscle groups...' },
      { delay: 15000, text: 'Finalizing assessment...' },
    ];
    const timers = phases.map(({ delay, text }) => setTimeout(() => setLoadingPhase(text), delay));
    return () => timers.forEach(clearTimeout);
  }, [aiLoading]);

  // Restore previous AI analysis
  useEffect(() => {
    let cancelled = false;
    async function loadLatest() {
      if (user?.id) {
        try {
          const { data } = await supabaseGet<SavedBodyAnalysis[]>(
            `body_analyses?user_id=eq.${user.id}&order=created_at.desc&limit=1`
          );
          if (!cancelled && data?.length) {
            const entry = data[0];
            const ageDays = (Date.now() - new Date(entry.created_at).getTime()) / (1000 * 60 * 60 * 24);
            if (ageDays <= STALENESS_DAYS) {
              setAiResult(entry.result_markdown);
              setIsRestored(true);
              return;
            }
          }
        } catch { /* fall through */ }
      }
      if (cancelled) return;
      try {
        const stored = localStorage.getItem(getBodyStorageKey(user?.id));
        if (!stored) return;
        const parsed = safeJSONParse<StoredAnalysis | null>(stored, null);
        if (!parsed?.result || !parsed.timestamp) return;
        if ((Date.now() - parsed.timestamp) / 86_400_000 > STALENESS_DAYS) {
          localStorage.removeItem(getBodyStorageKey(user?.id));
          return;
        }
        if (!cancelled) {
          setAiResult(parsed.result);
          setPreview(parsed.photoPreview);
          setIsRestored(true);
        }
      } catch { localStorage.removeItem(getBodyStorageKey(user?.id)); }
    }
    loadLatest();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Clean up blob URL
  useEffect(() => {
    return () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); };
  }, [preview]);

  const handleCheckin = useCallback(async (data: { weight_lbs: number; body_fat_pct: number | null; notes: string | null }) => {
    setIsSubmitting(true);
    const success = await onAddCheckin(data);
    setIsSubmitting(false);
    if (success) showToast('Check-in logged!', 'success');
    return success;
  }, [onAddCheckin, showToast]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0];
      const validation = validateImage(selectedFile);
      if (!validation.valid) { setAiError(validation.error || 'Invalid image'); return; }
      setFile(selectedFile);
      setAiResult(null);
      setAiError(null);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleCancelAnalysis = useCallback(() => {
    analysisCancelledRef.current = true;
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setAiLoading(false);
    showToast('Cancelled.', 'info');
  }, [showToast]);

  const handleAnalyze = useCallback(async () => {
    if (!requireSubscription(PREMIUM_FEATURES.BODY_ANALYSIS)) return;
    if (!file) { setAiError('Please upload a photo first.'); return; }
    analysisCancelledRef.current = false;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    timeoutRef.current = setTimeout(() => {
      if (!analysisCancelledRef.current) {
        analysisCancelledRef.current = true;
        setAiLoading(false);
        setAiError('Analysis timed out. Try a smaller image.');
        showToast('Timed out.', 'error');
      }
    }, ANALYSIS_TIMEOUT_MS);

    try {
      const analysisResult = await analyzeBodyPhoto(file);
      if (analysisCancelledRef.current) return;
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      if (analysisResult.markdown.startsWith('An error occurred') || analysisResult.markdown.startsWith('Error:')) {
        setAiError('Analysis failed. Try a different photo.');
        showToast('Analysis failed.', 'error');
      } else {
        setAiResult(analysisResult.markdown);
        setIsRestored(false);
        onAnalysisComplete(analysisResult.markdown);
        showToast('Analysis done.', 'success');
        // Persist
        try {
          const toStore: StoredAnalysis = { result: analysisResult.markdown, timestamp: Date.now(), photoPreview: null };
          safeLocalStorageSet(getBodyStorageKey(user?.id), JSON.stringify(toStore));
        } catch { /* */ }
      }
    } catch (err) {
      if (analysisCancelledRef.current) return;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      reportError(err, { category: 'ai', operation: 'analyzeBodyPhoto', userId: user?.id });
      setAiError(`Analysis failed: ${msg}`);
      showToast('Analysis failed.', 'error');
    } finally {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      if (!analysisCancelledRef.current) setAiLoading(false);
    }
  }, [file, onAnalysisComplete, showToast, user?.id, requireSubscription]);

  return (
    <div className="space-y-4">
      {/* Metric Summary Cards */}
      {latest && (
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            icon="monitor_weight"
            label="Weight"
            value={latest.weight_lbs != null ? `${latest.weight_lbs}` : '—'}
            unit="lbs"
            delta={delta7Weight}
          />
          <MetricCard
            icon="water_drop"
            label="Body Fat"
            value={latest.body_fat_pct != null ? `${latest.body_fat_pct}` : '—'}
            unit="%"
            delta={delta7Bf}
          />
          <MetricCard
            icon="fitness_center"
            label="Muscle"
            value={latest.muscle_mass_lbs != null ? `${latest.muscle_mass_lbs}` : '—'}
            unit="lbs"
            delta={delta7Muscle}
          />
        </div>
      )}

      {/* Check-in Form */}
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--color-primary)] text-base">add_circle</span>
          LOG CHECK-IN
        </h3>
        <CheckinForm
          onSubmit={handleCheckin}
          defaultWeight={latest?.weight_lbs ?? defaultWeight}
          isSubmitting={isSubmitting}
        />
      </div>

      {/* AI Insight */}
      {insight && (
        <div className="card border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[var(--color-primary)]">insights</span>
            <div>
              <h4 className="text-xs font-bold text-[var(--color-primary)] uppercase mb-1">Trend Insight</h4>
              <p className="text-gray-300 text-sm">{insight}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Photo Analysis — Collapsible */}
      <div className="card">
        <button
          onClick={() => setShowAiSection(!showAiSection)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-400">photo_camera</span>
            <span className="text-sm font-bold text-white">AI Photo Analysis</span>
          </div>
          <span className={`material-symbols-outlined text-gray-400 transition-transform ${showAiSection ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {showAiSection && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
            {/* Show restored result or upload area */}
            {aiResult && !aiLoading ? (
              <div className="space-y-4">
                {isRestored && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-sm text-blue-300">Previous analysis — upload a new photo for updated results.</p>
                  </div>
                )}
                <ResultDisplay result={aiResult} />
                <button
                  onClick={() => { setAiResult(null); setFile(null); setPreview(null); setIsRestored(false); }}
                  className="btn-secondary w-full text-sm"
                >
                  New Analysis
                </button>

                {/* Supplement Recommendations */}
                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-[var(--color-primary)] rounded-full"></span>
                    RECOMMENDED STACK
                  </h3>
                  <div className="space-y-3">
                    {(() => {
                      const lower = (aiResult || '').toLowerCase();
                      const wantsBulk = lower.includes('bulk') || lower.includes('mass') || lower.includes('muscle');
                      const wantsCut = lower.includes('cut') || lower.includes('fat loss') || lower.includes('body fat');
                      return (
                        <>
                          {(!wantsCut || wantsBulk) && <ProductCard productId={PRODUCT_IDS.CREATINE} />}
                          {(wantsCut || !wantsBulk) && <ProductCard productId={PRODUCT_IDS.PRE_WORKOUT} />}
                          {wantsBulk && PRODUCT_IDS.WHEY_PROTEIN && <ProductCard productId={PRODUCT_IDS.WHEY_PROTEIN} />}
                          {wantsCut && PRODUCT_IDS.FAT_BURNER && <ProductCard productId={PRODUCT_IDS.FAT_BURNER} />}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : aiLoading ? (
              <div className="flex flex-col items-center justify-center text-center py-6">
                <div className="relative mb-3">
                  <div className="w-16 h-16 border-4 border-gray-700 border-t-[var(--color-primary)] rounded-full animate-spin motion-reduce:animate-none" />
                </div>
                <p className="text-lg font-black text-white uppercase">{loadingPhase}</p>
                <p className="text-gray-400 text-sm mt-1">AI is examining your physique</p>
                <button onClick={handleCancelAnalysis} className="mt-3 px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg">
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <input type="file" id="body-ai-upload" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} />
                <label
                  htmlFor="body-ai-upload"
                  className="w-full aspect-[4/5] max-w-sm mx-auto cursor-pointer border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center hover:border-[var(--color-primary)] hover:bg-white/5 transition-all relative overflow-hidden group"
                >
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-500 group-hover:text-white transition-colors">
                      <div className="p-3 bg-gray-800 rounded-full mb-3 group-hover:bg-[var(--color-primary)] group-hover:text-black transition-colors">
                        <CameraIcon className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-sm uppercase">Upload Photo</span>
                      <p className="text-xs mt-1 text-center px-4">Front-facing photo for AI analysis</p>
                    </div>
                  )}
                </label>
                {aiError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{aiError}</p>
                  </div>
                )}
                {file && (
                  <button onClick={handleAnalyze} disabled={aiLoading} className="btn-primary w-full">
                    Analyze Physique
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Small metric card component
const MetricCard = memo(({ icon, label, value, unit, delta }: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  delta: { value: number; direction: string; isPositive: boolean } | null;
}) => (
  <div className="card !p-3 text-center">
    <span className="material-symbols-outlined text-gray-500 text-base">{icon}</span>
    <p className="text-lg font-black text-white mt-1">
      {value}
      {value !== '—' && <span className="text-xs text-gray-400 ml-0.5">{unit}</span>}
    </p>
    <p className="text-[10px] text-gray-500 uppercase font-bold">{label}</p>
    {delta && (
      <p className={`text-xs font-medium mt-1 ${delta.isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {delta.value > 0 ? '+' : ''}{delta.value}
      </p>
    )}
  </div>
));
MetricCard.displayName = 'MetricCard';

export default memo(OverviewTab);
