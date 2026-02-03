-- Progress Photos Table
-- Stores metadata for progress photos uploaded to Supabase storage

-- ============================================================================
-- Progress Photos Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    photo_type TEXT NOT NULL CHECK (photo_type IN ('front', 'side', 'back', 'general')),
    weight_lbs DECIMAL(5,1),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Index for efficient user queries
    CONSTRAINT valid_url CHECK (photo_url ~ '^https?://')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_progress_photos_user ON progress_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_photos_created ON progress_photos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_type ON progress_photos(user_id, photo_type);

-- RLS Policies
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Users can only see their own photos
CREATE POLICY "Users can view own progress photos" ON progress_photos
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own photos
CREATE POLICY "Users can insert own progress photos" ON progress_photos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete own progress photos" ON progress_photos
    FOR DELETE USING (auth.uid() = user_id);

-- Users can update their own photo metadata
CREATE POLICY "Users can update own progress photos" ON progress_photos
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Storage Bucket Policy (if not exists)
-- Run this in the Supabase dashboard SQL editor for storage policies
-- ============================================================================
-- Note: Storage bucket 'user-photos' should already exist from previous setup
-- This adds policies for the progress photo subdirectory

-- Allow users to upload to their own progress folder
-- INSERT policy: storage.objects (user-photos bucket)
-- Path pattern: {user_id}/progress/*

-- Allow users to read their own progress photos
-- SELECT policy: storage.objects (user-photos bucket)
-- Path pattern: {user_id}/progress/*

-- Allow users to delete their own progress photos
-- DELETE policy: storage.objects (user-photos bucket)
-- Path pattern: {user_id}/progress/*

-- ============================================================================
-- Function to get progress photos summary for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_progress_summary(user_id_param UUID)
RETURNS TABLE (
    total_photos INTEGER,
    first_photo_date TIMESTAMPTZ,
    last_photo_date TIMESTAMPTZ,
    weight_change DECIMAL,
    photos_by_type JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_photos,
        MIN(created_at) as first_photo_date,
        MAX(created_at) as last_photo_date,
        (
            SELECT p2.weight_lbs - p1.weight_lbs
            FROM progress_photos p1, progress_photos p2
            WHERE p1.user_id = user_id_param AND p2.user_id = user_id_param
            AND p1.weight_lbs IS NOT NULL AND p2.weight_lbs IS NOT NULL
            AND p1.created_at = (SELECT MIN(created_at) FROM progress_photos WHERE user_id = user_id_param AND weight_lbs IS NOT NULL)
            AND p2.created_at = (SELECT MAX(created_at) FROM progress_photos WHERE user_id = user_id_param AND weight_lbs IS NOT NULL)
        ) as weight_change,
        jsonb_object_agg(photo_type, count) as photos_by_type
    FROM progress_photos pp
    CROSS JOIN LATERAL (
        SELECT photo_type, COUNT(*) as count
        FROM progress_photos
        WHERE user_id = user_id_param
        GROUP BY photo_type
    ) type_counts
    WHERE pp.user_id = user_id_param
    GROUP BY type_counts.photo_type, type_counts.count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
