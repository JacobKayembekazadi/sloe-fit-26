# Ralph Loop: Complete Mobile Responsiveness & Optimization Audit

This prompt systematically reviews EVERY component in the Sloe Fit app for mobile responsiveness. Work through each section in order, fixing issues as you find them. After completing ALL sections and verifying the build passes, output `<promise>MOBILE OPTIMIZATION COMPLETE</promise>`.

---

## PHASE 1: Global Styles & Foundation

### 1.1 Check `index.css` for mobile base styles

**File:** `index.css`

**Verify/Add these mobile essentials:**
```css
/* Prevent horizontal scroll on mobile */
html, body {
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
}

/* Prevent text size adjustment on orientation change */
html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
}

/* Ensure all interactive elements have minimum 44px touch targets */
button, a, input, select, textarea, [role="button"] {
    min-height: 44px;
    min-width: 44px;
}

/* Prevent double-tap zoom on buttons */
button, [role="button"] {
    touch-action: manipulation;
}
```

### 1.2 Check `index.html` viewport meta

**File:** `index.html`

**Verify viewport includes:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5, user-scalable=yes" />
```

---

## PHASE 2: Layout Components

### 2.1 Header.tsx

**File:** `components/Header.tsx`

**Check for:**
- [ ] Touch targets >= 44px for all buttons
- [ ] Proper spacing on notched devices (safe-area-inset-top)
- [ ] Text truncation for long usernames
- [ ] Responsive icon sizes (use sm: breakpoints)

**Common fixes:**
```tsx
// Ensure buttons have min touch target
<button className="min-w-[44px] min-h-[44px] flex items-center justify-center ...">

// Add safe area padding if fixed at top
<header className="pt-[env(safe-area-inset-top)] ...">
```

### 2.2 BottomNav.tsx

**File:** `components/BottomNav.tsx`

**Check for:**
- [ ] Safe area inset bottom: `pb-[env(safe-area-inset-bottom)]`
- [ ] Fixed positioning with proper z-index
- [ ] Touch targets >= 44px for each nav item
- [ ] Labels visible but not cramped on small screens
- [ ] Active state feedback (scale, color change)

**Fix pattern:**
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-white/10 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
    <div className="flex justify-around items-center h-16">
        {/* Each nav item should be min 44x44 */}
        <button className="flex flex-col items-center justify-center min-w-[64px] min-h-[44px] ...">
```

### 2.3 OfflineBanner.tsx

**File:** `components/OfflineBanner.tsx`

**Check for:**
- [ ] Fixed top with safe-area-inset-top
- [ ] Doesn't overlap with header
- [ ] Proper z-index stacking

---

## PHASE 3: Authentication Screens

### 3.1 WelcomeScreen.tsx

**File:** `components/WelcomeScreen.tsx`

**Check for:**
- [ ] Full viewport height: `min-h-screen` or `min-h-[100dvh]`
- [ ] Background image responsive scaling
- [ ] Text sizing responsive: `text-3xl sm:text-4xl md:text-5xl`
- [ ] Buttons full width on mobile: `w-full sm:w-auto`
- [ ] Safe area padding at bottom for CTA buttons

### 3.2 LoginScreen.tsx

**File:** `components/LoginScreen.tsx`

**Check for:**
- [ ] Form inputs have proper padding for touch: `py-3 px-4`
- [ ] Keyboard doesn't obscure inputs (test with virtual keyboard)
- [ ] Error messages visible and not cut off
- [ ] Submit button accessible when keyboard is open
- [ ] Use `min-h-[100dvh]` instead of `min-h-screen` for dynamic viewport

**Fix for keyboard handling:**
```tsx
// Use dvh units for true viewport height accounting for mobile browser chrome
<div className="min-h-[100dvh] flex flex-col">
    {/* Scrollable form area */}
    <div className="flex-1 overflow-y-auto">
        {/* Form content */}
    </div>
    {/* Fixed submit button at bottom - optional */}
</div>
```

---

## PHASE 4: Onboarding Flow

