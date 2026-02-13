-- Food Scans Table
-- Stores AI detection vs user corrections for learning/analytics
-- Related to meal_entries via meal_entry_id

CREATE TABLE IF NOT EXISTS food_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_entry_id UUID REFERENCES meal_entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Original AI + USDA detection
  detected_items JSONB NOT NULL,

  -- After user portion adjustments
  final_items JSONB NOT NULL,

  -- Metadata
  has_usda_data BOOLEAN DEFAULT false,
  user_edited BOOLEAN DEFAULT false,
  portion_multipliers JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_food_scans_user_id ON food_scans(user_id);

-- Index for querying by meal entry
CREATE INDEX IF NOT EXISTS idx_food_scans_meal_entry_id ON food_scans(meal_entry_id);

-- RLS Policies
ALTER TABLE food_scans ENABLE ROW LEVEL SECURITY;

-- Users can only see their own scans
DROP POLICY IF EXISTS "Users can view own food scans" ON food_scans;
CREATE POLICY "Users can view own food scans"
  ON food_scans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own scans
DROP POLICY IF EXISTS "Users can insert own food scans" ON food_scans;
CREATE POLICY "Users can insert own food scans"
  ON food_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own scans
DROP POLICY IF EXISTS "Users can delete own food scans" ON food_scans;
CREATE POLICY "Users can delete own food scans"
  ON food_scans FOR DELETE
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON TABLE food_scans IS 'Stores AI food detection results and user corrections for learning/analytics';
COMMENT ON COLUMN food_scans.detected_items IS 'Original AI + USDA detection as FoodWithNutrition[]';
COMMENT ON COLUMN food_scans.final_items IS 'After user portion adjustments as FoodWithNutrition[]';
COMMENT ON COLUMN food_scans.portion_multipliers IS 'User portion adjustments as Record<number, number>';
