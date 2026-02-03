-- ============================================================================
-- FIX: Update trigger to handle trainer signup from user metadata
-- ============================================================================

-- Drop and recreate the trigger function to include role handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if user signed up as trainer
    IF (NEW.raw_user_meta_data->>'is_trainer')::boolean = true THEN
        user_role := 'trainer';
    ELSE
        user_role := 'consumer';
    END IF;

    INSERT INTO public.profiles (id, full_name, role, created_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        user_role,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        role = COALESCE(profiles.role, EXCLUDED.role);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger itself doesn't need to be recreated since it already exists
-- and points to the function we just updated
