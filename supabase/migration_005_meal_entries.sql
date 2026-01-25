-- Migration 005: Individual meal entries for enhanced tracking
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Create table for individual meal entries
CREATE TABLE IF NOT EXISTS meal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack') OR meal_type IS NULL),
    input_method TEXT CHECK (input_method IN ('photo', 'text', 'quick_add') OR input_method IS NULL),
    description TEXT,
    photo_url TEXT,
    calories INTEGER NOT NULL,
    protein INTEGER NOT NULL,
    carbs INTEGER NOT NULL,
    fats INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for favorite foods
CREATE TABLE IF NOT EXISTS favorite_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein INTEGER NOT NULL,
    carbs INTEGER NOT NULL,
    fats INTEGER NOT NULL,
    times_logged INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_foods ENABLE ROW LEVEL SECURITY;

-- Policies for meal_entries
CREATE POLICY "Users can view own meal entries"
    ON meal_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal entries"
    ON meal_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal entries"
    ON meal_entries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal entries"
    ON meal_entries FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for favorite_foods
CREATE POLICY "Users can view own favorites"
    ON favorite_foods FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
    ON favorite_foods FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites"
    ON favorite_foods FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
    ON favorite_foods FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_entries_user_date ON meal_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_favorite_foods_user ON favorite_foods(user_id);

-- Add comments
COMMENT ON TABLE meal_entries IS 'Individual meal entries with macros, supporting photo/text/quick-add input';
COMMENT ON TABLE favorite_foods IS 'User favorite foods for quick-add functionality';
COMMENT ON COLUMN meal_entries.input_method IS 'How the meal was logged: photo, text, or quick_add';
COMMENT ON COLUMN favorite_foods.times_logged IS 'Number of times this food has been logged, for sorting';
