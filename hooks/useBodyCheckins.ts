import { useState, useEffect, useCallback } from 'react';
import { supabaseGet, supabaseInsert, supabaseDelete } from '../services/supabaseRawFetch';
import type { BodyCheckin } from '../utils/bodyInsights';

export type { BodyCheckin } from '../utils/bodyInsights';

interface CheckinInput {
  weight_lbs: number | null;
  body_fat_pct?: number | null;
  muscle_mass_lbs?: number | null;
  waist_inches?: number | null;
  notes?: string | null;
  source?: 'manual' | 'scale' | 'ai';
}

interface UseBodyCheckinsReturn {
  checkins: BodyCheckin[];
  loading: boolean;
  error: string | null;
  addCheckin: (data: CheckinInput) => Promise<boolean>;
  deleteCheckin: (id: string) => Promise<boolean>;
  latestCheckin: BodyCheckin | null;
  refetch: () => void;
}

export function useBodyCheckins(userId: string | undefined): UseBodyCheckinsReturn {
  const [checkins, setCheckins] = useState<BodyCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  // Fetch check-ins
  useEffect(() => {
    if (!userId) {
      setCheckins([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      const { data, error: fetchError } = await supabaseGet<BodyCheckin[]>(
        `body_checkins?user_id=eq.${userId}&order=created_at.desc&limit=100`
      );

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setCheckins([]);
      } else {
        setCheckins(data || []);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId, fetchKey]);

  // Add check-in with optimistic update
  const addCheckin = useCallback(async (input: CheckinInput): Promise<boolean> => {
    if (!userId) return false;

    const payload = {
      user_id: userId,
      weight_lbs: input.weight_lbs,
      body_fat_pct: input.body_fat_pct ?? null,
      muscle_mass_lbs: input.muscle_mass_lbs ?? null,
      waist_inches: input.waist_inches ?? null,
      notes: input.notes ?? null,
      source: input.source ?? 'manual',
    };

    const { data, error: insertError } = await supabaseInsert<BodyCheckin>(
      'body_checkins',
      payload,
    );

    if (insertError) {
      setError(insertError.message);
      return false;
    }

    if (data) {
      setCheckins(prev => [data, ...prev]);
    } else {
      refetch();
    }

    return true;
  }, [userId, refetch]);

  // Delete check-in
  const deleteCheckin = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    const { error: deleteError } = await supabaseDelete(
      `body_checkins?id=eq.${id}&user_id=eq.${userId}`
    );

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setCheckins(prev => prev.filter(c => c.id !== id));
    return true;
  }, [userId]);

  return {
    checkins,
    loading,
    error,
    addCheckin,
    deleteCheckin,
    latestCheckin: checkins[0] || null,
    refetch,
  };
}
