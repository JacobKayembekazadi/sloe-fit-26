-- Migration 001: Add onboarding support to profiles table
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Add onboarding_complete column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

-- Add full_name column if not exists (for signup data)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add created_at column if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing profiles to mark onboarding as complete
-- (since they already have the app working)
UPDATE profiles
SET onboarding_complete = TRUE
WHERE goal IS NOT NULL;

-- Ensure RLS policies allow users to update their own profile
-- (You may already have this, but just in case)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile"
        ON profiles FOR UPDATE
        USING (auth.uid() = id);
    END IF;
END $$;

-- Allow insert for new users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile"
        ON profiles FOR INSERT
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;
