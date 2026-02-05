# Ralph Loop Bug Fix Prompt

Fix the following 4 remaining bugs in priority order. After fixing each bug, run `npm run build` to verify no TypeScript errors were introduced. When ALL bugs are fixed and the build succeeds, output `<promise>ALL BUGS FIXED</promise>`.

---

## Bug 1: Shopify CORS Errors (HIGH)

**Files:** `services/shopifyService.ts`, `contexts/ShopifyContext.tsx`

**Problem:** Direct browser requests to Shopify Storefront API are blocked by CORS when running on localhost.

**Console Error:**
```
Access to fetch at 'https://sloe-fit.myshopify.com/api/2025-01/graphql' from origin 'http://localhost:3005' has been blocked by CORS policy
```

**Fix:** Disable Shopify in development mode to prevent CORS spam:

In `contexts/ShopifyContext.tsx`, update the initialization:
```typescript
useEffect(() => {
    // Skip Shopify initialization in development to avoid CORS errors
    if (import.meta.env.DEV) {
        console.info('[Shopify] Disabled in development mode to avoid CORS issues');
        return;
    }
    initCheckout();
}, []);
```

Also add better error handling in `services/shopifyService.ts` to suppress repeated CORS errors:
```typescript
export const fetchProduct = async (productId: string): Promise<ShopifyProduct | null> => {
    const shopifyClient = initializeShopifyClient();
    if (!shopifyClient) {
        if (import.meta.env.DEV) return null; // Silent in dev
        console.warn('[Shopify] Client not initialized');
        return null;
    }

    try {
        const product = await shopifyClient.product.fetch(productId);
        return product as ShopifyProduct;
    } catch (error: any) {
        if (!import.meta.env.DEV) {
            console.error('[Shopify] fetchProduct error:', error);
        }
        return null;
    }
};
```

---

## Bug 2: Password Input Autocomplete Warning (LOW)

**File:** Find the login form component (likely `components/LoginScreen.tsx` or `components/AuthForm.tsx`)

**Problem:** Password input missing autocomplete attribute.

**Console Warning:**
```
Input elements should have autocomplete attributes (suggested: "current-password")
```

**Fix:** Add autocomplete attribute to all password inputs:
```tsx
<input
    type="password"
    autoComplete="current-password"  // Use "new-password" for registration forms
    // ... other props
/>
```

For email/username inputs, add:
```tsx
<input
    type="email"
    autoComplete="email"
    // ... other props
/>
```

---

## Bug 3: Deprecated Apple Meta Tag (LOW)

**File:** `index.html`

**Problem:** Using deprecated PWA meta tag.

**Console Warning:**
```
<meta name="apple-mobile-web-app-capable" content="yes"> is deprecated. Please include <meta name="mobile-web-app-capable" content="yes">
```

**Fix:** In `index.html`, find and replace:
```html
<!-- OLD (remove this) -->
<meta name="apple-mobile-web-app-capable" content="yes">

<!-- NEW (add this) -->
<meta name="mobile-web-app-capable" content="yes">
```

---

## Bug 4: Excessive Debug Logging (LOW - OPTIONAL)

**Files:** `hooks/useUserData.ts`, `App.tsx`

**Problem:** Console shows many repeated render logs causing noise during development.

**Fix:** Gate debug console.logs to only show occasionally or remove them:

In `hooks/useUserData.ts` (around line 579):
```typescript
// Remove or comment out
// console.log('[useUserData] Render - loadingState:', loadingState, '...');
```

In `App.tsx` (around line 108 and 164):
```typescript
// Remove or comment out
// console.log('[App] loading:', loading, '...');
// console.log('[App] renderContent called, currentView:', currentView);
```

Alternatively, gate them behind a flag:
```typescript
const DEBUG_RENDERS = false;
if (DEBUG_RENDERS) {
    console.log('[App] loading:', loading, '...');
}
```

---

## Verification Checklist

After each fix:
1. Run `npm run build` - must succeed with no errors
2. Run `npm run dev` and check browser console
3. Verify the specific error/warning is gone

When ALL bugs are fixed and build succeeds:
```
<promise>ALL BUGS FIXED</promise>
```
