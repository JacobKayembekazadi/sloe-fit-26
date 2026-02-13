import React, { memo } from 'react';
import type { CoachInsight } from '../hooks/useCoachingAgent';

interface CoachInsightCardProps {
  insight: CoachInsight;
  onDismiss: (id: string) => void;
  onProductClick?: (productId: string) => void;
}

const ICON_MAP: Record<string, string> = {
  post_workout: 'fitness_center',
  low_sleep: 'bedtime',
  training_streak: 'local_fire_department',
  overtraining: 'warning',
  volume_progression: 'trending_up',
  stale_workout: 'shuffle',
  milestone: 'emoji_events',
  rest_skipper: 'timer',
  recovery_checkin: 'bedtime',
  good_session: 'trending_up',
};

const CoachInsightCard: React.FC<CoachInsightCardProps> = ({
  insight,
  onDismiss,
  onProductClick,
}) => {
  const icon = ICON_MAP[insight.type] || 'psychology';
  const isMilestone = insight.type === 'milestone';

  return (
    <div className="relative rounded-2xl bg-[#1C1C1E] border-l-4 border-[var(--color-primary)] p-4 min-h-[72px] flex items-start gap-3">
      {/* Icon */}
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        isMilestone ? 'bg-yellow-500/20' : 'bg-[var(--color-primary)]/15'
      }`}>
        <span className={`material-symbols-outlined text-lg ${
          isMilestone ? 'text-yellow-400' : 'text-[var(--color-primary)]'
        }`}>
          {icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium leading-snug">
          {insight.message}
        </p>

        {/* Product CTA */}
        {insight.product && onProductClick && (
          <button
            onClick={() => onProductClick(insight.product!.productId)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-black text-xs font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">shopping_bag</span>
            {insight.product.ctaLabel}
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(insight.id)}
        className="shrink-0 size-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors -mt-1 -mr-1"
        aria-label="Dismiss insight"
      >
        <span className="material-symbols-outlined text-base text-white/40">close</span>
      </button>
    </div>
  );
};

export default memo(CoachInsightCard);
