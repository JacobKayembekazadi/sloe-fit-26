# RALPH EATS PAGE BUGFIX PROMPT

## Overview

The "Eats" (MealTracker) page has **critical data persistence issues**. The database schema exists (`meal_entries`, `favorite_foods` tables) but is **completely disconnected** from the UI. Meals are lost after logging, nothing shows on the history page, and quick-add features don't work.

---

## Bug #1: Individual Meals Not Persisted (CRITICAL)

**Severity:** CRITICAL
**Location:** [useUserData.ts:507-528](hooks/useUserData.ts#L507-L528), [MealTracker.tsx:152-169](components/MealTracker.tsx#L152-L169)

### Problem
When a meal is logged, ONLY daily totals are saved to `nutrition_logs`. Individual meal entries are **never saved** to the `meal_entries` table that already exists in the database (see [migration_005_meal_entries.sql](supabase/migration_005_meal_entries.sql)).

### Current Flow (Broken)
```
User logs meal → addMealToDaily() → Only updates nutrition_logs totals → Individual meal data LOST
```

### Expected Flow
```
User logs meal → saveMealEntry() → Save to meal_entries → THEN update nutrition_logs totals
```

### Fix Required
1. Add `saveMealEntry()` function to `useUserData.ts`:
```typescript
const saveMealEntry = useCallback(async (entry: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    inputMethod?: 'photo' | 'text' | 'quick_add';
    photoUrl?: string;
}) => {
    if (!user) return null;

    const { data, error } = await supabaseInsert('meal_entries', {
        user_id: user.id,
        date: formatDateForDB(),
        meal_type: entry.mealType || null,
        input_method: entry.inputMethod || 'text',
        description: entry.description,
        photo_url: entry.photoUrl || null,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats
    });

    if (!error) {
        // Also update daily totals
        await addMealToDaily({
            calories: entry.calories,
            protein: entry.protein,
            carbs: entry.carbs,
            fats: entry.fats
        });
    }

    return data;
}, [user, addMealToDaily]);
```

2. Update `MealTracker.tsx` to pass meal description and use the new function
3. Export and use `saveMealEntry` instead of `addMealToDaily` for meal logging

---

## Bug #2: Quick-Add Has Hardcoded Empty Arrays (CRITICAL)

**Severity:** CRITICAL
**Location:** [MealTracker.tsx:71-73](components/MealTracker.tsx#L71-L73)

### Problem
```typescript
// Line 71-73 - ALWAYS EMPTY!
const [favorites] = useState<SavedMeal[]>([]);
const [recentMeals] = useState<SavedMeal[]>([]);
```

The comment says "in production, fetch from Supabase" but this was never implemented. The `favorite_foods` table exists but is never queried.

### Fix Required
1. Add `fetchFavorites()` and `fetchRecentMeals()` to `useUserData.ts`:
```typescript
// Add to state
const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);

// Fetch in fetchAllData()
const mealEntriesFetch = rawFetch(
    `meal_entries?select=*&user_id=eq.${userId}&order=created_at.desc&limit=20`
);
const favoritesFetch = rawFetch(
    `favorite_foods?select=*&user_id=eq.${userId}&order=times_logged.desc&limit=10`
);
```

2. Update `MealTracker.tsx` to receive and use real data from the hook

---

## Bug #3: Today's Meals Disappear on Refresh (HIGH)

**Severity:** HIGH
**Location:** [MealTracker.tsx:68](components/MealTracker.tsx#L68), [MealTracker.tsx:141-145](components/MealTracker.tsx#L141-L145)

### Problem
```typescript
// Line 68 - Local state only, lost on refresh
const [todaysMeals, setTodaysMeals] = useState<{ name: string; calories: number; time: string }[]>([]);
```

Meals logged during the session are stored only in React state. When you refresh or navigate away, they vanish.

### Fix Required
1. Fetch today's meals from `meal_entries` on component mount
2. `todaysMeals` should be derived from fetched `meal_entries` filtered by today's date:
```typescript
const todaysMeals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return mealEntries
        .filter(m => m.date === today)
        .map(m => ({
            id: m.id,
            name: m.description || 'Meal',
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fats: m.fats,
            time: new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            mealType: m.meal_type
        }));
}, [mealEntries]);
```

---

## Bug #4: Can't Click Meals to View Details (MEDIUM)

**Severity:** MEDIUM
**Location:** [MealTracker.tsx:420-446](components/MealTracker.tsx#L420-L446)

### Problem
The "Today's Meals" list shows only name and calories. Users cannot:
- Click to see full macro breakdown (protein, carbs, fats)
- Edit a logged meal
- Delete a logged meal

### Current Code
```typescript
// Line 430-444 - No onClick handler, minimal info shown
<div key={idx} className="flex justify-between items-center py-3 px-3 bg-gray-800/50 rounded-lg">
    <span className="text-white font-medium">{meal.name}</span>
    <span className="text-[var(--color-primary)] font-bold">{meal.calories} cal</span>
</div>
```

### Fix Required
1. Add meal detail modal/expandable view
2. Show full macros (P/C/F) when clicked
3. Add edit/delete buttons
4. Create `deleteMealEntry()` function in `useUserData.ts`

---

## Bug #5: Meals Don't Appear in History Page (HIGH)

**Severity:** HIGH
**Location:** [WorkoutHistory.tsx](components/WorkoutHistory.tsx)

### Problem
The history page (`WorkoutHistory.tsx`) shows:
- Workout history ✓
- Weekly nutrition summary (daily totals) ✓
- Individual meal history ✗

There's no way to see what specific meals were eaten on previous days.

### Fix Required
1. Add a "Meals" tab/section to the history page
2. Create `MealHistory` component that fetches and displays `meal_entries` by date
3. Group meals by day with expandable details

---

## Bug #6: Meal Labels Are Generic (LOW)

**Severity:** LOW
**Location:** [MealTracker.tsx:158-159](components/MealTracker.tsx#L158-L159)

### Problem
```typescript
// Line 158-159 - Always "Logged Meal", not descriptive
setTodaysMeals(prev => [...prev, {
    name: 'Logged Meal',  // Generic!
    calories: macros.calories,
    time: new Date().toLocaleTimeString(...)
}]);
```

Meals are labeled "Logged Meal" instead of using the actual food description from the AI analysis.

### Fix Required
1. Pass the meal description from AI analysis result to the logging function
2. Store `description` in local state and save to database
3. For photo meals, use a summarized version of the AI response

---

## Bug #7: Favorite Foods Never Saved (MEDIUM)

**Severity:** MEDIUM
**Location:** Not implemented

### Problem
The `favorite_foods` table has a `times_logged` column designed to track frequently eaten meals, but:
- No UI to mark a meal as favorite
- No logic to auto-detect frequent meals
- `QuickAddMeal` component has `onAddToFavorites` prop but it's never passed

### Fix Required
1. Add `addToFavorites()` function to `useUserData.ts`
2. Add favorite star button to meal entries
3. Optionally: Auto-suggest adding to favorites after logging same meal 3+ times

---

## Implementation Priority

1. **Bug #1** - Save individual meals (enables everything else)
2. **Bug #2** - Fetch favorites/recent meals
3. **Bug #3** - Persist today's meals across refresh
4. **Bug #5** - Show meals in history page
5. **Bug #4** - Clickable meal details
6. **Bug #6** - Better meal labels
7. **Bug #7** - Favorite foods functionality

---

## Database Tables (Already Exist)

```sql
-- meal_entries (migration_005) - EXISTS BUT UNUSED
CREATE TABLE meal_entries (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    date DATE DEFAULT CURRENT_DATE,
    meal_type TEXT, -- breakfast/lunch/dinner/snack
    input_method TEXT, -- photo/text/quick_add
    description TEXT,
    photo_url TEXT,
    calories INTEGER NOT NULL,
    protein INTEGER NOT NULL,
    carbs INTEGER NOT NULL,
    fats INTEGER NOT NULL,
    created_at TIMESTAMPTZ
);

-- favorite_foods (migration_005) - EXISTS BUT UNUSED
CREATE TABLE favorite_foods (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein INTEGER NOT NULL,
    carbs INTEGER NOT NULL,
    fats INTEGER NOT NULL,
    times_logged INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

---

## Files to Modify

| File | Changes Needed |
|------|---------------|
| [hooks/useUserData.ts](hooks/useUserData.ts) | Add `saveMealEntry`, `fetchMealEntries`, `fetchFavorites`, `deleteMealEntry`, `addToFavorites` |
| [components/MealTracker.tsx](components/MealTracker.tsx) | Use real data, pass descriptions, add meal detail view |
| [components/QuickAddMeal.tsx](components/QuickAddMeal.tsx) | Receive real favorites/recents from props |
| [components/WorkoutHistory.tsx](components/WorkoutHistory.tsx) | Add meal history section |
| [App.tsx](App.tsx) | Pass new props to MealTracker |

---

## Verification Checklist

- [ ] Log a meal via text input → appears in today's meals
- [ ] Log a meal via photo → appears in today's meals
- [ ] Refresh page → logged meals persist
- [ ] Click a meal → see full macro breakdown
- [ ] Navigate to history → see individual meals by day
- [ ] Quick-add tab → shows recent meals
- [ ] Log same meal multiple times → appears in quick-add "recent"
- [ ] Build passes without errors
