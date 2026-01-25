-- Migration 004: Recovery tracking for AI-powered workout adjustments
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Add recovery columns to workouts table
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS recovery_rating INTEGER CHECK (recovery_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS sleep_hours DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS soreness_areas TEXT[],
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS intensity TEXT CHECK (intensity IN ('light', 'moderate', 'intense') OR intensity IS NULL);

-- Create table for tracking daily recovery state
CREATE TABLE IF NOT EXISTS user_recovery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    sleep_hours DECIMAL(3,1),
    soreness_areas TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Enable RLS on recovery_logs
ALTER TABLE user_recovery_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own recovery logs
CREATE POLICY "Users can view own recovery logs"
    ON user_recovery_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own recovery logs
CREATE POLICY "Users can insert own recovery logs"
    ON user_recovery_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own recovery logs
CREATE POLICY "Users can update own recovery logs"
    ON user_recovery_logs FOR UPDATE
    USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON COLUMN workouts.recovery_rating IS 'Post-workout rating 1-5, used to adjust future workouts';
COMMENT ON COLUMN workouts.energy_level IS 'Pre-workout energy level 1-5';
COMMENT ON COLUMN workouts.sleep_hours IS 'Hours of sleep before workout';
COMMENT ON COLUMN workouts.soreness_areas IS 'Array of sore body areas (chest, back, legs, etc)';
COMMENT ON COLUMN workouts.ai_generated IS 'Whether this workout was AI-generated';
COMMENT ON COLUMN workouts.intensity IS 'Workout intensity level: light, moderate, intense';
