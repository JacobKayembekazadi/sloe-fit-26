# Sloe Fit Database Schema

## Overview

Sloe Fit uses Supabase (PostgreSQL) for data storage with Row Level Security (RLS) enabled on all tables.

## Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │
│  (Supabase)     │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐       ┌─────────────────┐
│    profiles     │───────│ trainer_invites │
│                 │ 1:N   │                 │
└────────┬────────┘       └─────────────────┘
         │
    ┌────┴────┬────────────┬────────────┐
    │         │            │            │
    │ 1:N     │ 1:N        │ 1:N        │ 1:N
    ▼         ▼            ▼            ▼
┌─────────┐ ┌─────────────┐ ┌──────────┐ ┌───────────────┐
│workouts │ │nutrition_   │ │meal_     │ │progress_      │
│         │ │logs         │ │entries   │ │photos         │
└─────────┘ └─────────────┘ └──────────┘ └───────────────┘
```

---

## Tables

### profiles

Extends `auth.users` with application-specific user data.

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    goals TEXT,
    fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
    equipment_access TEXT[] DEFAULT '{}',
    dietary_preferences TEXT[] DEFAULT '{}',
    target_calories INTEGER,
    target_protein INTEGER,
    target_carbs INTEGER,
    target_fats INTEGER,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    age INTEGER,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    trainer_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_trainer_id ON profiles(trainer_id);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Trainers can view client profiles"
    ON profiles FOR SELECT
    USING (trainer_id = auth.uid());
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK | References auth.users |
| full_name | TEXT | | Display name |
| avatar_url | TEXT | | Profile image URL |
| goals | TEXT | | User's fitness goals |
| fitness_level | TEXT | CHECK | beginner/intermediate/advanced |
| equipment_access | TEXT[] | DEFAULT {} | Available equipment |
| dietary_preferences | TEXT[] | DEFAULT {} | Dietary restrictions |
| target_calories | INTEGER | | Daily calorie target |
| target_protein | INTEGER | | Daily protein target (g) |
| target_carbs | INTEGER | | Daily carbs target (g) |
| target_fats | INTEGER | | Daily fats target (g) |
| weight | DECIMAL(5,2) | | Weight in kg |
| height | DECIMAL(5,2) | | Height in cm |
| age | INTEGER | | Age in years |
| gender | TEXT | CHECK | male/female/other |
| trainer_id | UUID | FK | Trainer's user ID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

---

### workouts

Stores completed workout sessions.

```sql
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    duration_minutes INTEGER,
    intensity TEXT CHECK (intensity IN ('light', 'moderate', 'intense')),
    exercises JSONB NOT NULL DEFAULT '[]',
    warmup JSONB,
    cooldown JSONB,
    notes TEXT,
    ai_generated BOOLEAN DEFAULT FALSE,
    recovery_adjusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workouts_user_date ON workouts(user_id, date DESC);
CREATE INDEX idx_workouts_exercises ON workouts USING GIN(exercises);

-- RLS Policies
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workouts"
    ON workouts FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Trainers can view client workouts"
    ON workouts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = workouts.user_id
        AND profiles.trainer_id = auth.uid()
    ));
```

**Exercises JSONB Structure:**
```json
[
  {
    "name": "Bench Press",
    "sets": 4,
    "reps": "8-10",
    "weight": 135,
    "rest_seconds": 90,
    "notes": "Focus on form",
    "target_muscles": ["chest", "triceps", "shoulders"],
    "completed": true
  }
]
```

---

### nutrition_logs

Daily aggregated nutrition totals (one record per user per day).

```sql
CREATE TABLE nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_calories INTEGER DEFAULT 0,
    total_protein INTEGER DEFAULT 0,
    total_carbs INTEGER DEFAULT 0,
    total_fats INTEGER DEFAULT 0,
    water_intake INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Indexes
CREATE INDEX idx_nutrition_logs_user_date ON nutrition_logs(user_id, date DESC);

-- RLS Policies
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own nutrition logs"
    ON nutrition_logs FOR ALL
    USING (auth.uid() = user_id);
