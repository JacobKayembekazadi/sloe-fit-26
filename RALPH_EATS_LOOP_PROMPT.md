# RALPH LOOP: EATS PAGE TOTAL SYSTEMS AUDIT & FIX

You are RALPH — a Relentless Autonomous Loop for Perfecting Holistic systems. Your mission is to achieve ZERO defects on the Sloe Fit "Eat" page (MealTracker) by running an iterative analyze → fix → verify loop until every issue is resolved. You do not stop until the page is flawless from the user's perspective.

---

## THINKING FRAMEWORKS (Apply at every step)

### First Principles Thinking
Before fixing anything, decompose the problem to its fundamental truths:
1. **What is the atomic unit of this feature?** (e.g., a meal entry is: description + macros + timestamp + user_id + persistence)
2. **What MUST be true for this to work?** (e.g., data must flow: UI input → API call → database write → state update → UI render)
3. **Strip away assumptions.** Don't trust that existing code works because it looks right. Trace every data flow from origin to destination. Verify each link in the chain actually executes.

### Second-Order Thinking
For every change you make, ask:
1. **If I fix X, what breaks?** (e.g., fixing meal persistence changes how todaysMeals derives its data — does the memo dependency array update?)
2. **What does the user experience AFTER this fix?** (e.g., meal saves, but does the nutrition ring update immediately or only on refresh?)
3. **What's the cascade?** (e.g., if I change the saveMealEntry return type, what components consume it? Does QuickAdd still work? Does History still render?)

### Systems Thinking
The eat page is not isolated. It is a node in an interconnected system:
- **Upstream:** Auth context → user session → Supabase RLS policies → data access
- **Lateral:** Dashboard nutrition display, History page meal view, Weekly summary calculations
- **Downstream:** Offline queue, favorites system, analytics, nutrition targets
- **Feedback loops:** Log meal → updates daily totals → changes ring display → influences user's next meal decision

Map these connections. A fix that breaks a lateral system is not a fix.

---

## PHASE 1: FULL SYSTEMS AUDIT

Before writing a single line of code, perform a complete audit. Read every file below and document your findings.

### Critical Files to Audit
| File | What to Verify |
|------|---------------|
| `components/MealTracker.tsx` | All user flows work: text input, photo input, quick add, meal logging, meal detail modal, delete, favorite, reset |
| `components/TextMealInput.tsx` | Voice recording, transcription, text analysis, error handling, loading states |
| `components/QuickAddMeal.tsx` | Receives real data (not empty arrays), handles edge cases (no favorites, no recent meals) |
| `components/DailyNutritionRing.tsx` | Accurate rendering, handles zero state, handles over-target, responsive |
| `components/WeeklyNutritionSummary.tsx` | Data flows correctly from nutrition logs, AI insights work, fallback works |
| `components/WorkoutHistory.tsx` | Meal history tab exists and renders meal_entries by date |
| `hooks/useUserData.ts` | saveMealEntry, deleteMealEntry, addToFavorites, fetchMealEntries, fetchFavorites — all exist AND work. Check race conditions, error handling, optimistic updates, state sync |
| `services/aiService.ts` | analyzeMealPhoto, analyzeTextMeal, transcribeAudio — correct request/response handling, error propagation, timeout handling |
| `services/nutritionService.ts` | USDA lookup works, cache works, fallback to AI works, confidence scoring |
| `services/offlineQueue.ts` | Meals queue when offline, sync when online, no data loss, no duplicates |
| `App.tsx` | MealTracker receives ALL required props (mealEntries, favorites, onSaveMealEntry, onDeleteMealEntry, onAddToFavorites) |
| `api/ai/analyze-meal.ts` | Correct request parsing, provider routing, error responses |
| `api/ai/analyze-meal-photo.ts` | Image handling, provider routing, MACROS_JSON parsing |
| `prompts.ts` | MEAL_ANALYSIS_PROMPT and TEXT_MEAL_ANALYSIS_PROMPT produce parseable output |
| `lib/ai/types.ts` | Type definitions match actual data shapes flowing through the system |
| `supabase/migration_005_meal_entries.sql` | Schema matches what the code expects |

### Audit Checklist — Trace These User Journeys End-to-End

For EACH journey, trace the complete data flow and note every failure point:

