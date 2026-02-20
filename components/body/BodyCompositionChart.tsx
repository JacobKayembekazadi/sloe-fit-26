import React, { useMemo, memo, useCallback, useState, useRef, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { BodyCheckin } from '../../utils/bodyInsights';

type TimeRange = '7d' | '30d' | '3m' | '1y';

interface BodyCompositionChartProps {
  checkins: BodyCheckin[];
  timeRange: TimeRange;
}

interface ChartPoint {
  date: string;
  formattedDate: string;
  weight: number | null;
  bodyFat: number | null;
  muscleMass: number | null;
}

const RANGE_DAYS: Record<TimeRange, number> = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '1y': 365,
};

const COLORS = {
  weight: '#D4FF00',
  bodyFat: '#f87171',
  muscleMass: '#4ade80',
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Custom multi-metric tooltip
const ChartTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#2C2C2E] border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.value != null ? entry.value : '—'}
          {entry.dataKey === 'bodyFat' ? '%' : entry.dataKey === 'weight' || entry.dataKey === 'muscleMass' ? ' lbs' : ''}
        </p>
      ))}
    </div>
  );
});
ChartTooltip.displayName = 'ChartTooltip';

const BodyCompositionChart: React.FC<BodyCompositionChartProps> = ({ checkins, timeRange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // ResizeObserver guard (from ProgressChart pattern)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkDimensions = () => {
      const { offsetWidth, offsetHeight } = container;
      if (offsetWidth > 0 && offsetHeight > 0) setIsReady(true);
    };

    checkDimensions();
    const frameId = requestAnimationFrame(checkDimensions);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) setIsReady(true);
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, []);

  // Filter by time range and transform to chart data
  const chartData = useMemo(() => {
    const cutoff = Date.now() - RANGE_DAYS[timeRange] * 86_400_000;
    const filtered = checkins
      .filter(c => new Date(c.created_at).getTime() >= cutoff)
      .reverse(); // oldest first for chart

    return filtered.map((c): ChartPoint => ({
      date: c.created_at,
      formattedDate: formatDate(c.created_at),
      weight: c.weight_lbs,
      bodyFat: c.body_fat_pct,
      muscleMass: c.muscle_mass_lbs,
    }));
  }, [checkins, timeRange]);

  // Detect which metrics have data
  const hasWeight = chartData.some(d => d.weight != null);
  const hasBodyFat = chartData.some(d => d.bodyFat != null);
  const hasMuscleMass = chartData.some(d => d.muscleMass != null);
  const hasPctData = hasBodyFat; // for right Y-axis

  const renderTooltip = useCallback((props: any) => <ChartTooltip {...props} />, []);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
        No data for this period. Log check-ins to see trends.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-48" style={{ minWidth: 1, minHeight: 1 }}>
      {isReady && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="formattedDate"
              tick={{ fill: '#6B7280', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            {/* Left Y-axis for weight (lbs) */}
            <YAxis
              yAxisId="left"
              tick={{ fill: '#6B7280', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            {/* Right Y-axis for percentages */}
            {hasPctData && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
            )}
            <Tooltip content={renderTooltip} />
            {hasWeight && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="weight"
                name="Weight"
                stroke={COLORS.weight}
                strokeWidth={2}
                dot={{ fill: COLORS.weight, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: COLORS.weight }}
                connectNulls
              />
            )}
            {hasMuscleMass && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="muscleMass"
                name="Muscle"
                stroke={COLORS.muscleMass}
                strokeWidth={2}
                dot={{ fill: COLORS.muscleMass, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: COLORS.muscleMass }}
                connectNulls
              />
            )}
            {hasBodyFat && (
              <Line
                yAxisId={hasPctData ? 'right' : 'left'}
                type="monotone"
                dataKey="bodyFat"
                name="Body Fat"
                stroke={COLORS.bodyFat}
                strokeWidth={2}
                dot={{ fill: COLORS.bodyFat, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: COLORS.bodyFat }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default memo(BodyCompositionChart);
