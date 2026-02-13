# Sloe Fit Soul

> The personality and voice that makes Sloe Fit feel human.

---

## Voice: King Kay Mix

Direct coaching energy with celebration moments. We don't coddle, but we always have your back.

**Think**: Tough love trainer who high-fives you when you earn it.

---

## Core Principles

### 1. Real Talk
No fluffy language. Tell it like it is. Users respect honesty over sugar-coating.

**Do**: "Didn't hit your protein today. Tomorrow's a new day."
**Don't**: "Oopsie! Looks like your protein was a teensy bit low today!"

### 2. Earned Celebration
Celebrate wins, but make celebrations meaningful. Reserve the big energy for real milestones.

**Do**: Day 30 gets a trophy. Random Tuesday gets a simple checkmark.
**Don't**: Fireworks every time someone logs a glass of water.

### 3. Forward Motion
Always point toward the next step. Every message should either confirm completion or guide action.

**Do**: "Workout logged. Recovery time."
**Don't**: "Great job! You're doing amazing! Keep it up! We believe in you!"

### 4. Respect Time
Keep messages punchy, not preachy. Users are busy. Say what needs saying, then get out of the way.

**Do**: "Saved."
**Don't**: "Your settings have been successfully saved to our secure servers!"

---

## Emoji Guidelines

### USE Emojis For:
- **Milestones**: 🔥 🏆 💪 (achievement moments)
- **Empty States**: 👀 🍽️ 📸 (visual anchors for empty screens)
- **Success Confirmations**: ✅ (task complete indicators)
- **Section Headers**: Already in Settings.tsx (keep this pattern)

### AVOID Emojis For:
- Every single toast message (becomes noise)
- Loading states (just show the spinner)
- Error messages (keep errors clear and direct)
- Multiple emojis in one message (one max)

### NEVER:
- Emoji-only messages (always include text)
- Sad/negative emojis (😢 😞 ❌ - too childish)
- Trendy/meme emojis (💀 🤡 🙃 - wrong tone)

---

## Message Templates by Context

### Toasts (Success)

| Action | Message |
|--------|---------|
| Meal logged | "Meal tracked. Keep it going." |
| Workout complete | "Workout logged 💪" |
| Settings saved | "Saved." |
| Profile updated | "Updated." |
| Photo uploaded | "Photo saved." |
| Goal changed | "New goal set. Let's get after it." |
| Supplements saved | "Supplements updated." |

### Toasts (Error)

| Situation | Message |
|-----------|---------|
| Generic error | "That didn't work. Try again." |
| Network error | "Lost connection. Check your signal." |
| Validation fail | "[specific issue]. Fix and retry." |
| Auth error | "Session expired. Log in again." |
| AI unavailable | "AI's taking a break. Try again shortly." |
| Upload failed | "Upload failed. Check file size." |

### Empty States

| Screen | Message |
|--------|---------|
| No meals today | "Empty plate 👀 Log your first meal to start tracking." |
| No workouts | "Rest day or getting started? Generate a workout when ready." |
| No progress photos | "Track your transformation. Take your first photo 📸" |
| No weekly plan | "No plan yet. Generate one to map out your week." |
| No body analysis | "See your starting point. Upload a photo for AI analysis." |

### Milestones (Day Counter)

| Day | Message | Emoji |
|-----|---------|-------|
| 1 | "Day 1. Everyone starts somewhere." | - |
| 7 | "Week 1 down. Building the habit." | 🔥 |
| 14 | "Two weeks in. Momentum building." | 🔥 |
| 21 | "Three weeks. Habit territory." | 🔥 |
| 30 | "30 days. You're not dabbling anymore." | 🏆 |
| 60 | "Two months. This is becoming you." | 🔥 |
| 90 | "90 days. Quarter of a year. Solid." | 🏆 |
| 100 | "Triple digits. This is who you are now." | 🏆 |
| 365 | "One year. Legend status." | 🏆 |

### Error Recovery

| Situation | Message |
|-----------|---------|
| AI meal analysis failed | "AI couldn't read that. Try a clearer photo or enter manually." |
| Workout generation failed | "Couldn't generate workout. Try again or use the library." |
| Body analysis failed | "Analysis didn't work. Check the photo and try again." |
| Sync failed | "Changes saved locally. Will sync when back online." |

---

## AI Coach Voice (prompts.ts)

The AI prompts already have strong personality. Keep this energy:

**Characteristics**:
- Direct and actionable
- Uses "you" language
- Short sentences
- No corporate speak
- Encouraging but not fake

**Example** (from existing prompts):
> "You're building something real here. Every rep counts, every meal matters. Let's map out your week."

---

## Anti-Patterns to Avoid

### Don't Be Corporate
❌ "Your request has been processed successfully"
✅ "Done."

### Don't Be Condescending
❌ "Great job logging your meal! You're doing so well!"
✅ "Meal tracked."

### Don't Be Vague
❌ "Something went wrong"
✅ "Couldn't save. Try again."

### Don't Over-Explain
❌ "Click the button below to generate your personalized AI-powered workout plan"
✅ "Generate workout"

### Don't Use Passive Voice
❌ "Your workout has been completed"
✅ "Workout logged 💪"

---

## Implementation Notes

### For Developers

1. **Toasts**: Use `showToast(message, type)` - keep messages under 40 characters
2. **Empty States**: Include an emoji anchor, context, and clear CTA
3. **Milestones**: Check `programDay` against milestone thresholds
4. **Errors**: Be specific about what failed and what to do next

### Voice Checklist
Before shipping any user-facing text, ask:
- [ ] Is this under 10 words? (toasts should be)
- [ ] Does it tell them what to do next? (for errors/empty states)
- [ ] Would a coach actually say this? (not a robot)
- [ ] Is the emoji earned? (milestone or visual anchor only)

---

*Last updated: 2026-02-13*
*Voice: King Kay Mix | Emoji Level: Moderate*
