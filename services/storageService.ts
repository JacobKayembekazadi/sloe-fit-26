/**
 * Storage Service - File Upload Management
 *
 * Features:
 * - Image validation (type, size)
 * - Image compression option
 * - Upload progress tracking
 * - Signed URL generation for private files
 * - File existence checking
 * - Proper error logging
 * - Development mode logging
 */

import { supabase } from '../supabaseClient';

// ============================================================================
// Configuration
// ============================================================================

const DEBUG_MODE = import.meta.env.DEV;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BUCKET_NAME = 'user-photos';

// Compression settings
const DEFAULT_MAX_DIMENSION = 2048;
const DEFAULT_QUALITY = 0.85;

// ============================================================================
// Types
// ============================================================================

export type StorageErrorType =
  | 'validation'
  | 'not_found'
  | 'permission'
  | 'quota_exceeded'
  | 'network'
  | 'unknown';

export interface StorageError {
  type: StorageErrorType;
  message: string;
  retryable: boolean;
  originalError?: unknown;
}

export interface StorageResponse<T> {
  data: T | null;
  error: StorageError | null;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export interface UploadOptions {
  /** Enable image compression (default: false) */
  compress?: boolean;
  /** Maximum dimension for compression (default: 2048) */
  maxDimension?: number;
  /** JPEG quality for compression (0-1, default: 0.85) */
  quality?: number;
  /** Progress callback (0-100) */
  onProgress?: (progress: number) => void;
  /** Allow overwriting existing file (default: false) */
  upsert?: boolean;
}

export interface SignedUrlOptions {
  /** URL expiration in seconds (default: 3600) */
  expiresIn?: number;
}

// ============================================================================
// Logging
// ============================================================================

function logStorage(operation: string, message: string, data?: unknown) {
  if (DEBUG_MODE) {
    console.log(`[Storage] ${operation}: ${message}`, data || '');
  }
}

function logStorageError(operation: string, error: StorageError, context?: Record<string, unknown>) {
  if (DEBUG_MODE) {
    console.error(`[Storage] ${operation} failed:`, {
      type: error.type,
      message: error.message,
      retryable: error.retryable,
      ...context,
    });
  }
}

// ============================================================================
// Error Classification
// ============================================================================

function classifyError(error: unknown): StorageError {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; statusCode?: string | number; error?: string };
    const statusCode = err.statusCode ? parseInt(String(err.statusCode)) : undefined;
    const message = err.message || err.error || 'Unknown error';

    if (statusCode === 404 || message.includes('not found')) {
      return {
        type: 'not_found',
        message: 'File or bucket not found',
        retryable: false,
        originalError: error,
      };
    }

    if (statusCode === 403 || statusCode === 401) {
      return {
        type: 'permission',
        message: 'Permission denied - please check your authentication',
        retryable: false,
        originalError: error,
      };
    }

    if (message.includes('quota') || message.includes('limit')) {
      return {
        type: 'quota_exceeded',
        message: 'Storage quota exceeded',
        retryable: false,
        originalError: error,
      };
    }

    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network error - please check your connection',
        retryable: true,
        originalError: error,
      };
    }

    return {
      type: 'unknown',
      message,
      retryable: false,
      originalError: error,
    };
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
    retryable: false,
    originalError: error,
  };
}

// ============================================================================
// Image Compression
// ============================================================================

/**
 * Compress an image file
 */
export const compressImage = async (
  file: File,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
  quality: number = DEFAULT_QUALITY
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
        logStorage('compress', `Resizing from ${img.width}x${img.height} to ${width}x${height}`);
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          const ratio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
          logStorage('compress', `Compressed ${file.name}: ${ratio}% reduction`);

          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = URL.createObjectURL(file);
  });
};

// ============================================================================
// File Validation
// ============================================================================

/**
 * Validate image file before upload
 */