### 4.1 Onboarding.tsx

**File:** `components/Onboarding.tsx`

**Check for:**
- [ ] Step indicators visible and not cramped
- [ ] Back/Next buttons have adequate spacing
- [ ] Content scrollable if exceeds viewport
- [ ] Progress bar responsive width

### 4.2 OnboardingQuiz.tsx

**File:** `components/onboarding/OnboardingQuiz.tsx`

**Check for:**
- [ ] Question text readable (min 16px)
- [ ] Option buttons full width on mobile
- [ ] Touch targets >= 44px
- [ ] Scrollable content area

### 4.3 GoalSelector.tsx

**File:** `components/onboarding/GoalSelector.tsx`

**Check for:**
- [ ] Cards stack vertically on mobile: `flex flex-col sm:flex-row`
- [ ] Card touch targets adequate
- [ ] Selected state clearly visible

### 4.4 HurdleIdentifier.tsx

**File:** `components/onboarding/HurdleIdentifier.tsx`

**Check for:**
- [ ] Multi-select buttons wrap properly
- [ ] Selected state visible (check color contrast)

### 4.5 PhysiqueEstimator.tsx

**File:** `components/onboarding/PhysiqueEstimator.tsx`

**Check for:**
- [ ] Image selection grid responsive
- [ ] Images don't overflow container

### 4.6 TrajectoryGraph.tsx

**File:** `components/onboarding/TrajectoryGraph.tsx`

**Check for:**
- [ ] SVG viewBox scales properly
- [ ] Labels readable on small screens

---

## PHASE 5: Main Dashboard

### 5.1 Dashboard.tsx

**File:** `components/Dashboard.tsx`

**Check for:**
- [ ] Card grid: `grid-cols-1 sm:grid-cols-2`
- [ ] Cards have proper padding: `p-4 sm:p-6`
- [ ] Workout card CTAs full width on mobile
- [ ] Nutrition summary readable
- [ ] Modal overlays full screen on mobile

**Common responsive grid fix:**
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
```

---

## PHASE 6: Workout Experience (CRITICAL - Full Screen Overlays)

### 6.1 WorkoutSession.tsx

**File:** `components/WorkoutSession.tsx`

**CRITICAL - This is an immersive full-screen experience. Check:**
- [ ] Uses `fixed inset-0` for full screen coverage
- [ ] Safe area insets on all sides
- [ ] Header area respects notch: `pt-[env(safe-area-inset-top)]`
- [ ] Bottom controls respect home indicator: `pb-[max(1rem,env(safe-area-inset-bottom))]`
- [ ] Exercise list scrollable with proper overflow
- [ ] Input fields (weight/reps) have adequate size for thumb input
- [ ] Buttons >= 44px touch targets
- [ ] Landscape orientation handled (test!)

**Fix pattern for full-screen overlay:**
```tsx
<div className="fixed inset-0 z-50 flex flex-col bg-background-dark">
    {/* Header with safe area */}
    <div className="shrink-0 pt-[env(safe-area-inset-top)] px-[env(safe-area-inset-left)]">
        {/* Close button, title */}
    </div>

    {/* Scrollable content area */}
    <div className="flex-1 overflow-y-auto px-4 sm:px-6">
        {/* Exercise list */}
    </div>

    {/* Fixed bottom controls with safe area */}
    <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/10">
        {/* Complete set / Next exercise buttons */}
    </div>
