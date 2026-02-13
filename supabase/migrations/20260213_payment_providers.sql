-- Payment Provider Integration (Stripe + Lemon Squeezy)
-- Adds columns to track subscription provider and IDs

-- ============================================================================
-- Add payment provider columns to profiles
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_provider TEXT
    CHECK (subscription_provider IN ('stripe', 'lemonsqueezy', NULL));

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_plan TEXT
    CHECK (subscription_plan IN ('monthly', 'annual', 'trainer', NULL));

-- ============================================================================
-- Index for customer ID lookups (webhook processing)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
ON profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_lemon_squeezy_customer
ON profiles(lemon_squeezy_customer_id)
WHERE lemon_squeezy_customer_id IS NOT NULL;

-- ============================================================================
-- Function to activate subscription from webhook
-- ============================================================================

CREATE OR REPLACE FUNCTION activate_subscription(
    user_id_param UUID,
    provider TEXT,
    customer_id TEXT,
    subscription_id TEXT,
    plan TEXT,
    ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET
        subscription_status = 'active',
        subscription_provider = provider,
        subscription_plan = plan,
        subscription_ends_at = ends_at,
        stripe_customer_id = CASE WHEN provider = 'stripe' THEN customer_id ELSE stripe_customer_id END,
        stripe_subscription_id = CASE WHEN provider = 'stripe' THEN subscription_id ELSE stripe_subscription_id END,
        lemon_squeezy_customer_id = CASE WHEN provider = 'lemonsqueezy' THEN customer_id ELSE lemon_squeezy_customer_id END,
        lemon_squeezy_subscription_id = CASE WHEN provider = 'lemonsqueezy' THEN subscription_id ELSE lemon_squeezy_subscription_id END
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to cancel/expire subscription from webhook
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_subscription(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET
        subscription_status = 'expired',
        subscription_ends_at = NOW()
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to find user by Stripe customer ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_by_stripe_customer(customer_id TEXT)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    SELECT id INTO user_id
    FROM profiles
    WHERE stripe_customer_id = customer_id;
    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to find user by Lemon Squeezy customer ID
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_by_lemon_squeezy_customer(customer_id TEXT)
RETURNS UUID AS $$
DECLARE
    user_id UUID;
BEGIN
    SELECT id INTO user_id
    FROM profiles
    WHERE lemon_squeezy_customer_id = customer_id;
    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
