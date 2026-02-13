/**
 * useCoachingAgent — React hook wrapping the portable coaching engine
 *
 * Handles localStorage persistence, deduplication, and insight management.
 * The engine itself (coachingEngine.ts) is pure logic with no React dependency.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  detectPatterns,
  getAutoAdjustments,
  getFallbackMessage,
  type CoachEvent,
  type DetectedPattern,
  type AutoAdjustment,
} from '../services/coachingEngine';
import { getProductRecommendation, type ProductRecommendation } from '../data/productRecommendations';

// ============================================================================
// Types
// ============================================================================

export interface CoachInsight {
  id: string;
  type: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  product?: ProductRecommendation;
  createdAt: number;
  dismissedAt?: number;
}

interface UseCoachingAgentReturn {
  insights: CoachInsight[];
  captureEvent: (event: Omit<CoachEvent, 'timestamp'>) => void;
  dismissInsight: (id: string) => void;
  getAdjustments: () => AutoAdjustment;
  generatePostWorkoutInsight: (workoutData: Record<string, unknown>) => CoachInsight | null;
}

// ============================================================================
// Constants
// ============================================================================

const EVENTS_KEY_PREFIX = 'sloefit_coach_events';
const INSIGHTS_KEY_PREFIX = 'sloefit_coach_insights';
const MAX_EVENTS = 100;
const MAX_ACTIVE_INSIGHTS = 2;
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_EVENT_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_DISMISSED_INSIGHTS = 20; // Cap dismissed insights to prevent unbounded growth

// ============================================================================
// localStorage helpers — namespaced by userId
// ============================================================================

function getEventsKey(userId?: string): string {
  return userId ? `${EVENTS_KEY_PREFIX}_${userId}` : EVENTS_KEY_PREFIX;
}

function getInsightsKey(userId?: string): string {
  return userId ? `${INSIGHTS_KEY_PREFIX}_${userId}` : INSIGHTS_KEY_PREFIX;
}

function loadEvents(userId?: string): CoachEvent[] {
  try {
    const raw = localStorage.getItem(getEventsKey(userId));
    if (!raw) return [];
    const events = JSON.parse(raw) as CoachEvent[];
    if (!Array.isArray(events)) return [];
    // Discard stale events older than 30 days
    const cutoff = Date.now() - MAX_EVENT_AGE_MS;
    return events.filter(e => e.timestamp > cutoff);
  } catch {
    return [];
  }
}

function saveEvents(events: CoachEvent[], userId?: string): void {
  try {
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(getEventsKey(userId), JSON.stringify(trimmed));
  } catch {
    // Storage full — evict oldest events and retry once
    try {
      const reduced = events.slice(-Math.floor(MAX_EVENTS / 2));
      localStorage.setItem(getEventsKey(userId), JSON.stringify(reduced));
    } catch {
      // Still full — silently fail
    }
  }
}

function loadInsights(userId?: string): CoachInsight[] {
  try {
    const raw = localStorage.getItem(getInsightsKey(userId));
    if (!raw) return [];
    const insights = JSON.parse(raw) as CoachInsight[];
    if (!Array.isArray(insights)) return [];
    return insights;
  } catch {
    return [];
  }
}

function saveInsights(insights: CoachInsight[], userId?: string): void {
  try {
    localStorage.setItem(getInsightsKey(userId), JSON.stringify(insights));
  } catch {
    // Storage full — keep only active insights and recent dismissed
    try {
      const active = insights.filter(i => !i.dismissedAt);
      localStorage.setItem(getInsightsKey(userId), JSON.stringify(active));
    } catch {
      // Still full — silently fail
    }
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useCoachingAgent(programDay?: number, userId?: string): UseCoachingAgentReturn {
  const [insights, setInsights] = useState<CoachInsight[]>(() => {
    const stored = loadInsights(userId);
    const now = Date.now();
    // Prune: remove dismissed insights older than 24h, cap total dismissed
    const active = stored.filter(i => !i.dismissedAt);
    const recentDismissed = stored
      .filter(i => i.dismissedAt && now - i.dismissedAt < DEDUP_WINDOW_MS)
      .slice(0, MAX_DISMISSED_INSIGHTS);
    return [...active, ...recentDismissed];
  });

  const eventsRef = useRef<CoachEvent[]>(loadEvents(userId));
  const userIdRef = useRef(userId);

  // Reinitialize when userId changes (login/logout)
  useEffect(() => {
    if (userIdRef.current !== userId) {
      userIdRef.current = userId;
      eventsRef.current = loadEvents(userId);
      const stored = loadInsights(userId);
      const now = Date.now();
      const active = stored.filter(i => !i.dismissedAt);
      const recentDismissed = stored
        .filter(i => i.dismissedAt && now - i.dismissedAt < DEDUP_WINDOW_MS)
        .slice(0, MAX_DISMISSED_INSIGHTS);
      setInsights([...active, ...recentDismissed]);
    }
  }, [userId]);

  // Persist insights when they change
  useEffect(() => {
    saveInsights(insights, userIdRef.current);
  }, [insights]);

  /**
   * Convert a detected pattern into a CoachInsight
   */
  const patternToInsight = useCallback((pattern: DetectedPattern): CoachInsight => {
    const message = getFallbackMessage(pattern);
    const product = getProductRecommendation(pattern.productKey);

    return {
      id: `${pattern.type}_${Date.now()}`,
      type: pattern.type,
      message,
      priority: pattern.priority,
      product: product || undefined,
      createdAt: Date.now(),
    };
  }, []);

  /**
   * Process patterns and update insights (max 2 active, deduped)
   * Uses functional updater to avoid stale closure on `insights`
   */
  const processPatterns = useCallback((patterns: DetectedPattern[]) => {
    if (patterns.length === 0) return;

    setInsights(prev => {
      const now = Date.now();
      const newInsights: CoachInsight[] = [];

      for (const pattern of patterns) {
        // Dedup check against current state (not stale closure)
        const isDupe = prev.some(
          i => i.type === pattern.type && now - i.createdAt < DEDUP_WINDOW_MS
        );
        if (isDupe) continue;

        newInsights.push(patternToInsight(pattern));
        if (newInsights.length >= MAX_ACTIVE_INSIGHTS) break;
      }

      if (newInsights.length === 0) return prev;

      // Keep dismissed insights for dedup, add new active ones
      const dismissed = prev.filter(i => i.dismissedAt).slice(0, MAX_DISMISSED_INSIGHTS);
      const existingActive = prev.filter(i => !i.dismissedAt);
      const allActive = [...newInsights, ...existingActive].slice(0, MAX_ACTIVE_INSIGHTS);
      return [...allActive, ...dismissed];
    });
  }, [patternToInsight]);

  /**
   * Capture a coaching event and run pattern detection
   */
  const captureEvent = useCallback((event: Omit<CoachEvent, 'timestamp'>) => {
    const fullEvent: CoachEvent = {
      ...event,
      timestamp: Date.now(),
    };

    eventsRef.current = [...eventsRef.current, fullEvent];
    saveEvents(eventsRef.current, userIdRef.current);

    // Run pattern detection
    const patterns = detectPatterns(eventsRef.current, programDay);
    processPatterns(patterns);
  }, [programDay, processPatterns]);

  /**
   * Dismiss an insight (hides it, prevents re-showing for 24h)
   */
  const dismissInsight = useCallback((id: string) => {
    setInsights(prev =>
      prev.map(i => i.id === id ? { ...i, dismissedAt: Date.now() } : i)
    );
  }, []);

  /**
   * Get auto-adjustments based on stored events
   */
  const getAdjustments = useCallback((): AutoAdjustment => {
    return getAutoAdjustments(eventsRef.current);
  }, []);

  /**
   * Generate a post-workout insight from workout data.
   * Product CTA only appears for contextually relevant scenarios (leg day, high volume).
   * Returns null if no relevant pattern is detected.
   */
  const generatePostWorkoutInsight = useCallback((workoutData: Record<string, unknown>): CoachInsight | null => {
    const totalReps = workoutData.totalReps as number | undefined;
    const volume = workoutData.volume as number | undefined;
    const muscles = workoutData.muscles as string[] | undefined;

    let message = 'Session done. Recovery time.';
    let productKey: string | undefined;

    // Check for leg-specific recovery (contextually relevant product)
    const isLegDay = muscles?.some(m => ['legs', 'glutes', 'quads', 'hamstrings'].includes(m.toLowerCase()));

    if (isLegDay) {
      productKey = 'legs_recovery';
      if (totalReps) {
        message = `Leg session done. ${totalReps} reps. Quads will be sore tomorrow.`;
      } else {
        message = 'Leg session done. Quads will be sore tomorrow.';
      }
    } else if (volume && volume > 10000) {
      // High volume session — recovery product makes sense
      productKey = 'general_recovery';
      message = `${volume.toLocaleString()} lbs moved. Big session. Recovery time.`;
    } else if (volume && volume > 0) {
      // Normal session — no product pitch, just encouragement
      message = `${volume.toLocaleString()} lbs moved. Recovery time.`;
    } else if (totalReps && totalReps > 0) {
      message = `${totalReps} reps logged. Recovery time.`;
    }

    const product = productKey ? getProductRecommendation(productKey) : null;

    return {
      id: `post_workout_${Date.now()}`,
      type: 'post_workout',
      message,
      priority: 'medium',
      product: product || undefined,
      createdAt: Date.now(),
    };
  }, []);

  // Active insights = not dismissed
  const activeInsights = insights
    .filter(i => !i.dismissedAt)
    .slice(0, MAX_ACTIVE_INSIGHTS);

  return {
    insights: activeInsights,
    captureEvent,
    dismissInsight,
    getAdjustments,
    generatePostWorkoutInsight,
  };
}