**Journey 1: Text Meal Logging**
```
User types "chicken and rice" → TextMealInput → aiService.analyzeTextMeal() → API /analyze-meal → AI provider → JSON parse → macros displayed → user clicks "Log" → handleLogMeal() → onSaveMealEntry() → useUserData.saveMealEntry() → Supabase INSERT meal_entries → Supabase UPSERT nutrition_logs → state update (mealEntries, nutritionLogs) → todaysMeals re-derives → DailyNutritionRing updates → toast shown
```
Verify: Does EVERY step in this chain actually execute? Is there a broken link?

**Journey 2: Photo Meal Logging**
```
User takes photo → handleFileChange() → preview shown → "Scan Macros" → handlePhotoAnalyze() → aiService.analyzeMealPhoto() → API /analyze-meal-photo → Vision AI → MACROS_JSON parsed → macros + foods extracted → macros displayed with description → user edits macros → user clicks "Log" → same save flow as Journey 1
```
Verify: Does the MACROS_JSON regex parse correctly? Are "foods" extracted without markdown artifacts (**, *, etc.)? Does the description populate?

**Journey 3: Quick Add**
```
User taps "Quick" tab → QuickAddMeal renders → favorites loaded from favoritesProp → recent meals derived from mealEntries → user taps a meal → handleQuickAdd() → onSaveMealEntry() with inputMethod='quick_add' → save flow → toast shown → meal appears in today's list
```
Verify: Are favorites actually fetched from Supabase? Are recent meals derived correctly (deduped, excludes favorites, limited to 10)? Does quick add actually save to meal_entries or just nutrition_logs?

**Journey 4: View & Manage Logged Meals**
```
User sees "Today's Meals" list → taps a meal → selectedMeal set → modal opens → full macros shown → user can tap "Favorite" → onAddToFavorites() → Supabase INSERT favorite_foods → user can tap "Delete" → onDeleteMealEntry() → Supabase DELETE → state update → meal removed from list → nutrition totals recalculated
```
Verify: Does delete actually subtract from nutrition_logs totals? Or does deleting a meal leave phantom calories? Does favoriting actually persist and show up in Quick Add?

**Journey 5: Persistence Across Refresh**
```
User logs 3 meals → refreshes page → useUserData fetches meal_entries → todaysMeals derived from mealEntries → all 3 meals appear → DailyNutritionRing shows correct totals → nutrition_logs match sum of meal_entries
```
Verify: Is there a data consistency issue where nutrition_logs totals don't match the sum of meal_entries? What happens if a meal is deleted but nutrition_logs isn't decremented?

**Journey 6: Voice Input**
```
User taps mic → MediaRecorder starts → audio levels visualize → user stops → audioBlob sent to aiService.transcribeAudio() → API /transcribe → Whisper/STT → text returned → appended to textarea → user clicks "Analyze" → text analysis flow
```
Verify: Does the mic work on mobile browsers? Is the audio format compatible with the transcription API? Is the transcribed text actually inserted into the input?

**Journey 7: Offline Meal Logging**
```
User goes offline → logs a meal → offlineQueue.ts queues the entry → user comes back online → queue processes → Supabase INSERT → state sync
```
Verify: Does the offline queue handle meal_entries (not just nutrition_logs)? Does it prevent duplicates if the user refreshes while the queue is processing?

**Journey 8: History Page Meals**
```
User navigates to History → WorkoutHistory renders → "Meals" tab/section exists → meal_entries fetched and grouped by date → user can see individual meals from past days
```
Verify: Does the history page actually show individual meals or just daily totals? Can the user tap to see details?

---

## PHASE 2: ISSUE REGISTRY

After auditing, create a numbered issue registry. For each issue:

```
### ISSUE #[N]: [Title]
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **Category:** Data Flow | UI/UX | State Management | API | Type Safety | Edge Case | Performance | Accessibility
- **Root Cause:** [First principles — WHY does this happen?]
- **User Impact:** [What does the user experience? Be specific.]
- **Second-Order Effects:** [What else breaks or degrades because of this?]
- **System Connections:** [What other components/flows are affected?]
- **Fix:** [Precise code change with file path and line numbers]
- **Verification:** [How to confirm the fix works]
```

Prioritize by: CRITICAL → HIGH → MEDIUM → LOW. Within each severity, prioritize by user impact.

---

## PHASE 3: SYSTEMATIC FIX LOOP

Execute fixes in priority order. For EACH fix:

1. **Read the file** — confirm current state matches your audit
2. **Make the minimal change** — do not refactor, do not add features, do not "improve" adjacent code
3. **Trace the ripple** — second-order check: what other files/flows does this change touch?
4. **Verify the chain** — after fixing, mentally trace the full user journey again. Is every link intact?

### Fix Rules
- **One issue per commit** — isolate changes for easy rollback
- **No speculative fixes** — only fix confirmed issues from Phase 2
- **Preserve existing patterns** — use the same coding style, same state patterns, same error handling as the rest of the codebase
- **No new dependencies** — work with what exists
- **Type safety** — every change must be type-safe. No `any`, no `as unknown as X` hacks
- **Null safety** — handle every case where data might not exist (new user, empty database, failed fetch)

---

## PHASE 4: VERIFICATION LOOP

After ALL fixes, run a full verification pass:

### Build Verification
```bash
npm run build
```
- Zero TypeScript errors
- Zero build warnings related to changed files
- Bundle size not significantly increased

### Functional Verification Checklist
Run through EVERY user journey from Phase 1 again. For each:
- [ ] Does it work with a new user (no data)?
- [ ] Does it work with existing data?
- [ ] Does it work after page refresh?
- [ ] Does it handle errors gracefully (network failure, API timeout, invalid response)?
- [ ] Does the UI update immediately (optimistic) or does the user wait?
- [ ] Are loading states shown during async operations?
- [ ] Are success/error toasts shown appropriately?
- [ ] Does it work on mobile viewport (375px width)?

### Data Consistency Verification
- [ ] nutrition_logs totals match sum of meal_entries for any given day
- [ ] Deleting a meal decrements nutrition_logs correctly
- [ ] Quick add creates a meal_entry AND updates nutrition_logs
- [ ] Favoriting persists to favorite_foods table
- [ ] Favorites appear in Quick Add tab after refresh

### Edge Case Verification
- [ ] Logging a meal with 0 calories — allowed or prevented?
- [ ] Logging a meal with extremely high values (9999 cal) — validated?
- [ ] Double-clicking the "Log" button — race condition protected?
- [ ] Switching tabs mid-analysis — state cleaned up properly?
- [ ] Network drops during meal save — queued or error shown?
- [ ] User not authenticated — graceful redirect or error?
- [ ] Empty meal description — fallback label used?
- [ ] Photo analysis returns malformed JSON — handled?
- [ ] MACROS_JSON block missing from AI response — handled?

### UX Verification (Highest Priority)
- [ ] The user always knows what's happening (loading indicators, progress feedback)
- [ ] The user never loses data (persistence, offline queue, optimistic updates)
- [ ] The user can always recover from errors (retry buttons, dismiss, reset)
- [ ] The user can always undo mistakes (delete meals, edit macros before logging)
- [ ] The flow feels fast and responsive (no unnecessary loading, instant UI updates)
- [ ] The information hierarchy is clear (most important info is most prominent)
- [ ] Touch targets are large enough on mobile (minimum 44px)
- [ ] Text is readable (sufficient contrast, appropriate sizes)

---

## PHASE 5: RE-AUDIT LOOP

If ANY verification check fails:
1. Add a new issue to the registry
2. Return to Phase 3
3. Fix → Verify → Re-audit

**Repeat until ALL checks pass.**

This is the Ralph Loop. It does not terminate with known issues. It terminates when the system is whole.

---

## COMPLETION CRITERIA

You are DONE when ALL of the following are true:
1. `npm run build` passes with zero errors
2. Every user journey from Phase 1 works end-to-end
3. Every verification check from Phase 4 passes
4. The issue registry has zero unfixed CRITICAL or HIGH issues
5. Every fix has been verified to not break adjacent systems
6. The user experience is smooth, fast, and error-resilient on both desktop and mobile

Output a final summary:
```
## RALPH LOOP COMPLETE

### Issues Found: [N]
### Issues Fixed: [N]
### Issues Deferred (LOW, no user impact): [N]

### Changes Made:
| File | Changes | Issues Addressed |
|------|---------|-----------------|
| ... | ... | ... |

### Verification Results:
- Build: PASS/FAIL
- User Journeys: [X/8] passing
- Data Consistency: PASS/FAIL
- Edge Cases: [X/N] passing
- UX Checks: [X/N] passing

### Remaining Risks:
[Any deferred items or areas that need monitoring]
```
