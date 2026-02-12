-- Migration: Add supplement preferences to profiles
-- Date: 2026-02-12
-- Purpose: Allow users to specify which supplements they use for personalized recommendations

-- Add supplement_preferences JSONB column
-- Structure: { "enabled": boolean, "products": string[], "openToRecommendations": boolean }
-- Example: { "enabled": true, "products": ["creatine", "whey_protein"], "openToRecommendations": true }

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS supplement_preferences JSONB DEFAULT '{"enabled": false, "products": [], "openToRecommendations": false}';

-- Add comment for documentation
COMMENT ON COLUMN profiles.supplement_preferences IS 'User supplement preferences: enabled (bool), products (array of supplement IDs), openToRecommendations (bool for AI suggestions)';
