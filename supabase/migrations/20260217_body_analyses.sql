-- Body Analyses Table
-- Stores AI body analysis results server-side so they persist across devices/cache clears
-- Follows the food_scans pattern for analysis result storage

CREATE TABLE IF NOT EXISTS body_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- AI analysis result (markdown string)
  result_markdown TEXT NOT NULL,

  -- Metadata
  provider TEXT,
  duration_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user (most recent first)
CREATE INDEX IF NOT EXISTS idx_body_analyses_user ON body_analyses(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE body_analyses ENABLE ROW LEVEL SECURITY;

-- Users can only see their own analyses
DROP POLICY IF EXISTS "Users can view own body analyses" ON body_analyses;
CREATE POLICY "Users can view own body analyses"
  ON body_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own analyses (via API route with service role, but also allow client)
DROP POLICY IF EXISTS "Users can insert own body analyses" ON body_analyses;
CREATE POLICY "Users can insert own body analyses"
  ON body_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own analyses
DROP POLICY IF EXISTS "Users can delete own body analyses" ON body_analyses;
CREATE POLICY "Users can delete own body analyses"
  ON body_analyses FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE body_analyses IS 'Stores AI body composition analysis results for persistence across sessions';
COMMENT ON COLUMN body_analyses.result_markdown IS 'Full markdown analysis from AI provider';
COMMENT ON COLUMN body_analyses.provider IS 'AI provider used (google, openai, anthropic)';
COMMENT ON COLUMN body_analyses.duration_ms IS 'Time taken for AI analysis in milliseconds';
