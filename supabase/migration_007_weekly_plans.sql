-- Migration: Weekly Plans Table
-- Stores AI-generated weekly training plans with multi-step reasoning

-- Create weekly_plans table
CREATE TABLE IF NOT EXISTS weekly_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    plan JSONB NOT NULL, -- The full WeeklyPlan object with all days
    reasoning TEXT, -- AI's explanation of the plan design
    progressive_overload_notes TEXT, -- Notes about weight/rep progressions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_week
ON weekly_plans(user_id, week_start DESC);

-- Enable Row Level Security
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own weekly plans" ON weekly_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly plans" ON weekly_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly plans" ON weekly_plans
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly plans" ON weekly_plans
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_weekly_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_plans_updated_at
    BEFORE UPDATE ON weekly_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_weekly_plans_updated_at();