</div>
```

### 6.2 RestTimer.tsx

**File:** `components/RestTimer.tsx`

**CRITICAL - Full screen timer overlay. Check:**
- [ ] Uses `fixed inset-0`
- [ ] Timer display large and readable: `text-5xl sm:text-6xl`
- [ ] +/- buttons have large touch targets (48px+)
- [ ] Skip button full width and prominent
- [ ] Works in landscape orientation

### 6.3 WorkoutPreview.tsx

**File:** `components/WorkoutPreview.tsx`

**Check for:**
- [ ] Exercise list scrollable
- [ ] Start workout button sticky at bottom with safe area
- [ ] Stats grid responsive: `grid-cols-3` with text sizing

### 6.4 WorkoutSummary.tsx

**File:** `components/WorkoutSummary.tsx`

**Check for:**
- [ ] Celebration animation doesn't overflow
- [ ] Stats readable on small screens
- [ ] Rating picker touch targets >= 44px
- [ ] Done button has safe area padding

### 6.5 RecoveryCheckIn.tsx

**File:** `components/RecoveryCheckIn.tsx`

**Check for:**
- [ ] Question text readable
- [ ] Color-coded buttons (red/yellow/green) have adequate size
- [ ] Progress indicators visible

### 6.6 WorkoutSetsLogger.tsx

**File:** `components/WorkoutSetsLogger.tsx`

**Check for:**
- [ ] Input fields have adequate padding for touch
- [ ] Set rows don't overflow horizontally
- [ ] Add/remove set buttons accessible

### 6.7 ActiveWorkoutTimer.tsx

**File:** `components/ActiveWorkoutTimer.tsx`

**Check for:**
- [ ] Timer text large and readable
- [ ] Doesn't interfere with other elements

---

## PHASE 7: Meal Tracking

### 7.1 MealTracker.tsx

**File:** `components/MealTracker.tsx`

**Check for:**
- [ ] Mode selector tabs touch-friendly
- [ ] Photo upload button large enough
- [ ] Results display scrollable
- [ ] Nutrition ring sized appropriately

### 7.2 DailyNutritionRing.tsx

**File:** `components/DailyNutritionRing.tsx`

**Check for:**
- [ ] SVG scales with container
- [ ] Text inside ring readable
- [ ] Macro bars visible

### 7.3 TextMealInput.tsx

**File:** `components/TextMealInput.tsx`

**Check for:**
- [ ] Textarea has adequate height
- [ ] Submit button accessible

### 7.4 QuickAddMeal.tsx

**File:** `components/QuickAddMeal.tsx`

**Check for:**
- [ ] Meal cards in responsive grid
- [ ] Touch targets adequate

### 7.5 WeeklyNutritionSummary.tsx

**File:** `components/WeeklyNutritionSummary.tsx`

**Check for:**
- [ ] Day columns don't overflow
- [ ] Numbers readable

---

## PHASE 8: Body Analysis & Photos

### 8.1 BodyAnalysis.tsx

**File:** `components/BodyAnalysis.tsx`

**Check for:**
- [ ] Camera preview fills width but maintains aspect ratio
- [ ] Upload button prominent
- [ ] Analysis results scrollable
- [ ] Image doesn't overflow container

### 8.2 ProgressPhotos.tsx

**File:** `components/ProgressPhotos.tsx`

**Check for:**
- [ ] Photo grid responsive: `grid-cols-2 sm:grid-cols-3`
- [ ] Camera capture works on mobile
- [ ] Compare mode layout works on small screens

---

## PHASE 9: History & Charts

### 9.1 WorkoutHistory.tsx

**File:** `components/WorkoutHistory.tsx`

**Check for:**
- [ ] Filter tabs scrollable horizontally if needed
- [ ] Workout cards stack properly
- [ ] Charts resize to container width

### 9.2 ProgressChart.tsx

**File:** `components/ProgressChart.tsx`

**Check for:**
- [ ] ResponsiveContainer used correctly
- [ ] Axis labels readable (may need to hide on mobile)
- [ ] Touch interaction works for tooltips

**Mobile chart optimization:**
```tsx
// Consider hiding Y-axis labels on very small screens
<YAxis
    tick={{ fontSize: 10 }}
    width={window.innerWidth < 400 ? 30 : 50}
    tickFormatter={(value) => value.toLocaleString()}
