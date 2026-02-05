/**
 * Input Validation Utilities
 *
 * Features:
 * - XSS prevention for text inputs
 * - Prompt injection prevention for AI inputs
 * - Workout JSON schema validation
 * - Profile field validation
 * - File path validation for storage
 * - Centralized validation rules
 */

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SanitizedResult<T = string> {
  valid: boolean;
  sanitized: T;
  error?: string;
  warnings?: string[];
}

export interface UserProfile {
  id?: string;
  full_name?: string;
  goals?: string;
  fitness_level?: 'beginner' | 'intermediate' | 'advanced';
  equipment_access?: string[];
  dietary_preferences?: string[];
  target_calories?: number;
  target_protein?: number;
  target_carbs?: number;
  target_fats?: number;
  weight?: number;
  height?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
}

export interface GeneratedWorkout {
  title: string;
  duration_minutes: number;
  intensity: 'light' | 'moderate' | 'intense';
  recovery_adjusted?: boolean;
  recovery_notes?: string;
  warmup?: {
    duration_minutes: number;
    exercises: { name: string; duration: string }[];
  };
  exercises: {
    name: string;
    sets: number;
    reps: string;
    rest_seconds: number;
    notes?: string;
    target_muscles: string[];
  }[];
  cooldown?: {
    duration_minutes: number;
    exercises: { name: string; duration: string }[];
  };
}

// ============================================================================
// Configuration
// ============================================================================

const MAX_MEAL_DESCRIPTION_LENGTH = 1000;
const MAX_PROFILE_NAME_LENGTH = 100;
const MAX_GOALS_LENGTH = 500;
const MIN_CALORIES = 500;
const MAX_CALORIES = 10000;
const MIN_MACRO = 0;
const MAX_MACRO = 1000;
const MIN_WEIGHT = 20;
const MAX_WEIGHT = 500;
const MIN_HEIGHT = 50;
const MAX_HEIGHT = 300;
const MIN_AGE = 13;
const MAX_AGE = 120;

// Characters that could be used for XSS attacks
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<form/gi,
  /data:\s*text\/html/gi,
];

// Patterns that could be used for prompt injection
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|above|prior)\s+(instructions?|prompts?)/gi,
  /disregard\s+(previous|above|prior)/gi,
  /forget\s+(everything|all|your)/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions?:/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<\|im_start\|>/gi,
  /###\s*(Instruction|Human|Assistant)/gi,
];

// ============================================================================
// Text Sanitization
// ============================================================================

/**
 * Remove XSS attack vectors from text
 */
function sanitizeXSS(input: string): string {
  let sanitized = input;

  // Remove script tags and similar
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized;
}

/**
 * Check for prompt injection attempts (returns warnings, doesn't remove)
 */
function checkPromptInjection(input: string): string[] {
  const warnings: string[] = [];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      warnings.push('Input contains suspicious patterns');
      break;
    }
  }

  return warnings;
}

/**
 * Normalize whitespace in text
 */
function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/  +/g, ' ')
    .trim();
}

// ============================================================================
// Public Validation Functions
// ============================================================================

/**
 * Validate and sanitize meal description for AI analysis
 */
