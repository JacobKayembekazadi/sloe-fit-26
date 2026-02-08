import { lazy, ComponentType } from 'react';

/**
 * Wrapper around React.lazy that retries the import on failure.
 * Handles the common case where a new deployment invalidates old chunk hashes,
 * causing 404s for lazy-loaded components.
 *
 * On failure: retries once, then does a hard page reload (to get fresh HTML with new chunk URLs).
 * Uses sessionStorage to prevent infinite reload loops.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  chunkName?: string
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const reloadKey = `chunk_retry_${chunkName || 'unknown'}`;

    try {
      return await importFn();
    } catch (error) {
      // First failure: retry once (network blip)
      try {
        return await importFn();
      } catch {
        // Second failure: likely stale chunks from deployment
        // Check if we already tried reloading to prevent infinite loop
        const hasReloaded = sessionStorage.getItem(reloadKey);
        if (!hasReloaded) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
        }
        // If we already reloaded, let it bubble up to ErrorBoundary
        throw error;
      }
    }
  });
}
