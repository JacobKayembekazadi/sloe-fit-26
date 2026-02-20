import React, { useMemo } from 'react';
import { calculateDelta, formatDelta, METRIC_LABELS, type BodyCheckin, type BodyMetric } from '../../utils/bodyInsights';

interface MetricBreakdownTableProps {
  checkins: BodyCheckin[];
  goal: string | null;
}

const METRICS: BodyMetric[] = ['weight_lbs', 'body_fat_pct', 'muscle_mass_lbs', 'waist_inches'];
const UNITS: Record<BodyMetric, string> = {
  weight_lbs: 'lbs',
  body_fat_pct: '%',
  muscle_mass_lbs: 'lbs',
  waist_inches: 'in',
};

const MetricBreakdownTable: React.FC<MetricBreakdownTableProps> = ({ checkins, goal }) => {
  const rows = useMemo(() => {
    return METRICS.map(metric => {
      const latest = checkins.find(c => c[metric] != null);
      const currentValue = latest ? latest[metric] as number : null;
      const delta7 = calculateDelta(checkins, metric, 7, goal);
      const delta30 = calculateDelta(checkins, metric, 30, goal);

      return { metric, currentValue, delta7, delta30 };
    }).filter(r => r.currentValue !== null); // Only show metrics with data
  }, [checkins, goal]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        Log a check-in to see your metric breakdown.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 pr-2 font-bold">Metric</th>
            <th className="text-right py-2 px-2 font-bold">Current</th>
            <th className="text-right py-2 px-2 font-bold">7D</th>
            <th className="text-right py-2 pl-2 font-bold">30D</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ metric, currentValue, delta7, delta30 }) => (
            <tr key={metric} className="border-t border-white/5">
              <td className="py-3 pr-2 text-gray-300 font-medium">{METRIC_LABELS[metric]}</td>
              <td className="py-3 px-2 text-right text-white font-bold">
                {currentValue != null ? `${currentValue} ${UNITS[metric]}` : '—'}
              </td>
              <td className="py-3 px-2 text-right">
                {delta7 ? (
                  <span className={`inline-flex items-center gap-0.5 font-medium ${delta7.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    <span className="material-symbols-outlined text-xs">
                      {delta7.direction === 'up' ? 'trending_up' : delta7.direction === 'down' ? 'trending_down' : 'trending_flat'}
                    </span>
                    {formatDelta(delta7, metric)}
                  </span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="py-3 pl-2 text-right">
                {delta30 ? (
                  <span className={`inline-flex items-center gap-0.5 font-medium ${delta30.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    <span className="material-symbols-outlined text-xs">
                      {delta30.direction === 'up' ? 'trending_up' : delta30.direction === 'down' ? 'trending_down' : 'trending_flat'}
                    </span>
                    {formatDelta(delta30, metric)}
                  </span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MetricBreakdownTable;