export const validateMealDescription = (input: string): SanitizedResult<string> => {
  if (!input || typeof input !== 'string') {
    return {
      valid: false,
      sanitized: '',
      error: 'Meal description is required',
    };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      sanitized: '',
      error: 'Meal description cannot be empty',
    };
  }

  if (trimmed.length > MAX_MEAL_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      sanitized: trimmed.slice(0, MAX_MEAL_DESCRIPTION_LENGTH),
      error: `Meal description is too long (max ${MAX_MEAL_DESCRIPTION_LENGTH} characters)`,
    };
  }

  // Sanitize for XSS (HTML entities escape)
  let sanitized = sanitizeXSS(trimmed);

  // Normalize whitespace
  sanitized = normalizeWhitespace(sanitized);

  // Check for prompt injection (warn but don't reject)
  const warnings = checkPromptInjection(trimmed);

  return {
    valid: true,
    sanitized,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Validate workout data structure
 */
export const validateWorkoutData = (data: unknown): ValidationResult => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Workout data must be an object'] };
  }

  const workout = data as Partial<GeneratedWorkout>;

  // Title validation
  if (!workout.title || typeof workout.title !== 'string') {
    errors.push('Workout title is required');
  } else if (workout.title.length > 200) {
    errors.push('Workout title is too long');
  }

  // Duration validation
  if (typeof workout.duration_minutes !== 'number') {
    errors.push('Duration must be a number');
  } else if (workout.duration_minutes < 5 || workout.duration_minutes > 240) {
    errors.push('Duration must be between 5 and 240 minutes');
  }

  // Intensity validation
  if (!['light', 'moderate', 'intense'].includes(workout.intensity as string)) {
    errors.push('Intensity must be light, moderate, or intense');
  }

  // Exercises validation
  if (!Array.isArray(workout.exercises)) {
    errors.push('Exercises must be an array');
  } else if (workout.exercises.length === 0) {
    errors.push('At least one exercise is required');
  } else {
    workout.exercises.forEach((exercise, index) => {
      if (!exercise.name || typeof exercise.name !== 'string') {
        errors.push(`Exercise ${index + 1}: name is required`);
      }
      if (typeof exercise.sets !== 'number' || exercise.sets < 1 || exercise.sets > 20) {
        errors.push(`Exercise ${index + 1}: sets must be between 1 and 20`);
      }
      if (!exercise.reps || typeof exercise.reps !== 'string') {
        errors.push(`Exercise ${index + 1}: reps is required`);
      }
      if (typeof exercise.rest_seconds !== 'number' || exercise.rest_seconds < 0 || exercise.rest_seconds > 600) {
        errors.push(`Exercise ${index + 1}: rest_seconds must be between 0 and 600`);
      }
      if (!Array.isArray(exercise.target_muscles)) {
        errors.push(`Exercise ${index + 1}: target_muscles must be an array`);
      }
    });
  }

  // Warmup validation (optional)
  if (workout.warmup) {
    if (typeof workout.warmup.duration_minutes !== 'number') {
      errors.push('Warmup duration must be a number');
    }
    if (!Array.isArray(workout.warmup.exercises)) {
      errors.push('Warmup exercises must be an array');
    }
  }

  // Cooldown validation (optional)
  if (workout.cooldown) {
    if (typeof workout.cooldown.duration_minutes !== 'number') {
      errors.push('Cooldown duration must be a number');
    }
    if (!Array.isArray(workout.cooldown.exercises)) {
      errors.push('Cooldown exercises must be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate profile update data
 */
export const validateProfileUpdate = (data: Partial<UserProfile>): ValidationResult => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Profile data must be an object'] };
  }

  // Full name validation
  if (data.full_name !== undefined) {
    if (typeof data.full_name !== 'string') {
      errors.push('Full name must be a string');
    } else if (data.full_name.length > MAX_PROFILE_NAME_LENGTH) {
      errors.push(`Full name is too long (max ${MAX_PROFILE_NAME_LENGTH} characters)`);
    }
  }

  // Goals validation
  if (data.goals !== undefined) {
    if (typeof data.goals !== 'string') {
      errors.push('Goals must be a string');
    } else if (data.goals.length > MAX_GOALS_LENGTH) {
      errors.push(`Goals is too long (max ${MAX_GOALS_LENGTH} characters)`);
    }
  }

  // Fitness level validation
  if (data.fitness_level !== undefined) {
    if (!['beginner', 'intermediate', 'advanced'].includes(data.fitness_level)) {
      errors.push('Fitness level must be beginner, intermediate, or advanced');
    }
  }

  // Equipment access validation
  if (data.equipment_access !== undefined) {
    if (!Array.isArray(data.equipment_access)) {
      errors.push('Equipment access must be an array');
    } else if (data.equipment_access.some(item => typeof item !== 'string')) {
      errors.push('Equipment access items must be strings');
    }
  }

  // Dietary preferences validation
  if (data.dietary_preferences !== undefined) {
    if (!Array.isArray(data.dietary_preferences)) {
      errors.push('Dietary preferences must be an array');
    } else if (data.dietary_preferences.some(item => typeof item !== 'string')) {
      errors.push('Dietary preference items must be strings');
    }
  }

  // Calorie target validation
  if (data.target_calories !== undefined) {
    if (typeof data.target_calories !== 'number') {
      errors.push('Target calories must be a number');
    } else if (data.target_calories < MIN_CALORIES || data.target_calories > MAX_CALORIES) {
      errors.push(`Target calories must be between ${MIN_CALORIES} and ${MAX_CALORIES}`);
    }
  }

  // Macro validations
  const macroFields = ['target_protein', 'target_carbs', 'target_fats'] as const;
  for (const field of macroFields) {
    if (data[field] !== undefined) {
      if (typeof data[field] !== 'number') {
        errors.push(`${field.replace('target_', 'Target ')} must be a number`);
      } else if ((data[field] as number) < MIN_MACRO || (data[field] as number) > MAX_MACRO) {
        errors.push(`${field.replace('target_', 'Target ')} must be between ${MIN_MACRO} and ${MAX_MACRO}`);
      }
    }
  }

  // Weight validation
  if (data.weight !== undefined) {
    if (typeof data.weight !== 'number') {
      errors.push('Weight must be a number');
    } else if (data.weight < MIN_WEIGHT || data.weight > MAX_WEIGHT) {
      errors.push(`Weight must be between ${MIN_WEIGHT} and ${MAX_WEIGHT} kg`);
    }
  }

  // Height validation
  if (data.height !== undefined) {
    if (typeof data.height !== 'number') {
      errors.push('Height must be a number');
    } else if (data.height < MIN_HEIGHT || data.height > MAX_HEIGHT) {
      errors.push(`Height must be between ${MIN_HEIGHT} and ${MAX_HEIGHT} cm`);
    }
  }

  // Age validation
  if (data.age !== undefined) {
    if (typeof data.age !== 'number') {
      errors.push('Age must be a number');
    } else if (data.age < MIN_AGE || data.age > MAX_AGE) {
      errors.push(`Age must be between ${MIN_AGE} and ${MAX_AGE}`);
    }
  }

  // Gender validation
  if (data.gender !== undefined) {
    if (!['male', 'female', 'other'].includes(data.gender)) {
      errors.push('Gender must be male, female, or other');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate image upload file
 */
export const validateImageUpload = (file: File): SanitizedResult<File> => {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  if (!file) {
    return {
      valid: false,
      sanitized: file,
      error: 'No file provided',
    };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      sanitized: file,
      error: `Invalid file type: ${file.type}. Allowed types: JPG, PNG, WebP`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      sanitized: file,
      error: `File too large: ${sizeMB}MB. Maximum size: 10MB`,
    };
  }

  // Check for suspicious file names
  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.');

  const warnings: string[] = [];
  if (sanitizedName !== file.name) {
    warnings.push('File name contained special characters that were sanitized');
  }

  return {
    valid: true,
    sanitized: file,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Validate file path for storage operations
 */
export const validateFilePath = (path: string): SanitizedResult<string> => {
  if (!path || typeof path !== 'string') {
    return {
      valid: false,
      sanitized: '',
      error: 'File path is required',
    };
  }

  const trimmed = path.trim();

  // Check for path traversal attacks
  if (trimmed.includes('..') || trimmed.includes('//')) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Invalid file path: path traversal detected',
    };
  }

  // Check for null bytes
  if (trimmed.includes('\0')) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Invalid file path: null byte detected',
    };
  }

  // Normalize path separators
  let sanitized = trimmed.replace(/\\/g, '/');

  // Remove leading slash
  if (sanitized.startsWith('/')) {
    sanitized = sanitized.slice(1);
  }

  // Validate path segments
  const segments = sanitized.split('/');
  const validSegment = /^[a-zA-Z0-9._-]+$/;

  for (const segment of segments) {
    if (segment && !validSegment.test(segment)) {
      return {
        valid: false,
        sanitized,
        error: `Invalid path segment: ${segment}`,
      };
    }
  }

  return {
    valid: true,
    sanitized,
  };
};

/**
 * Validate email address
 */
export const validateEmail = (email: string): SanitizedResult<string> => {
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      sanitized: '',
      error: 'Email is required',
    };
  }

  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Invalid email format',
    };
  }

  if (trimmed.length > 254) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Email is too long',
    };
  }

  return {
    valid: true,
    sanitized: trimmed,
  };
};

