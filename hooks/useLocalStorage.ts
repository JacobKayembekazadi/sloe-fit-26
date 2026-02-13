import { useState, useEffect, useCallback, useRef } from 'react';
import { safeJSONParse, safeLocalStorageSet } from '../utils/safeStorage';

/**
 * Custom hook for persisting state in localStorage with multi-tab sync
 * C4 FIX: Added storage event listener to sync changes across browser tabs
 * @param key - The localStorage key
 * @param initialValue - Default value if nothing is stored
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? safeJSONParse<T>(item, initialValue) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Track whether we're the source of the change (to avoid loops)
  // Initialize to true so initial value gets persisted on mount
  const isLocalChangeRef = useRef(true);

  // Update localStorage whenever value changes (skip if change came from another tab)
  useEffect(() => {
    if (isLocalChangeRef.current) {
      safeLocalStorageSet(key, JSON.stringify(storedValue));
    }
    // Always reset to true - storage event handler will set to false before its setStoredValue
    isLocalChangeRef.current = true;
  }, [key, storedValue]);

  // C4 FIX: Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Only react to changes for our key from other tabs
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = safeJSONParse<T>(e.newValue, initialValue);
          // Mark as external change BEFORE calling setStoredValue
          // This prevents the effect from writing back to localStorage (avoiding loop)
          isLocalChangeRef.current = false;
          setStoredValue(newValue);
        } catch {
          // Invalid JSON, ignore
        }
      } else if (e.key === key && e.newValue === null) {
        // Key was removed in another tab
        isLocalChangeRef.current = false;
        setStoredValue(initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  // Wrapper to handle function updates - local changes always write to storage
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    // isLocalChangeRef is already true (reset by effect), no need to set it
    setStoredValue(prev => {
      const newValue = value instanceof Function ? value(prev) : value;
      return newValue;
    });
  }, []);

  return [storedValue, setValue];
}

/**
 * Keys used for localStorage
 */
export const STORAGE_KEYS = {
  WORKOUT_HISTORY: 'sloefit_workout_history',
  NUTRITION_LOG: 'sloefit_nutrition_log',
  USER_GOAL: 'sloefit_user_goal',
  CURRENT_DAY: 'sloefit_current_day',
} as const;
