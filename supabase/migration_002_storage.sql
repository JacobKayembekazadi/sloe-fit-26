-- Migration 002: Set up Storage bucket for user photos
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Create the storage bucket for user photos (if not exists)
-- NOTE: You may need to create this via the Supabase Dashboard UI instead:
-- 1. Go to Storage in the left sidebar
-- 2. Click "New bucket"
-- 3. Name: user-photos
-- 4. Check "Public bucket" (for direct URL access) OR leave unchecked for private

-- If using SQL, uncomment below (requires supabase_admin role):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('user-photos', 'user-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- RLS Policies for the storage bucket
-- These ensure users can only access their own photos

-- Allow users to upload to their own folder
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'user-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own photos
CREATE POLICY "Users can read own photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'user-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own photos
CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'user-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'user-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Optional: If you want public read access (for sharing progress photos)
-- Uncomment the following:
-- CREATE POLICY "Public can read photos"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'user-photos');
