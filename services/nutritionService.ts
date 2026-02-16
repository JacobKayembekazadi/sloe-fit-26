/**
 * USDA FoodData Central API Service
 *
 * Provides accurate nutrition data for common foods using the official
 * USDA FoodData Central database. This supplements AI estimates with
 * real, verified nutrition information.
 */

// API Configuration - support both Vite (client) and Node (server) environments
const USDA_API_KEY = (typeof process !== 'undefined' && process.env?.USDA_API_KEY)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USDA_API_KEY)
  || '';
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Warn if API key is missing (in development)
const isDev = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
  || (typeof import.meta !== 'undefined' && import.meta.env?.DEV);
if (!USDA_API_KEY && isDev) {
  console.warn('[nutritionService] USDA_API_KEY not configured. USDA lookups will be skipped.');
}

// Cache configuration
const CACHE_KEY_PREFIX = 'usda_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Types
// ============================================================================

export interface USDAFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

export interface USDAFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandName?: string;
  brandOwner?: string;
  foodNutrients: USDAFoodNutrient[];
}

export interface USDASearchResult {
  foods: USDAFood[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

export interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  source: 'usda' | 'ai';
  fdcId?: number;
  description?: string;
}

// USDA Nutrient IDs
const NUTRIENT_IDS = {
  ENERGY: 1008,      // Energy (kcal)
  PROTEIN: 1003,     // Protein (g)
  CARBS: 1005,       // Carbohydrate, by difference (g)
  FAT: 1004,         // Total lipid (fat) (g)
  FIBER: 1079,       // Fiber, total dietary (g)
  SUGAR: 2000,       // Sugars, total (g)
};

// ============================================================================
// Cache Utilities with LRU Eviction
// ============================================================================

const CACHE_META_KEY = 'usda_cache_meta';
const MAX_CACHE_SIZE = 2 * 1024 * 1024; // 2MB limit (localStorage is typically 5MB)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheMeta {
  keys: string[];
  totalSize: number;
}

function getCacheMeta(): CacheMeta {
  try {
    const meta = localStorage.getItem(CACHE_META_KEY);
    if (meta) {
      return JSON.parse(meta);
    }
  } catch {
    // Ignore parse errors
  }
  return { keys: [], totalSize: 0 };
}

function saveCacheMeta(meta: CacheMeta): void {
  try {
    localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage errors
  }
}

function getCacheKey(type: string, query: string): string {
  return `${CACHE_KEY_PREFIX}${type}_${query.toLowerCase().replace(/\s+/g, '_')}`;
}

function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    const now = Date.now();

    if (now - entry.timestamp > CACHE_TTL_MS) {
      // Remove expired entry and update metadata
      localStorage.removeItem(key);
      const meta = getCacheMeta();
      const keyIndex = meta.keys.indexOf(key);
      if (keyIndex > -1) {
        meta.keys.splice(keyIndex, 1);
        meta.totalSize -= cached.length * 2; // UTF-16 encoding
        saveCacheMeta(meta);
      }
      return null;
    }

    // Move to end of keys array (LRU - most recently used)
    const meta = getCacheMeta();
    const keyIndex = meta.keys.indexOf(key);
    if (keyIndex > -1) {
      meta.keys.splice(keyIndex, 1);
      meta.keys.push(key);
      saveCacheMeta(meta);
    }

    return entry.data;
  } catch {
    return null;
  }
}

