-- Migration 006: BYOC (Bring Your Own Clients) - Trainer/Client System
-- Run this in Supabase SQL Editor

-- 1. Add role and trainer fields to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'consumer' CHECK (role IN ('consumer', 'client', 'trainer')),
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS org_id UUID;

-- 2. Create organizations table (for gyms/training businesses)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create trainer invites table
CREATE TABLE IF NOT EXISTS trainer_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invite_code TEXT NOT NULL UNIQUE,
    max_uses INTEGER,
    uses_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_invites ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for organizations
CREATE POLICY "Users can view their org" ON organizations
    FOR SELECT USING (
        id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
        OR owner_id = auth.uid()
    );

CREATE POLICY "Org owners can update" ON organizations
    FOR UPDATE USING (owner_id = auth.uid());

-- 6. RLS Policies for trainer_invites
CREATE POLICY "Trainers can manage their invites" ON trainer_invites
    FOR ALL USING (trainer_id = auth.uid());

CREATE POLICY "Anyone can view active invites by code" ON trainer_invites
    FOR SELECT USING (is_active = true);

-- 7. RLS Policy: Trainers can view their clients' profiles
CREATE POLICY "Trainers can view client profiles" ON profiles
    FOR SELECT USING (
        trainer_id = auth.uid()
        OR id = auth.uid()
    );

-- 8. Function to atomically use an invite
CREATE OR REPLACE FUNCTION use_trainer_invite(
    p_invite_code TEXT,
    p_client_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_invite trainer_invites%ROWTYPE;
    v_result JSONB;
BEGIN
    -- Lock and fetch the invite
    SELECT * INTO v_invite
    FROM trainer_invites
    WHERE invite_code = p_invite_code
    AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive invite code');
    END IF;

    -- Check expiration
    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
        UPDATE trainer_invites SET is_active = false WHERE id = v_invite.id;
        RETURN jsonb_build_object('success', false, 'error', 'Invite has expired');
    END IF;

    -- Check max uses
    IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
        UPDATE trainer_invites SET is_active = false WHERE id = v_invite.id;
        RETURN jsonb_build_object('success', false, 'error', 'Invite has reached max uses');
    END IF;

    -- Update the client's profile
    UPDATE profiles
    SET role = 'client',
        trainer_id = v_invite.trainer_id,
        org_id = (SELECT org_id FROM profiles WHERE id = v_invite.trainer_id)
    WHERE id = p_client_id;

    -- Increment uses count
    UPDATE trainer_invites
    SET uses_count = uses_count + 1
    WHERE id = v_invite.id;

    RETURN jsonb_build_object(
        'success', true,
        'trainer_id', v_invite.trainer_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Index for faster invite lookups
CREATE INDEX IF NOT EXISTS idx_trainer_invites_code ON trainer_invites(invite_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_profiles_trainer ON profiles(trainer_id) WHERE trainer_id IS NOT NULL;

-- 10. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION use_trainer_invite TO authenticated;
