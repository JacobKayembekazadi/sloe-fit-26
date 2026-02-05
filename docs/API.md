# Sloe Fit API Documentation

## Overview

Sloe Fit uses a serverless architecture with:
- **Supabase** - Authentication, PostgreSQL database, and file storage
- **Vercel Edge Functions** - AI API proxy routes
- **Shopify Storefront API** - E-commerce integration

## Authentication

All authenticated endpoints require a valid JWT token from Supabase Auth.

### Token Retrieval

```typescript
// Token is automatically managed by Supabase client
// Access via localStorage (handled internally)
const storageKey = `sb-${projectId}-auth-token`;
const { access_token } = JSON.parse(localStorage.getItem(storageKey));
```

### Authentication Headers

```http
Authorization: Bearer <access_token>
apikey: <VITE_SUPABASE_ANON_KEY>
```

---

## Supabase REST API

Base URL: `https://<project>.supabase.co/rest/v1/`

### Profiles

#### Get Profile

```http
GET /profiles?id=eq.{userId}&select=*
Authorization: Required (JWT)
RLS: Users can only read own profile
```

**Response:**
```json
{
  "id": "uuid",
  "full_name": "string",
  "goals": "string | null",
  "fitness_level": "beginner | intermediate | advanced",
  "equipment_access": ["string"],
  "dietary_preferences": ["string"],
  "target_calories": "number | null",
  "target_protein": "number | null",
  "target_carbs": "number | null",
  "target_fats": "number | null",
  "weight": "number | null",
  "height": "number | null",
  "age": "number | null",
  "gender": "male | female | other | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

#### Update Profile

```http
PATCH /profiles?id=eq.{userId}
Content-Type: application/json
Authorization: Required (JWT)
RLS: Users can only update own profile
```

**Request Body:**
```json
{
  "full_name": "string",
  "goals": "string",
  "target_calories": 2000
}
```

---

### Workouts

#### List Workouts

```http
GET /workouts?user_id=eq.{userId}&order=date.desc&limit=50
Authorization: Required (JWT)
RLS: Users can only read own workouts
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "title": "string",
    "date": "YYYY-MM-DD",
    "duration_minutes": "number",
    "exercises": [
      {
        "name": "string",
        "sets": "number",
        "reps": "string",
        "rest_seconds": "number",
        "target_muscles": ["string"]
      }
    ],
    "notes": "string | null",
    "created_at": "timestamp"
  }
]
```

#### Create Workout

```http
POST /workouts
Content-Type: application/json
Prefer: return=representation
Authorization: Required (JWT)
```

**Request Body:**
```json
{
  "user_id": "uuid",
  "title": "Morning Workout",
  "date": "2024-02-04",
  "duration_minutes": 45,
  "exercises": [...],
  "notes": "Optional notes"
}
```

#### Delete Workout

```http
DELETE /workouts?id=eq.{workoutId}
Authorization: Required (JWT)
RLS: Users can only delete own workouts
```

---

### Nutrition Logs

#### Get Daily Log

```http
GET /nutrition_logs?user_id=eq.{userId}&date=eq.{date}
Authorization: Required (JWT)
RLS: Users can only read own logs
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "date": "YYYY-MM-DD",
  "total_calories": "number",
  "total_protein": "number",
  "total_carbs": "number",
  "total_fats": "number",
  "notes": "string | null"
}
```

#### Upsert Daily Log

```http
POST /nutrition_logs?on_conflict=user_id,date
Content-Type: application/json
Prefer: return=representation,resolution=merge-duplicates
Authorization: Required (JWT)
```

**Request Body:**
```json
{
  "user_id": "uuid",
  "date": "2024-02-04",
  "total_calories": 2100,
  "total_protein": 150,
  "total_carbs": 200,
  "total_fats": 70
}
```

---

### Meal Entries

#### List Meals by Date

```http
GET /meal_entries?user_id=eq.{userId}&date=eq.{date}&order=created_at
Authorization: Required (JWT)
RLS: Users can only read own meals
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "date": "YYYY-MM-DD",
    "meal_type": "breakfast | lunch | dinner | snack",
    "description": "string",
    "calories": "number",
    "protein": "number",
    "carbs": "number",
    "fats": "number",
    "image_url": "string | null",
    "created_at": "timestamp"
  }
]
```

#### Create Meal Entry

```http
POST /meal_entries
Content-Type: application/json
Prefer: return=representation
Authorization: Required (JWT)
```

---

## AI API Routes (Vercel Edge Functions)

Base URL: `/api/ai/`

All AI endpoints are server-side proxies that handle API keys securely.

### Analyze Meal (Text)

```http
POST /api/ai/analyze-meal
Content-Type: application/json
```

**Request:**
```json
{
  "description": "Grilled chicken breast with rice and broccoli",
  "userGoal": "weight_loss | muscle_gain | maintenance | null"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "foods": [
      {
        "name": "Grilled chicken breast",
        "portion": "6 oz",
        "calories": 280,
        "protein": 52,
        "carbs": 0,
        "fats": 6
      }
    ],
    "totals": {
      "calories": 450,
      "protein": 55,
      "carbs": 45,
      "fats": 8
    },
    "confidence": "high | medium | low",
    "notes": "string"
  },
  "provider": "openai | anthropic | google",
  "durationMs": 1234
}
```

### Analyze Meal Photo

```http
POST /api/ai/analyze-meal-photo
Content-Type: application/json
```

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "userGoal": "weight_loss | null"
}
```

