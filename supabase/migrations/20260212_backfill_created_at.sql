-- Migration: Backfill NULL created_at for existing users (RALPH LOOP 8)
-- Date: 2026-02-12
-- Purpose: Ensure all users have a valid created_at for day counter feature

-- Backfill created_at for existing users who have NULL
-- Fall back to a safe sentinel date (Jan 1, 2025) for legacy users
UPDATE profiles
SET created_at = '2025-01-01T00:00:00Z'::timestamptz
WHERE created_at IS NULL;

-- Add NOT NULL constraint going forward (with default for new rows)
-- This ensures new profiles always have created_at set
ALTER TABLE profiles
ALTER COLUMN created_at SET DEFAULT now();

-- Add comment documenting the backfill
COMMENT ON COLUMN profiles.created_at IS 'User signup date. Backfilled to 2025-01-01 for legacy users without created_at.';
