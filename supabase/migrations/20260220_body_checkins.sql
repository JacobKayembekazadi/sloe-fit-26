-- Body Check-ins Table
-- Stores periodic body metric entries for tracking composition trends
-- Phase 1 of Body Check-in redesign

CREATE TABLE IF NOT EXISTS body_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metrics (all optional except weight for flexibility)
  weight_lbs NUMERIC(5,1),
  body_fat_pct NUMERIC(4,1),
  muscle_mass_lbs NUMERIC(5,1),
  waist_inches NUMERIC(4,1),

  -- Metadata
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'scale', 'ai')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user (most recent first)
CREATE INDEX IF NOT EXISTS idx_body_checkins_user ON body_checkins(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE body_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own body checkins" ON body_checkins;
CREATE POLICY "Users can view own body checkins"
  ON body_checkins FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own body checkins" ON body_checkins;
CREATE POLICY "Users can insert own body checkins"
  ON body_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own body checkins" ON body_checkins;
CREATE POLICY "Users can delete own body checkins"
  ON body_checkins FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE body_checkins IS 'Periodic body metric entries for composition trend tracking';