### Generate Workout

```http
POST /api/ai/generate-workout
Content-Type: application/json
```

**Request:**
```json
{
  "profile": {
    "fitness_level": "intermediate",
    "equipment_access": ["dumbbells", "pull-up bar"],
    "goals": "Build muscle"
  },
  "recovery": {
    "sleep_quality": 8,
    "soreness_level": 3,
    "energy_level": 7
  },
  "recentWorkouts": [
    {
      "title": "Upper Body",
      "date": "2024-02-02",
      "muscles": ["chest", "shoulders", "triceps"]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Lower Body Strength",
    "duration_minutes": 45,
    "intensity": "moderate",
    "recovery_adjusted": true,
    "recovery_notes": "Adjusted based on moderate soreness",
    "warmup": {
      "duration_minutes": 5,
      "exercises": [...]
    },
    "exercises": [
      {
        "name": "Goblet Squat",
        "sets": 4,
        "reps": "8-10",
        "rest_seconds": 90,
        "target_muscles": ["quadriceps", "glutes"]
      }
    ],
    "cooldown": {
      "duration_minutes": 5,
      "exercises": [...]
    }
  }
}
```

### Transcribe Audio

```http
POST /api/ai/transcribe
Content-Type: application/json
```

**Request:**
```json
{
  "audioBase64": "base64-encoded-audio",
  "mimeType": "audio/webm"
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "type": "network | timeout | rate_limit | auth | validation | server_error | unknown",
    "message": "Human-readable error message",
    "retryable": true
  },
  "provider": "openai",
  "durationMs": 5000
}
```

### Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `network` | Network connectivity issue | Yes |
| `timeout` | Request timed out | Yes |
| `rate_limit` | Too many requests | Yes (after delay) |
| `auth` | Authentication failed | No |
| `validation` | Invalid request data | No |
| `server_error` | Server-side error | Yes |
| `content_filter` | Content policy violation | No |
| `quota_exceeded` | API quota exhausted | No |

---

## Rate Limits

### Client-Side Limits

| Operation | Max Requests | Window |
|-----------|-------------|--------|
| AI meal analysis | 10 | 1 minute |
| AI workout generation | 5 | 1 minute |
| Image uploads | 20 | 1 minute |
| Database reads | 100 | 1 minute |
| Database writes | 50 | 1 minute |

### Server-Side Limits (Vercel)

- Edge Functions: 1000 invocations/day (Hobby)
- Execution time: 30s max per request

---

## Timeouts

| Service | Timeout |
|---------|---------|
| Supabase | 20s |
| AI operations | 45s |
| File uploads | 60s |
| Shopify API | 15s |

---

## Storage

### Buckets

- `user-photos` - User-uploaded images

### File Paths

```
{userId}/body/{timestamp}.{ext}      # Body analysis photos
{userId}/meal/{timestamp}.{ext}      # Meal photos
{userId}/progress/{timestamp}_{view}.{ext}  # Progress photos (front/side/back)
```

### Limits

- Max file size: 10MB
- Allowed types: `image/jpeg`, `image/png`, `image/webp`

---

## Environment Variables

### Required (Production)

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Server-side only (Edge Functions)
AI_PROVIDER=openai
AI_API_KEY=sk-...
```

### Optional

```bash
VITE_SHOPIFY_STORE_DOMAIN=store.myshopify.com
VITE_SHOPIFY_STOREFRONT_ACCESS_TOKEN=xxx
```
