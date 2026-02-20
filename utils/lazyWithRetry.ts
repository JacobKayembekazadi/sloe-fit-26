import { lazy, ComponentType } from 'react';

/**
 * Wrapper around React.lazy that retries the import on failure.
 * Handles the common case where a new deployment invalidates old chunk hashes,
 * causing 404s for lazy-loaded components.
 *
 * On failure: retries once, then does a hard page reload (to get fresh HTML with new chunk URLs).
 * Uses sessionStorage to prevent infinite reload loops.
 * Dispatches an emergency save event before reloading so active workouts can persist their draft.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  chunkName?: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const reloadKey = `chunk_retry_${chunkName || 'unknown'}`;

    try {
      const result = await importFn();
      // H5 FIX: Clear retry key on success so future deploys can still auto-reload
      sessionStorage.removeItem(reloadKey);
      return result;
    } catch (error) {
      // First failure: retry once (network blip)
      try {
        const result = await importFn();
        sessionStorage.removeItem(reloadKey);
        return result;
      } catch {
        // Second failure: likely stale chunks from deployment
        // Check if we already tried reloading to prevent infinite loop
        const hasReloaded = sessionStorage.getItem(reloadKey);
        if (!hasReloaded) {
          sessionStorage.setItem(reloadKey, '1');
          // C4 FIX: Dispatch emergency save event so WorkoutSession can persist draft
          window.dispatchEvent(new CustomEvent('sloefit-emergency-save'));
          // Brief delay to let the save complete
          await new Promise(r => setTimeout(r, 150));
          window.location.reload();
        }
        // If we already reloaded, let it bubble up to ErrorBoundary
        throw error;
      }
    }
  });
}
