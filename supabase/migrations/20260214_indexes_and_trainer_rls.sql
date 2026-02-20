-- 20260214_indexes_and_trainer_rls.sql
-- Adds missing analytical indexes and trainer RLS policy for food_scans
-- Fixes identified in Ralph Loop systems audit

-- ============================================================================
-- 1. food_scans: Add analytical indexes
-- ============================================================================

-- Chronological listing of user's scans
CREATE INDEX IF NOT EXISTS idx_food_scans_user_created
    ON food_scans (user_id, created_at DESC);

-- Filter USDA-verified vs estimated scans
CREATE INDEX IF NOT EXISTS idx_food_scans_user_usda
    ON food_scans (user_id, has_usda_data);

-- ============================================================================
-- 2. food_scans: Trainer access policy (read-only for their clients)
-- ============================================================================

-- Trainers can view food scan data for their assigned clients
-- This enables trainers to see detailed USDA/AI meal analysis for coaching
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'food_scans'
        AND policyname = 'Trainers can view client food scans'
    ) THEN
        CREATE POLICY "Trainers can view client food scans"
            ON food_scans
            FOR SELECT
            USING (
                user_id IN (
                    SELECT id FROM profiles
                    WHERE trainer_id = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================================================
-- 3. profiles: Index on subscription_status for admin queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
    ON profiles (subscription_status);

-- Index for subscription expiry checks (webhook + cron use cases)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_ends_at
    ON profiles (subscription_ends_at)
    WHERE subscription_ends_at IS NOT NULL;

-- ============================================================================
-- 4. nutrition_logs: Compound index for meal sync performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date_desc
    ON nutrition_logs (user_id, date DESC);

-- ============================================================================
-- 5. trainer_messages: Inbox query index (unread + recent)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_trainer_messages_inbox
    ON trainer_messages (receiver_id, created_at DESC)
    WHERE is_read = false;