export const validateImage = (file: File): ImageValidationResult => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Please use JPG, PNG, or WebP. Got: ${file.type}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${sizeMB}MB). Maximum size is 10MB.`,
    };
  }

  return { valid: true };
};

// ============================================================================
// File Existence Check
// ============================================================================

/**
 * Check if a file exists in storage
 */
export const fileExists = async (path: string): Promise<boolean> => {
  try {
    const folder = path.substring(0, path.lastIndexOf('/'));
    const filename = path.substring(path.lastIndexOf('/') + 1);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, {
        search: filename,
      });

    if (error) {
      logStorageError('fileExists', classifyError(error), { path });
      return false;
    }

    return data.some(file => file.name === filename);
  } catch (error) {
    logStorageError('fileExists', classifyError(error), { path });
    return false;
  }
};

// ============================================================================
// Upload Functions
// ============================================================================

/**
 * Generate unique filename for storage
 */
const generateFilename = (userId: string, category: string, originalName: string): string => {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop() || 'jpg';
  return `${userId}/${category}/${timestamp}.${extension}`;
};

/**
 * Upload image to Supabase Storage
 */
export const uploadImage = async (
  file: File,
  userId: string,
  category: 'body' | 'meal' | 'progress',
  options: UploadOptions = {}
): Promise<UploadResult> => {
  const { compress = false, maxDimension, quality, onProgress, upsert = false } = options;

  // Validate first
  const validation = validateImage(file);
  if (!validation.valid) {
    logStorage('upload', `Validation failed: ${validation.error}`, { userId, category });
    return { success: false, error: validation.error };
  }

  try {
    let fileToUpload = file;

    // Compress if requested
    if (compress) {
      onProgress?.(10);
      fileToUpload = await compressImage(file, maxDimension, quality);
      onProgress?.(30);
    }

    const path = generateFilename(userId, category, fileToUpload.name);

    // Check if file exists (if not upserting)
    if (!upsert) {
      const exists = await fileExists(path);
      if (exists) {
        logStorage('upload', `File already exists: ${path}`, { userId, category });
        return { success: false, error: 'File already exists. Use upsert option to overwrite.' };
      }
    }
    onProgress?.(50);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileToUpload, {
        cacheControl: '3600',
        upsert,
      });

    if (uploadError) {
      const storageError = classifyError(uploadError);
      logStorageError('upload', storageError, { userId, category, path });
      return { success: false, error: storageError.message };
    }

    onProgress?.(80);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    onProgress?.(100);
    logStorage('upload', `Successfully uploaded: ${path}`, { userId, category, size: fileToUpload.size });

    return {
      success: true,
      url: publicUrl,
      path,
    };
  } catch (error) {
    const storageError = classifyError(error);
    logStorageError('upload', storageError, { userId, category });
    return {
      success: false,
      error: storageError.message,
    };
  }
};

/**
 * Helper for uploading with custom prefix
 */
const uploadImageWithPrefix = async (
  file: File,
  userId: string,
  category: string,
  prefix: string,
  options: UploadOptions = {}
): Promise<UploadResult> => {
  const { compress = false, maxDimension, quality, onProgress } = options;

  const validation = validateImage(file);
  if (!validation.valid) {
    logStorage('uploadWithPrefix', `Validation failed: ${validation.error}`, { userId, category, prefix });
    return { success: false, error: validation.error };
  }

  try {
    let fileToUpload = file;

    if (compress) {
      onProgress?.(10);
      fileToUpload = await compressImage(file, maxDimension, quality);
      onProgress?.(30);
    }

    const extension = fileToUpload.name.split('.').pop() || 'jpg';
    const path = `${userId}/${category}/${prefix}.${extension}`;

    onProgress?.(50);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileToUpload, {
        cacheControl: '3600',
        upsert: true, // Allow overwrite for same timestamp
      });

    if (uploadError) {
      const storageError = classifyError(uploadError);
      logStorageError('uploadWithPrefix', storageError, { userId, category, prefix, path });
      return { success: false, error: storageError.message };
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    onProgress?.(100);
    logStorage('uploadWithPrefix', `Successfully uploaded: ${path}`, { userId, category });

    return { success: true, url: publicUrl, path };
  } catch (error) {
    const storageError = classifyError(error);
    logStorageError('uploadWithPrefix', storageError, { userId, category, prefix });
    return {
      success: false,
      error: storageError.message,
    };
  }
};

/**
 * Upload multiple progress photos
 */
export const uploadProgressPhotos = async (
  files: { front: File; side: File; back: File },
  userId: string,
  options: UploadOptions = {}
): Promise<{
  success: boolean;
  urls?: { front: string; side: string; back: string };
  error?: string;
}> => {
  const timestamp = Date.now();

  try {
    logStorage('uploadProgressPhotos', 'Starting upload of 3 photos', { userId, timestamp });

    // Create individual progress trackers
    const progressMap = { front: 0, side: 0, back: 0 };
    const updateProgress = (view: keyof typeof progressMap, progress: number) => {
      progressMap[view] = progress;
      const total = (progressMap.front + progressMap.side + progressMap.back) / 3;
      options.onProgress?.(Math.round(total));
    };

    const uploads = await Promise.all([
      uploadImageWithPrefix(files.front, userId, 'progress', `${timestamp}_front`, {
        ...options,
        onProgress: (p) => updateProgress('front', p),
      }),
      uploadImageWithPrefix(files.side, userId, 'progress', `${timestamp}_side`, {
        ...options,
        onProgress: (p) => updateProgress('side', p),
      }),
      uploadImageWithPrefix(files.back, userId, 'progress', `${timestamp}_back`, {
        ...options,
        onProgress: (p) => updateProgress('back', p),
      }),
    ]);

    const failed = uploads.find(u => !u.success);
    if (failed) {
      logStorage('uploadProgressPhotos', `Failed: ${failed.error}`, { userId, timestamp });
      return { success: false, error: failed.error };
    }

    logStorage('uploadProgressPhotos', 'All 3 photos uploaded successfully', { userId, timestamp });

    return {
      success: true,
      urls: {
        front: uploads[0].url!,
        side: uploads[1].url!,
        back: uploads[2].url!,
      },
    };
  } catch (error) {
    const storageError = classifyError(error);
    logStorageError('uploadProgressPhotos', storageError, { userId });
    return {
      success: false,
      error: storageError.message,
    };
  }
};

// ============================================================================
// Delete Functions
// ============================================================================

/**
 * Delete an image from storage
 */
export const deleteImage = async (path: string): Promise<StorageResponse<boolean>> => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      const storageError = classifyError(error);
      logStorageError('delete', storageError, { path });
      return { data: false, error: storageError };
    }

    logStorage('delete', `Successfully deleted: ${path}`);
    return { data: true, error: null };
  } catch (error) {
    const storageError = classifyError(error);
    logStorageError('delete', storageError, { path });
    return { data: false, error: storageError };
  }
};

// ============================================================================
// Signed URLs
// ============================================================================

/**
 * Generate a signed URL for private file access
 */
export const getSignedUrl = async (
  path: string,
  options: SignedUrlOptions = {}
): Promise<StorageResponse<string>> => {
  const { expiresIn = 3600 } = options;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      const storageError = classifyError(error);
      logStorageError('getSignedUrl', storageError, { path, expiresIn });
      return { data: null, error: storageError };
    }

    logStorage('getSignedUrl', `Generated signed URL for: ${path}`, { expiresIn });
    return { data: data.signedUrl, error: null };
  } catch (error) {
    const storageError = classifyError(error);
    logStorageError('getSignedUrl', storageError, { path, expiresIn });
    return { data: null, error: storageError };
  }
};

/**
 * Generate signed URLs for multiple files
 */
export const getSignedUrls = async (
  paths: string[],
  options: SignedUrlOptions = {}
): Promise<StorageResponse<Record<string, string>>> => {
  const { expiresIn = 3600 } = options;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(paths, expiresIn);

    if (error) {
      const storageError = classifyError(error);
      logStorageError('getSignedUrls', storageError, { paths, expiresIn });
      return { data: null, error: storageError };
    }

    const urlMap: Record<string, string> = {};
    data.forEach(item => {
      if (item.signedUrl) {
        urlMap[item.path] = item.signedUrl;
      }
    });

    logStorage('getSignedUrls', `Generated ${Object.keys(urlMap).length} signed URLs`);
    return { data: urlMap, error: null };
  } catch (error) {
    const storageError = classifyError(error);
    logStorageError('getSignedUrls', storageError, { paths, expiresIn });
    return { data: null, error: storageError };
  }
};

// ============================================================================
// History Functions
// ============================================================================

/**
 * Get user's progress photos history
 */
export const getProgressPhotosHistory = async (
  userId: string
): Promise<StorageResponse<{ date: string; urls: { front: string; side: string; back: string } }[]>> => {
  try {
    logStorage('getProgressPhotosHistory', `Fetching history for user`, { userId });

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${userId}/progress`, {
        sortBy: { column: 'name', order: 'desc' },
      });

    if (error) {
      const storageError = classifyError(error);
      logStorageError('getProgressPhotosHistory', storageError, { userId });
      return { data: [], error: storageError };
    }

    if (!data || data.length === 0) {
      logStorage('getProgressPhotosHistory', 'No photos found', { userId });
      return { data: [], error: null };
    }

    // Group by timestamp prefix
    const grouped = new Map<string, { front?: string; side?: string; back?: string }>();

    data.forEach(file => {
      const match = file.name.match(/^(\d+)_(front|side|back)/);
      if (match) {
        const [, timestamp, view] = match;
        if (!grouped.has(timestamp)) {
          grouped.set(timestamp, {});
        }
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(`${userId}/progress/${file.name}`);

        const entry = grouped.get(timestamp)!;
        entry[view as 'front' | 'side' | 'back'] = publicUrl;
      }
    });

    // Convert to array and filter complete sets
    const results: { date: string; urls: { front: string; side: string; back: string } }[] = [];

    grouped.forEach((urls, timestamp) => {
      if (urls.front && urls.side && urls.back) {
        results.push({
          date: new Date(parseInt(timestamp)).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          urls: urls as { front: string; side: string; back: string },
        });
      }
    });

    logStorage('getProgressPhotosHistory', `Found ${results.length} complete photo sets`, { userId });
    return { data: results, error: null };
  } catch (error) {
    const storageError = classifyError(error);
    logStorageError('getProgressPhotosHistory', storageError, { userId });
    return { data: [], error: storageError };
  }
};