/>
```

---

## PHASE 10: Settings & Profile

### 10.1 Settings.tsx

**File:** `components/Settings.tsx`

**Check for:**
- [ ] Form sections properly spaced
- [ ] Input fields full width on mobile
- [ ] Save button accessible (not hidden by keyboard)
- [ ] Profile image upload works

---

## PHASE 11: E-Commerce

### 11.1 CartDrawer.tsx

**File:** `components/CartDrawer.tsx`

**Check for:**
- [ ] Full width on mobile: `w-full sm:w-96`
- [ ] Slides in from right properly
- [ ] Close button has safe area padding
- [ ] Cart items list scrollable
- [ ] Checkout button sticky at bottom with safe area

**Mobile drawer fix:**
```tsx
<div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[var(--bg-card)] transform transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
    {/* Drawer content */}
    <div className="flex flex-col h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
```

### 11.2 ProductCard.tsx

**File:** `components/ProductCard.tsx`

**Check for:**
- [ ] Image aspect ratio maintained
- [ ] Price readable
- [ ] Add to cart button touch-friendly

---

## PHASE 12: Mindset & Coaching

### 12.1 Mindset.tsx

**File:** `components/Mindset.tsx`

**Check for:**
- [ ] Carousel swipe gesture works
- [ ] Navigation dots touch-friendly
- [ ] Content text readable

---

## PHASE 13: Trainer Features

### 13.1 TrainerDashboard.tsx

**File:** `components/TrainerDashboard.tsx`

**Check for:**
- [ ] Client list scrollable
- [ ] Stats grid responsive
- [ ] Action buttons touch-friendly

### 13.2 ClientTrainerView.tsx

**File:** `components/ClientTrainerView.tsx`

**Check for:**
- [ ] Trainer info card responsive
- [ ] Workout assignments list scrollable

### 13.3 JoinInvite.tsx

**File:** `components/JoinInvite.tsx`

**Check for:**
- [ ] Invite code input large enough
- [ ] Modal properly sized on mobile

---

## PHASE 14: Utility Components

### 14.1 LoadingScreen.tsx

**File:** `components/LoadingScreen.tsx`

**Check for:**
- [ ] Centered on all screen sizes
- [ ] Skeleton matches actual layout

### 14.2 ErrorBoundary.tsx

**File:** `components/ErrorBoundary.tsx`

**Check for:**
- [ ] Error message readable
- [ ] Retry button accessible

### 14.3 InstallPrompt.tsx

**File:** `components/InstallPrompt.tsx`

**Check for:**
- [ ] Banner doesn't obscure content
- [ ] Dismiss button touch-friendly

---

## PHASE 15: Final Verification

After completing all phases:

1. **Run build:** `npm run build` - must pass with no errors

2. **Manual testing checklist:**
   - [ ] Test on 320px width (iPhone SE)
   - [ ] Test on 375px width (iPhone 12/13)
   - [ ] Test on 390px width (iPhone 14 Pro)
   - [ ] Test landscape orientation
   - [ ] Test with virtual keyboard open
   - [ ] Verify all touch targets >= 44px
   - [ ] Verify safe area insets work

3. **Browser DevTools responsive testing:**
   - Chrome DevTools device toolbar
   - Test multiple device presets

---

## Verification Checklist

After EACH file fix:
1. Run `npm run build` - must succeed
2. No TypeScript errors
3. Changes follow existing code patterns

When ALL 15 phases are complete and build succeeds:
```
<promise>MOBILE OPTIMIZATION COMPLETE</promise>
```

---

## Quick Reference: Common Mobile Patterns

### Safe Area Template
```tsx
// Full-screen overlay with all safe areas
<div className="fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
```

### Responsive Text
```tsx
// Heading
<h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">

// Body
<p className="text-sm sm:text-base">
```

### Responsive Spacing
```tsx
<div className="p-4 sm:p-6 md:p-8">
<div className="gap-3 sm:gap-4 md:gap-6">
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Touch-Friendly Button
```tsx
<button className="min-h-[44px] min-w-[44px] px-4 py-3 touch-manipulation">
```

### Dynamic Viewport Height
```tsx
// Use dvh for true mobile viewport (accounts for browser chrome)
<div className="min-h-[100dvh]">
```