function evictOldestEntries(meta: CacheMeta, requiredSpace: number): void {
  // Evict oldest entries (from front of array) until we have enough space
  while (meta.totalSize + requiredSpace > MAX_CACHE_SIZE && meta.keys.length > 0) {
    const oldestKey = meta.keys.shift();
    if (oldestKey) {
      try {
        const item = localStorage.getItem(oldestKey);
        if (item) {
          meta.totalSize -= item.length * 2;
        }
        localStorage.removeItem(oldestKey);
      } catch {
        // Ignore removal errors
      }
    }
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    const serialized = JSON.stringify(entry);
    const dataSize = serialized.length * 2; // UTF-16 encoding

    const meta = getCacheMeta();

    // Check if key already exists (update case)
    const existingIndex = meta.keys.indexOf(key);
    if (existingIndex > -1) {
      const existingItem = localStorage.getItem(key);
      if (existingItem) {
        meta.totalSize -= existingItem.length * 2;
      }
      meta.keys.splice(existingIndex, 1);
    }

    // Evict oldest entries if needed
    evictOldestEntries(meta, dataSize);

    // Try to store the item
    try {
      localStorage.setItem(key, serialized);
      meta.keys.push(key);
      meta.totalSize += dataSize;
      saveCacheMeta(meta);
    } catch (e) {
      // Handle QuotaExceededError
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        // Emergency eviction: remove half the cache
        const toRemove = Math.ceil(meta.keys.length / 2);
        for (let i = 0; i < toRemove && meta.keys.length > 0; i++) {
          const oldKey = meta.keys.shift();
          if (oldKey) {
            try {
              const item = localStorage.getItem(oldKey);
              if (item) {
                meta.totalSize -= item.length * 2;
              }
              localStorage.removeItem(oldKey);
            } catch {
              // Ignore
            }
          }
        }
        // Try again
        try {
          localStorage.setItem(key, serialized);
          meta.keys.push(key);
          meta.totalSize += dataSize;
          saveCacheMeta(meta);
        } catch {
          // Give up on this cache entry
        }
      }
    }
  } catch {
    // Cache is disabled or other error, ignore
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Search for foods in the USDA database
 */
export async function searchFood(query: string, pageSize: number = 5): Promise<USDAFood[]> {
  // Skip if API key not configured
  if (!USDA_API_KEY) {
    return [];
  }

  if (!query || query.trim().length < 2) {
    return [];
  }

  // Check cache first
  const cacheKey = getCacheKey('search', query);
  const cached = getFromCache<USDAFood[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      api_key: USDA_API_KEY,
      query: query.trim(),
      pageSize: pageSize.toString(),
      dataType: 'Foundation,SR Legacy,Branded', // Include common food types
    });

    const response = await fetch(`${USDA_BASE_URL}/foods/search?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('USDA API error:', response.status);
      return [];
    }

    const data: USDASearchResult = await response.json();
    const foods = data.foods || [];

    // Cache the results
    setCache(cacheKey, foods);

    return foods;
  } catch (error) {
    console.error('Error searching USDA database:', error);
    return [];
  }
}

/**
 * Get detailed nutrition data for a specific food by FDC ID
 */
export async function getFoodDetails(fdcId: number): Promise<USDAFood | null> {
  // Skip if API key not configured
  if (!USDA_API_KEY) {
    return null;
  }

  // Check cache first
  const cacheKey = getCacheKey('food', fdcId.toString());
  const cached = getFromCache<USDAFood>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('USDA API error:', response.status);
      return null;
    }

    const food: USDAFood = await response.json();

    // Cache the result
    setCache(cacheKey, food);

    return food;
  } catch (error) {
    console.error('Error fetching food details:', error);
    return null;
  }
}

/**
 * Extract macros from USDA food nutrients
 */
export function extractMacrosFromUSDA(food: USDAFood): NutritionData {
  const nutrients = food.foodNutrients || [];

  const findNutrient = (id: number): number => {
    const nutrient = nutrients.find(n => n.nutrientId === id);
    return nutrient?.value || 0;
  };

  return {
    calories: Math.round(findNutrient(NUTRIENT_IDS.ENERGY)),
    protein: Math.round(findNutrient(NUTRIENT_IDS.PROTEIN)),
    carbs: Math.round(findNutrient(NUTRIENT_IDS.CARBS)),
    fats: Math.round(findNutrient(NUTRIENT_IDS.FAT)),
    source: 'usda',
    fdcId: food.fdcId,
    description: food.description,
  };
}

/**
 * Search for a food and return its nutrition data if found
 * Returns null if no good match is found
 */
export async function lookupFoodNutrition(query: string): Promise<NutritionData | null> {
  const results = await searchFood(query, 3);

  if (results.length === 0) {
    return null;
  }

  // Use the first result (most relevant)
  const bestMatch = results[0];
  return extractMacrosFromUSDA(bestMatch);
}

/**
 * Calculate match confidence between query and food description
 */
export function calculateMatchConfidence(query: string, description: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedDesc = description.toLowerCase().trim();

  // Exact match
  if (normalizedDesc.includes(normalizedQuery)) {
    return 1.0;
  }

  // Check if all query words are in description
  const queryWords = normalizedQuery.split(/\s+/);
  const descWords = normalizedDesc.split(/\s+/);
  const matchedWords = queryWords.filter(qw =>
    descWords.some(dw => dw.includes(qw) || qw.includes(dw))
  );

  return matchedWords.length / queryWords.length;
}

/**
 * Search for food and return nutrition only if confidence is high enough
 */
export async function lookupFoodWithConfidence(
  query: string,
  minConfidence: number = 0.7
): Promise<NutritionData | null> {
  const results = await searchFood(query, 5);

  if (results.length === 0) {
    return null;
  }

  // Find the best match by confidence
  let bestMatch: USDAFood | null = null;
  let bestConfidence = 0;

  for (const food of results) {
    const confidence = calculateMatchConfidence(query, food.description);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = food;
    }
  }

  if (!bestMatch || bestConfidence < minConfidence) {
    return null;
  }

  const nutrition = extractMacrosFromUSDA(bestMatch);
  return nutrition;
}

/**
 * Clear the nutrition cache
 */
export function clearNutritionCache(): void {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; sizeBytes: number } {
  let count = 0;
  let sizeBytes = 0;

  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        count++;
        const value = localStorage.getItem(key);
        if (value) {
          sizeBytes += value.length * 2; // UTF-16 encoding
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return { count, sizeBytes };
}
