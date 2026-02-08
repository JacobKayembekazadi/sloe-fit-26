import { useState, useEffect, useCallback } from 'react';
import { safeJSONParse, safeLocalStorageSet } from '../utils/safeStorage';

/**
 * Custom hook for persisting state in localStorage
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

  // Update localStorage whenever value changes
  useEffect(() => {
    safeLocalStorageSet(key, JSON.stringify(storedValue));
  }, [key, storedValue]);

  // Wrapper to handle function updates
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
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