/**
 * Validate and sanitize a date string
 */
export const validateDate = (date: string): SanitizedResult<string> => {
  if (!date || typeof date !== 'string') {
    return {
      valid: false,
      sanitized: '',
      error: 'Date is required',
    };
  }

  const trimmed = date.trim();

  // Try to parse the date
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    return {
      valid: false,
      sanitized: trimmed,
      error: 'Invalid date format',
    };
  }

  // Return ISO format
  return {
    valid: true,
    sanitized: parsed.toISOString().split('T')[0],
  };
};

/**
 * Validate a numeric value within bounds
 */
export const validateNumber = (
  value: unknown,
  options: { min?: number; max?: number; integer?: boolean } = {}
): SanitizedResult<number> => {
  const { min = -Infinity, max = Infinity, integer = false } = options;

  if (value === undefined || value === null || value === '') {
    return {
      valid: false,
      sanitized: 0,
      error: 'Value is required',
    };
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return {
      valid: false,
      sanitized: 0,
      error: 'Value must be a number',
    };
  }

  if (integer && !Number.isInteger(num)) {
    return {
      valid: false,
      sanitized: Math.round(num),
      error: 'Value must be an integer',
    };
  }

  if (num < min) {
    return {
      valid: false,
      sanitized: min,
      error: `Value must be at least ${min}`,
    };
  }

  if (num > max) {
    return {
      valid: false,
      sanitized: max,
      error: `Value must be at most ${max}`,
    };
  }

  return {
    valid: true,
    sanitized: num,
  };
};
