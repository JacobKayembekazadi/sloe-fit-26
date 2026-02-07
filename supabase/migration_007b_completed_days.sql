-- Migration 007b: Add completed_days column to weekly_plans
-- Tracks which days of the plan have been completed

ALTER TABLE weekly_plans
ADD COLUMN IF NOT EXISTS completed_days INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN weekly_plans.completed_days IS 'Array of day indices (0=Sun, 6=Sat) that have been completed';
