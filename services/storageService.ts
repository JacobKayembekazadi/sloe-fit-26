import { supabase } from '../supabaseClient';

// Image validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

// Validate image file before upload
export const validateImage = (file: File): ImageValidationResult => {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type. Please use JPG, PNG, or WebP. Got: ${file.type}`
        };
    }

    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
            valid: false,
            error: `File too large (${sizeMB}MB). Maximum size is 10MB.`
        };
    }

    return { valid: true };
};

// Generate unique filename for storage
const generateFilename = (userId: string, category: string, originalName: string): string => {
    const timestamp = Date.now();
    const extension = originalName.split('.').pop() || 'jpg';
    return `${userId}/${category}/${timestamp}.${extension}`;
};

// Upload image to Supabase Storage
export const uploadImage = async (
    file: File,
    userId: string,
    category: 'body' | 'meal' | 'progress'
): Promise<UploadResult> => {
    // Validate first
    const validation = validateImage(file);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    try {
        const path = generateFilename(userId, category, file.name);

        const { error: uploadError } = await supabase.storage
            .from('user-photos')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
                        return { success: false, error: uploadError.message };
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('user-photos')
            .getPublicUrl(path);

        return {
            success: true,
            url: publicUrl,
            path
        };
    } catch (error) {
                return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload image'
        };
    }
};

// Upload multiple progress photos
export const uploadProgressPhotos = async (
    files: { front: File; side: File; back: File },
    userId: string
): Promise<{
    success: boolean;
    urls?: { front: string; side: string; back: string };
    error?: string;
}> => {
    const timestamp = Date.now();

    try {
        const uploads = await Promise.all([
            uploadImageWithPrefix(files.front, userId, 'progress', `${timestamp}_front`),
            uploadImageWithPrefix(files.side, userId, 'progress', `${timestamp}_side`),
            uploadImageWithPrefix(files.back, userId, 'progress', `${timestamp}_back`)
        ]);

        const failed = uploads.find(u => !u.success);
        if (failed) {
            return { success: false, error: failed.error };
        }

        return {
            success: true,
            urls: {
                front: uploads[0].url!,
                side: uploads[1].url!,
                back: uploads[2].url!
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload progress photos'
        };
    }
};

// Helper for uploading with custom prefix
const uploadImageWithPrefix = async (
    file: File,
    userId: string,
    category: string,
    prefix: string
): Promise<UploadResult> => {
    const validation = validateImage(file);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    try {
        const extension = file.name.split('.').pop() || 'jpg';
        const path = `${userId}/${category}/${prefix}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from('user-photos')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true // Allow overwrite for same timestamp
            });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('user-photos')
            .getPublicUrl(path);

        return { success: true, url: publicUrl, path };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed'
        };
    }
};

// Delete an image from storage
export const deleteImage = async (path: string): Promise<boolean> => {
    try {
        const { error } = await supabase.storage
            .from('user-photos')
            .remove([path]);

        if (error) {
                        return false;
        }
        return true;
    } catch (error) {
                return false;
    }
};

// Get user's progress photos history
export const getProgressPhotosHistory = async (
    userId: string
): Promise<{ date: string; urls: { front: string; side: string; back: string } }[]> => {
    try {
        const { data, error } = await supabase.storage
            .from('user-photos')
            .list(`${userId}/progress`, {
                sortBy: { column: 'name', order: 'desc' }
            });

        if (error || !data) {
            return [];
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
                    .from('user-photos')
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
                        day: 'numeric'
                    }),
                    urls: urls as { front: string; side: string; back: string }
                });
            }
        });

        return results;
    } catch (error) {
                return [];
    }
};
