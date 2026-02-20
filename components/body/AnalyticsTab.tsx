import React, { useState, memo } from 'react';
import BodyCompositionChart from './BodyCompositionChart';
import MetricBreakdownTable from './MetricBreakdownTable';
import { generateBodyInsight, type BodyCheckin } from '../../utils/bodyInsights';

type TimeRange = '7d' | '30d' | '3m' | '1y';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '3m', label: '3M' },
  { key: '1y', label: '1Y' },
];

interface AnalyticsTabProps {
  checkins: BodyCheckin[];
  goal: string | null;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ checkins, goal }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const insight = generateBodyInsight(checkins, goal);

  if (checkins.length === 0) {
    return (
      <div className="card text-center p-8">
        <span className="material-symbols-outlined text-4xl text-gray-600 mb-3">show_chart</span>
        <p className="text-gray-400 font-medium">No check-in data yet</p>
        <p className="text-gray-600 text-sm mt-1">Log your first check-in on the Overview tab to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex gap-1 p-1 bg-black/30 rounded-xl">
        {TIME_RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTimeRange(key)}
            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs uppercase transition-all ${
              timeRange === key
                ? 'bg-[var(--color-primary)] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Composition Trends Chart */}
      <div className="card">
        <h4 className="text-sm font-bold text-white mb-3">Body Composition Trends</h4>
        <BodyCompositionChart checkins={checkins} timeRange={timeRange} />
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#D4FF00] rounded"></span> Weight
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#4ade80] rounded"></span> Muscle
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#f87171] rounded"></span> Body Fat
          </span>
        </div>
      </div>

      {/* Metric Breakdown */}
      <div className="card">
        <h4 className="text-sm font-bold text-white mb-3">Metric Breakdown</h4>
        <MetricBreakdownTable checkins={checkins} goal={goal} />
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
    </div>
  );
};

export default memo(AnalyticsTab);
