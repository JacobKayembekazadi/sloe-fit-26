import React, { useState, useEffect, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBodyCheckins } from '../hooks/useBodyCheckins';
import { supabaseGet } from '../services/supabaseRawFetch';
import OverviewTab from './body/OverviewTab';
import AnalyticsTab from './body/AnalyticsTab';
import ProgressPhotos from './ProgressPhotos';
import ResultDisplay from './ResultDisplay';
import Skeleton from './ui/Skeleton';

interface BodyAnalysisProps {
  onAnalysisComplete: (result: string) => void;
  goal?: string | null;
  defaultWeight?: number | null;
}

type TabMode = 'overview' | 'photos' | 'analytics' | 'history';

interface SavedBodyAnalysis {
  id: string;
  result_markdown: string;
  provider: string | null;
  created_at: string;
}

const TABS: { key: TabMode; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'photos', label: 'Photos', icon: 'photo_camera' },
  { key: 'analytics', label: 'Analytics', icon: 'show_chart' },
  { key: 'history', label: 'History', icon: 'history' },
];

const BodyAnalysis: React.FC<BodyAnalysisProps> = ({ onAnalysisComplete, goal = null, defaultWeight = null }) => {
  const { user } = useAuth();
  const [tabMode, setTabMode] = useState<TabMode>('overview');
  const { checkins, loading, addCheckin, deleteCheckin, latestCheckin } = useBodyCheckins(user?.id);

  // History state (old AI analyses)
  const [aiHistory, setAiHistory] = useState<SavedBodyAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Load AI analysis history when history tab is selected
  useEffect(() => {
    if (tabMode !== 'history' || !user?.id) return;
    let cancelled = false;
    setHistoryLoading(true);
    async function load() {
      try {
        const { data } = await supabaseGet<SavedBodyAnalysis[]>(
          `body_analyses?user_id=eq.${user!.id}&order=created_at.desc&limit=20`
        );
        if (!cancelled && data) setAiHistory(data);
      } catch { /* non-critical */ }
      finally { if (!cancelled) setHistoryLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [tabMode, user?.id]);

  return (
    <div className="w-full space-y-6">
      <header>
        <h2 className="text-3xl font-black text-white tracking-tighter">BODY CHECK-IN</h2>
        <p className="text-gray-400 text-sm">Track your transformation with data.</p>
      </header>

      {/* Tab Selector */}
      <div className="flex gap-1 p-1 bg-black/30 rounded-xl" role="tablist" aria-label="Body check-in views">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tabMode === key}
            onClick={() => setTabMode(key)}
            className={`flex-1 py-2.5 px-2 rounded-lg font-bold text-xs uppercase transition-all ${
              tabMode === key
                ? 'bg-[var(--color-primary)] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && tabMode === 'overview' && (
        <div className="card space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {/* Overview Tab */}
      {tabMode === 'overview' && !loading && (
        <OverviewTab
          checkins={checkins}
          onAddCheckin={addCheckin}
          defaultWeight={latestCheckin?.weight_lbs ?? defaultWeight}
          goal={goal}
          onAnalysisComplete={onAnalysisComplete}
        />
      )}

      {/* Photos Tab */}
      {tabMode === 'photos' && (
        <ProgressPhotos />
      )}

      {/* Analytics Tab */}
      {tabMode === 'analytics' && (
        <AnalyticsTab checkins={checkins} goal={goal} />
      )}

      {/* History Tab */}
      {tabMode === 'history' && (
        <div className="space-y-4">
          {/* Check-in history */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--color-primary)] text-base">timeline</span>
              CHECK-IN LOG
            </h3>
            {checkins.length === 0 ? (
              <div className="card text-center p-6">
                <p className="text-gray-400 text-sm">No check-ins yet. Start logging on the Overview tab.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {checkins.slice(0, 20).map(entry => {
                  const date = new Date(entry.created_at);
                  return (
                    <div key={entry.id} className="card !p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-[10px] text-gray-500 uppercase font-bold">
                            {date.toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-lg font-black text-white leading-none">
                            {date.getDate()}
                          </p>
                        </div>
                        <div>
                          {entry.weight_lbs && (
                            <p className="text-white font-bold">{entry.weight_lbs} lbs</p>
                          )}
                          <div className="flex gap-3 text-xs text-gray-400">
                            {entry.body_fat_pct && <span>BF: {entry.body_fat_pct}%</span>}
                            {entry.muscle_mass_lbs && <span>Muscle: {entry.muscle_mass_lbs} lbs</span>}
                            {entry.waist_inches && <span>Waist: {entry.waist_inches}"</span>}
                          </div>
                          {entry.notes && (
                            <p className="text-gray-500 text-xs mt-0.5 italic">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteCheckin(entry.id)}
                        className="p-2 text-gray-600 hover:text-red-400 transition-colors"
                        aria-label="Delete check-in"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past AI Analyses */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-400 text-base">smart_toy</span>
              PAST AI ANALYSES
            </h3>
            {historyLoading ? (
              <div className="card"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4 mt-2" /></div>
            ) : aiHistory.length === 0 ? (
              <div className="card text-center p-6">
                <p className="text-gray-400 text-sm">No AI analyses yet. Use the Overview tab to run one.</p>
              </div>
            ) : (
              aiHistory.map(entry => {
                const date = new Date(entry.created_at);
                const isExpanded = expandedHistoryId === entry.id;
                return (
                  <div key={entry.id} className="card mb-2">
                    <button
                      onClick={() => setExpandedHistoryId(isExpanded ? null : entry.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div>
                        <p className="text-white font-bold text-sm">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {entry.provider && ` · ${entry.provider}`}
                        </p>
                      </div>
                      <span className={`material-symbols-outlined text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <ResultDisplay result={entry.result_markdown} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(BodyAnalysis);