```

---

### meal_entries

Individual meal records.

```sql
CREATE TABLE meal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    description TEXT NOT NULL,
    calories INTEGER NOT NULL DEFAULT 0,
    protein INTEGER NOT NULL DEFAULT 0,
    carbs INTEGER NOT NULL DEFAULT 0,
    fats INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    ai_analyzed BOOLEAN DEFAULT FALSE,
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_meal_entries_user_date ON meal_entries(user_id, date DESC);
CREATE INDEX idx_meal_entries_meal_type ON meal_entries(meal_type);

-- RLS Policies
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal entries"
    ON meal_entries FOR ALL
    USING (auth.uid() = user_id);
```

---

### progress_photos

Body composition progress tracking.

```sql
CREATE TABLE progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    front_url TEXT NOT NULL,
    side_url TEXT NOT NULL,
    back_url TEXT NOT NULL,
    weight DECIMAL(5,2),
    body_fat_percentage DECIMAL(4,1),
    measurements JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_progress_photos_user_date ON progress_photos(user_id, date DESC);

-- RLS Policies
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress photos"
    ON progress_photos FOR ALL
    USING (auth.uid() = user_id);
```

**Measurements JSONB Structure:**
```json
{
  "chest": 42,
  "waist": 32,
  "hips": 40,
  "bicep_left": 15,
  "bicep_right": 15,
  "thigh_left": 24,
  "thigh_right": 24
}
```

---

### trainer_invites

Manages trainer-client relationships.

```sql
CREATE TABLE trainer_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    client_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    invite_code TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_trainer_invites_code ON trainer_invites(invite_code);
CREATE INDEX idx_trainer_invites_email ON trainer_invites(client_email);

-- RLS Policies
ALTER TABLE trainer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage own invites"
    ON trainer_invites FOR ALL
    USING (auth.uid() = trainer_id);
```

---

## Triggers

### Auto-create Profile on Signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NOW(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Update Timestamp on Profile Change

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON nutrition_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Storage Buckets

### user-photos

```sql
-- Create bucket (via Supabase Dashboard or API)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true);

-- RLS Policies
CREATE POLICY "Users can upload own photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'user-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can view own photos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'user-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can delete own photos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'user-photos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Public read access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'user-photos');
```

---

## Migrations

### Initial Setup

```sql
-- Run in order:
-- 1. Create profiles table (with trigger)
-- 2. Create workouts table
-- 3. Create nutrition_logs table
-- 4. Create meal_entries table
-- 5. Create progress_photos table
-- 6. Create trainer_invites table
-- 7. Enable RLS on all tables
-- 8. Create storage bucket and policies
```

### Adding New Columns (Example)

```sql
-- Add body fat tracking to progress_photos
ALTER TABLE progress_photos
ADD COLUMN body_fat_percentage DECIMAL(4,1);

-- Add index for performance
CREATE INDEX idx_progress_photos_body_fat
ON progress_photos(user_id, body_fat_percentage)
WHERE body_fat_percentage IS NOT NULL;
```

---

## Performance Considerations

### Indexes

All tables have composite indexes on `(user_id, date)` for efficient user-specific date-range queries.

### Query Patterns

```sql
-- Common query: Get recent workouts
SELECT * FROM workouts
WHERE user_id = $1
ORDER BY date DESC
LIMIT 50;

-- Common query: Get nutrition for date range
SELECT * FROM nutrition_logs
WHERE user_id = $1
AND date BETWEEN $2 AND $3
ORDER BY date ASC;

-- Common query: Get meals for a day
SELECT * FROM meal_entries
WHERE user_id = $1
AND date = $2
ORDER BY created_at ASC;
```

### Data Retention

Consider implementing data archival for:
- Workouts older than 2 years
- Meal entries older than 1 year
- Audit logs older than 90 days

```sql
-- Archive old workouts (example)
INSERT INTO workouts_archive
SELECT * FROM workouts
WHERE date < NOW() - INTERVAL '2 years';

DELETE FROM workouts
WHERE date < NOW() - INTERVAL '2 years';
```
