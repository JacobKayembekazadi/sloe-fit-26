-- FIX TC1: Add RLS policy for trainers to view client progress photos
-- This ensures trainers can only access photos of clients who have set them as trainer

-- Add RLS policy for trainers to view their clients' progress photos
DROP POLICY IF EXISTS "Trainers can view client progress photos" ON progress_photos;
CREATE POLICY "Trainers can view client progress photos" ON progress_photos
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = progress_photos.user_id
            AND profiles.trainer_id = auth.uid()
        )
    );

-- Update the base user policy to be more explicit
DROP POLICY IF EXISTS "Users can view own progress photos" ON progress_photos;
CREATE POLICY "Users can view own progress photos" ON progress_photos
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- FIX TC2: Create audit_logs table for tracking trainer actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view audit logs where they are the subject
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
CREATE POLICY "Users can view own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Trainers can view audit logs for their clients (and their own actions)
DROP POLICY IF EXISTS "Trainers can view client audit logs" ON audit_logs;
CREATE POLICY "Trainers can view client audit logs" ON audit_logs
    FOR SELECT USING (
        auth.uid() = actor_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = audit_logs.user_id
            AND profiles.trainer_id = auth.uid()
        )
    );

-- Only the actor can insert audit logs
DROP POLICY IF EXISTS "Actors can insert audit logs" ON audit_logs;
CREATE POLICY "Actors can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- ============================================================================
-- Function to log trainer actions
-- ============================================================================

CREATE OR REPLACE FUNCTION log_trainer_action(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (user_id, actor_id, action, resource_type, resource_id, metadata)
    VALUES (p_user_id, auth.uid(), p_action, p_resource_type, p_resource_id, p_metadata)
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
