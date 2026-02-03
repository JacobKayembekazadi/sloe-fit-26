-- Trainer Client Management Tables
-- Run this migration in your Supabase SQL editor
-- This migration is IDEMPOTENT - safe to run multiple times

-- ============================================================================
-- Trainer Messages Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trainer_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for efficient querying
    CONSTRAINT sender_receiver_different CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_messages_sender ON trainer_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_trainer_messages_receiver ON trainer_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_trainer_messages_created ON trainer_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trainer_messages_unread ON trainer_messages(receiver_id, is_read) WHERE is_read = FALSE;

-- RLS Policies
ALTER TABLE trainer_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own messages" ON trainer_messages;
CREATE POLICY "Users can read their own messages" ON trainer_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON trainer_messages;
CREATE POLICY "Users can send messages" ON trainer_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receivers can mark messages as read" ON trainer_messages;
CREATE POLICY "Receivers can mark messages as read" ON trainer_messages
    FOR UPDATE USING (auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = receiver_id);

-- ============================================================================
-- Assigned Workouts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS assigned_workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    exercises JSONB NOT NULL DEFAULT '[]',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes TEXT,

    -- Indexes
    CONSTRAINT trainer_client_different CHECK (trainer_id != client_id)
);

CREATE INDEX IF NOT EXISTS idx_assigned_workouts_client ON assigned_workouts(client_id);
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_trainer ON assigned_workouts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_status ON assigned_workouts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_assigned_workouts_assigned ON assigned_workouts(assigned_at DESC);

-- RLS Policies
ALTER TABLE assigned_workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers can manage assigned workouts" ON assigned_workouts;
CREATE POLICY "Trainers can manage assigned workouts" ON assigned_workouts
    FOR ALL USING (auth.uid() = trainer_id);

DROP POLICY IF EXISTS "Clients can view their assigned workouts" ON assigned_workouts;
CREATE POLICY "Clients can view their assigned workouts" ON assigned_workouts
    FOR SELECT USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients can update status of their workouts" ON assigned_workouts;
CREATE POLICY "Clients can update status of their workouts" ON assigned_workouts
    FOR UPDATE USING (auth.uid() = client_id)
    WITH CHECK (auth.uid() = client_id);

-- ============================================================================
-- Client Notes Table (Private trainer notes about clients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for trainer-client pair
    UNIQUE(trainer_id, client_id),
    CONSTRAINT trainer_client_different CHECK (trainer_id != client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_notes_trainer ON client_notes(trainer_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id);

-- RLS Policies (only trainers can see/edit their notes)
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers can manage their client notes" ON client_notes;
CREATE POLICY "Trainers can manage their client notes" ON client_notes
    FOR ALL USING (auth.uid() = trainer_id);

-- ============================================================================
-- Trainer Invites Table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trainer_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    max_uses INTEGER DEFAULT 10,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_invites_code ON trainer_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_trainer_invites_trainer ON trainer_invites(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_invites_active ON trainer_invites(invite_code) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE trainer_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trainers can manage their invites" ON trainer_invites;
CREATE POLICY "Trainers can manage their invites" ON trainer_invites
    FOR ALL USING (auth.uid() = trainer_id);

DROP POLICY IF EXISTS "Anyone can view active invites by code" ON trainer_invites;
CREATE POLICY "Anyone can view active invites by code" ON trainer_invites
    FOR SELECT USING (is_active = TRUE);

-- ============================================================================
-- Update profiles table for trainer relationship (if column doesn't exist)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'trainer_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
        CREATE INDEX idx_profiles_trainer ON profiles(trainer_id);
    END IF;
END $$;

-- Add RLS policy for trainers to view their clients' profiles
DROP POLICY IF EXISTS "Trainers can view client profiles" ON profiles;
CREATE POLICY "Trainers can view client profiles" ON profiles
    FOR SELECT USING (
        auth.uid() = id OR
        trainer_id = auth.uid()
    );

-- Add RLS policy for trainers to view their clients' workouts
DROP POLICY IF EXISTS "Trainers can view client workouts" ON workouts;
CREATE POLICY "Trainers can view client workouts" ON workouts
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = workouts.user_id
            AND profiles.trainer_id = auth.uid()
        )
    );

-- Add RLS policy for trainers to view their clients' nutrition logs
DROP POLICY IF EXISTS "Trainers can view client nutrition" ON nutrition_logs;
CREATE POLICY "Trainers can view client nutrition" ON nutrition_logs
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = nutrition_logs.user_id
            AND profiles.trainer_id = auth.uid()
        )
    );

-- ============================================================================
-- Function to increment invite uses when a client joins
-- ============================================================================
DROP FUNCTION IF EXISTS increment_invite_uses(text);
CREATE OR REPLACE FUNCTION increment_invite_uses(invite_code_param TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE trainer_invites
    SET uses_count = uses_count + 1
    WHERE invite_code = invite_code_param
    AND is_active = TRUE
    AND (max_uses IS NULL OR uses_count < max_uses)
    AND (expires_at IS NULL OR expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to join a trainer via invite code
-- ============================================================================
DROP FUNCTION IF EXISTS join_trainer(text, uuid);
CREATE OR REPLACE FUNCTION join_trainer(invite_code_param TEXT, client_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    trainer_id_found UUID;
BEGIN
    -- Find the trainer for this invite code
    SELECT trainer_id INTO trainer_id_found
    FROM trainer_invites
    WHERE invite_code = invite_code_param
    AND is_active = TRUE
    AND (max_uses IS NULL OR uses_count < max_uses)
    AND (expires_at IS NULL OR expires_at > NOW());

    IF trainer_id_found IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Update the client's profile with the trainer
    UPDATE profiles
    SET trainer_id = trainer_id_found
    WHERE id = client_id_param;

    -- Increment uses
    PERFORM increment_invite_uses(invite_code_param);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to use trainer invite (returns JSON with details)
-- ============================================================================
DROP FUNCTION IF EXISTS use_trainer_invite(text, uuid);
CREATE OR REPLACE FUNCTION use_trainer_invite(p_invite_code TEXT, p_client_id UUID)
RETURNS JSON AS $$
DECLARE
    v_trainer_id UUID;
    v_result JSON;
BEGIN
    -- Find valid invite
    SELECT trainer_id INTO v_trainer_id
    FROM trainer_invites
    WHERE invite_code = p_invite_code
    AND is_active = TRUE
    AND (max_uses IS NULL OR uses_count < max_uses)
    AND (expires_at IS NULL OR expires_at > NOW());

    IF v_trainer_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired invite code');
    END IF;

    -- Check if client already has this trainer
    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_client_id AND trainer_id = v_trainer_id) THEN
        RETURN json_build_object('success', false, 'error', 'You are already connected to this trainer');
    END IF;

    -- Update client profile
    UPDATE profiles
    SET trainer_id = v_trainer_id, role = 'client'
    WHERE id = p_client_id;

    -- Increment invite uses
    UPDATE trainer_invites
    SET uses_count = uses_count + 1
    WHERE invite_code = p_invite_code;

    RETURN json_build_object('success', true, 'trainer_id', v_trainer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
