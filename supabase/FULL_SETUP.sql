-- ============================================================================
-- SLOE FIT - COMPLETE DATABASE SETUP
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. BASE TABLES
-- ============================================================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    goal TEXT CHECK (goal IN ('CUT', 'BULK', 'RECOMP')),
    onboarding_complete BOOLEAN DEFAULT FALSE,
    height_inches INTEGER,
    weight_lbs INTEGER,
    age INTEGER,
    training_experience TEXT CHECK (training_experience IN ('beginner', 'intermediate', 'advanced')),
    equipment_access TEXT CHECK (equipment_access IN ('gym', 'home', 'minimal')),
    days_per_week INTEGER CHECK (days_per_week >= 1 AND days_per_week <= 7),
    role TEXT DEFAULT 'consumer' CHECK (role IN ('consumer', 'client', 'trainer')),
    trainer_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    exercises JSONB DEFAULT '[]',
    duration_minutes INTEGER,
    recovery_rating INTEGER CHECK (recovery_rating >= 1 AND recovery_rating <= 5),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
    sleep_hours NUMERIC(3,1),
    soreness_areas TEXT[],
    ai_generated BOOLEAN DEFAULT FALSE,
    intensity TEXT CHECK (intensity IN ('light', 'moderate', 'intense')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nutrition logs table
CREATE TABLE IF NOT EXISTS nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    calories INTEGER DEFAULT 0,
    protein INTEGER DEFAULT 0,
    carbs INTEGER DEFAULT 0,
    fats INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Meal entries table (individual meals)
CREATE TABLE IF NOT EXISTS meal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    description TEXT,
    foods JSONB DEFAULT '[]',
    calories INTEGER DEFAULT 0,
    protein INTEGER DEFAULT 0,
    carbs INTEGER DEFAULT 0,
    fats INTEGER DEFAULT 0,
    photo_url TEXT,
    ai_analyzed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress photos table
CREATE TABLE IF NOT EXISTS progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type TEXT CHECK (photo_type IN ('front', 'side', 'back', 'other')),
    weight_lbs NUMERIC(5,1),
    notes TEXT,
    taken_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date ON nutrition_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_entries_user_date ON meal_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_photos_user_date ON progress_photos(user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_trainer ON profiles(trainer_id) WHERE trainer_id IS NOT NULL;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Workouts policies
CREATE POLICY "Users can view own workouts" ON workouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts" ON workouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts" ON workouts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts" ON workouts
    FOR DELETE USING (auth.uid() = user_id);

-- Nutrition logs policies
CREATE POLICY "Users can view own nutrition logs" ON nutrition_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition logs" ON nutrition_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrition logs" ON nutrition_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition logs" ON nutrition_logs
    FOR DELETE USING (auth.uid() = user_id);

-- Meal entries policies
CREATE POLICY "Users can view own meal entries" ON meal_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal entries" ON meal_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal entries" ON meal_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal entries" ON meal_entries
    FOR DELETE USING (auth.uid() = user_id);

-- Progress photos policies
CREATE POLICY "Users can view own progress photos" ON progress_photos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress photos" ON progress_photos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress photos" ON progress_photos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress photos" ON progress_photos
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, created_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. TRAINER FEATURES (Optional)
-- ============================================================================

-- Trainer invites table
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

CREATE INDEX IF NOT EXISTS idx_trainer_invites_code ON trainer_invites(invite_code) WHERE is_active = TRUE;

ALTER TABLE trainer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage their invites" ON trainer_invites
    FOR ALL USING (auth.uid() = trainer_id);

CREATE POLICY "Anyone can view active invites by code" ON trainer_invites
    FOR SELECT USING (is_active = TRUE);

-- Trainer can view their clients
CREATE POLICY "Trainers can view client profiles" ON profiles
    FOR SELECT USING (
        auth.uid() = id OR
        trainer_id = auth.uid()
    );

-- ============================================================================
-- 6. STORAGE BUCKET (Run separately in Storage settings)
-- ============================================================================
-- Go to Supabase Dashboard > Storage > New Bucket
-- Name: user-photos
-- Public: Yes (or No for private)

-- ============================================================================
-- DONE! Your database is ready.
-- ============================================================================
