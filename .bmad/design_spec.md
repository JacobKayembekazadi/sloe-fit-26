# Sloe Fit 2.0 - Design Specification

## 🎨 Design Philosophy: "Mobile-First Premium"
Based on the provided inspiration, we will shift from a functional web-dashboard look to a sleek, immersive mobile app experience.

**Core Pillars:**
1.  **Immersive Dark Mode**: Deep blacks (`#000000`, `#111111`) with high-contrast text.
2.  **Neon Accents**: Use a signature "Sloe Volt" (e.g., `#D4FF00` or `#B4F8C8`) for primary actions to create a "premium gym" feel.
3.  **Thumb-Friendly Navigation**: Move navigation to a fixed bottom bar.
4.  **Card-Based UI**: Content grouped in rounded containers (`rounded-2xl`) with subtle borders, imitating native app cards.
5.  **Visual Data**: Use rings, bars, and icons heavily instead of dense text.

---

## 🛠️ Implementation Strategy

### 1. Global Layout (The "App Shell")
-   **Current**: Header at top, Tabs below it, Content below that.
-   **New Mobile Layout**:
    -   **Header**: Sticky top or large, scrolling title.
    -   **Content**: Scrollable area in the middle.
    -   **Navigation**: Fixed bottom bar with icons (Home, Body, Meals, Mindset, Progress).

### 2. Typography & Color System
-   **Headings**: `font-black`, tight tracking (`tracking-tighter`), large size.
-   **Body**: Readable sans-serif, high contrast grays (`text-gray-200`).
-   **Primary Color**: Neon Lime (`text-[#D4FF00]`, `bg-[#D4FF00]`) for primary buttons and active states.
-   **Surface Color**: Dark Gray (`bg-[#1C1C1E]`) for cards to separate from the black background.

### 3. Component Transformations

**Dashboard**
-   Transform the list of nutrition bars into a **Nutrition Ring** or grouped cards.
-   Make the "Start Workout" button a large, floating action button (FAB) or full-width sticky button.

**Product Cards (Shopify)**
-   Style them like high-end e-commerce mobile cues: large images, clear price, bold "Add" button.

**Mindset**
-   Turn text blocks into **Swipeable Stories** or a "Daily Card" that looks like a notification or quote of the day.

---

## 🚀 Execution Plan

1.  **Setup Design Tokens**: Update `index.css` / Tailwind classes for the new palette.
2.  **Build `BottomNav`**: Replace the top `Tabs` component.
3.  **Refactor `App.tsx`**: Implement the mobile shell layout (100vh container, hidden scrollbars).
4.  **Polish Components**: Go screen-by-screen (Dashboard -> Body -> etc.), applying the new Card and Typography styles.
