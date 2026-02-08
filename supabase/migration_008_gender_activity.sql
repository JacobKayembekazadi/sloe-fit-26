-- Migration 008: Add gender and activity_level to profiles table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- Required for Phase 3 BMR/TDEE calculations (Mifflin-St Jeor with gender + activity multiplier)

-- Add gender column (male/female, nullable — null means not yet set)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add activity_level column (nullable — null defaults to 'moderately_active' in app code)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS activity_level TEXT;

-- Add check constraints for valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_gender'
    ) THEN
        ALTER TABLE profiles
        ADD CONSTRAINT valid_gender
        CHECK (gender IN ('male', 'female') OR gender IS NULL);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_activity_level'
    ) THEN
        ALTER TABLE profiles
        ADD CONSTRAINT valid_activity_level
        CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active') OR activity_level IS NULL);
    END IF;
END $$;

-- Comments
COMMENT ON COLUMN profiles.gender IS 'male/female — used for Mifflin-St Jeor BMR gender offset (+5 male, -161 female)';
COMMENT ON COLUMN profiles.activity_level IS 'Activity level for TDEE multiplier (1.2 sedentary to 1.9 extremely_active)';
