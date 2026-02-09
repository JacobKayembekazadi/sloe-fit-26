-- Subscription Status for Payment Gating
-- 7-day trial system with manual activation until Stripe/Shopify integration

-- ============================================================================
-- Add subscription columns to profiles
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT
    DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'expired', 'none'));

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();

-- Set trial_started_at to created_at for existing users (preserves their trial start)
UPDATE profiles
SET trial_started_at = COALESCE(created_at, NOW())
WHERE trial_started_at IS NULL;

-- ============================================================================
-- Function to check if trial has expired (7 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_trial_expired(trial_start TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN trial_start IS NOT NULL AND
           (NOW() - trial_start) > INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Function to get remaining trial days
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trial_days_remaining(trial_start TIMESTAMPTZ)
RETURNS INTEGER AS $$
BEGIN
    IF trial_start IS NULL THEN
        RETURN 0;
    END IF;

    RETURN GREATEST(0, 7 - EXTRACT(DAY FROM (NOW() - trial_start))::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Index for subscription queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_subscription
ON profiles(subscription_status)
WHERE subscription_status != 'active';

-- ============================================================================
-- Update handle_new_user trigger to set trial start
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (
        id,
        full_name,
        role,
        subscription_status,
        trial_started_at,
        created_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        CASE
            WHEN NEW.raw_user_meta_data->>'is_trainer' = 'true' THEN 'trainer'
            ELSE 'consumer'
        END,
        'trial',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
        role = CASE
            WHEN NEW.raw_user_meta_data->>'is_trainer' = 'true' THEN 'trainer'
            ELSE COALESCE(profiles.role, 'consumer')
        END,
        subscription_status = COALESCE(profiles.subscription_status, 'trial'),
        trial_started_at = COALESCE(profiles.trial_started_at, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Admin function to activate subscription (for manual activation)
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_activate_subscription(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET subscription_status = 'active'
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Admin function to expire trial manually
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_expire_trial(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET subscription_status = 'expired'
    WHERE id = user_id_param
    AND subscription_status = 'trial';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
