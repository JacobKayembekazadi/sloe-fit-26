import React, { memo, useState, useEffect } from 'react';
import type { CoachInsight } from '../hooks/useCoachingAgent';

interface PostWorkoutCoachingProps {
  insight: CoachInsight | null;
  isLoading?: boolean;
  onProductClick?: (productId: string) => void;
}

const PostWorkoutCoaching: React.FC<PostWorkoutCoachingProps> = ({
  insight,
  isLoading = false,
  onProductClick,
}) => {
  // Fade in animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (insight || isLoading) {
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [insight, isLoading]);

  if (!insight && !isLoading) return null;

  return (
    <div className={`mx-3 sm:mx-4 mt-4 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <div className="p-4 rounded-xl bg-[#1a2e20] border border-white/5 shadow-sm">
        {isLoading ? (
          /* Loading spinner — no text per SOUL.md */
          <div className="flex items-center justify-center py-2">
            <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
          </div>
        ) : insight ? (
          <>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[var(--color-primary)] shrink-0">psychology</span>
              <p className="text-sm text-white/90 leading-relaxed font-medium">
                {insight.message}
              </p>
            </div>

            {/* Product CTA */}
            {insight.product && onProductClick && (
              <button
                onClick={() => onProductClick(insight.product!.productId)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-black text-sm font-bold rounded-lg hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-base">shopping_bag</span>
                {insight.product.ctaLabel}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default memo(PostWorkoutCoaching);
