-- Migration 003: Extended user profile for AI-powered features
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Add new columns to profiles table for personalized AI features
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS height_inches INTEGER,
ADD COLUMN IF NOT EXISTS weight_lbs INTEGER,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS training_experience TEXT DEFAULT 'beginner',
ADD COLUMN IF NOT EXISTS equipment_access TEXT DEFAULT 'gym',
ADD COLUMN IF NOT EXISTS days_per_week INTEGER DEFAULT 4;

-- Add check constraints for valid values
ALTER TABLE profiles
ADD CONSTRAINT valid_training_experience
CHECK (training_experience IN ('beginner', 'intermediate', 'advanced') OR training_experience IS NULL);

ALTER TABLE profiles
ADD CONSTRAINT valid_equipment_access
CHECK (equipment_access IN ('gym', 'home', 'minimal') OR equipment_access IS NULL);

ALTER TABLE profiles
ADD CONSTRAINT valid_days_per_week
CHECK (days_per_week BETWEEN 2 AND 6 OR days_per_week IS NULL);

-- Update existing users to have defaults if they completed onboarding
UPDATE profiles
SET
    training_experience = COALESCE(training_experience, 'beginner'),
    equipment_access = COALESCE(equipment_access, 'gym'),
    days_per_week = COALESCE(days_per_week, 4)
WHERE onboarding_complete = TRUE;

-- Comment explaining the fields
COMMENT ON COLUMN profiles.height_inches IS 'User height in total inches for BMR calculation';
COMMENT ON COLUMN profiles.weight_lbs IS 'User weight in pounds for calorie/protein calculation';
COMMENT ON COLUMN profiles.age IS 'User age for BMR calculation';
COMMENT ON COLUMN profiles.training_experience IS 'beginner/intermediate/advanced - affects workout complexity';
COMMENT ON COLUMN profiles.equipment_access IS 'gym/home/minimal - determines exercise selection';
COMMENT ON COLUMN profiles.days_per_week IS 'Training frequency 2-6 days per week';
