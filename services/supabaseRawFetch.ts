/**
 * Raw fetch helpers for Supabase API calls
 * Bypasses the broken Supabase JS client which hangs on queries
 */

// Helper to get auth token from localStorage
export const getAuthToken = (): string => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
        const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1] || '';
        const storageKey = `sb-${projectId}-auth-token`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed?.access_token || supabaseKey;
        }
    } catch (e) {
            }
    return supabaseKey;
};

// Get common headers for Supabase requests
export const getSupabaseHeaders = (prefer?: string): Record<string, string> => {
    const authToken = getAuthToken();
    return {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': prefer || 'return=representation',
    };
};

// Raw fetch helper for GET requests
export const supabaseGet = async <T = any>(endpoint: string): Promise<{ data: T | null; error: any }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
            headers: getSupabaseHeaders(),
        });

        if (!response.ok) {
            const error = await response.json();
            return { data: null, error };
        }

        const data = await response.json();
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
};

// Raw fetch helper for single row GET requests
export const supabaseGetSingle = async <T = any>(endpoint: string): Promise<{ data: T | null; error: any }> => {
    const result = await supabaseGet<T[]>(endpoint);
    if (result.error) return { data: null, error: result.error };
    return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: null };
};

// Raw fetch helper for POST/INSERT requests
export const supabaseInsert = async <T = any>(table: string, data: any): Promise<{ data: T | null; error: any }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: getSupabaseHeaders('return=representation'),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            return { data: null, error };
        }

        const result = await response.json();
        return { data: Array.isArray(result) ? result[0] : result, error: null };
    } catch (error) {
        return { data: null, error };
    }
};

// Raw fetch helper for PATCH/UPDATE requests
export const supabaseUpdate = async (endpoint: string, data: any): Promise<{ error: any }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
            method: 'PATCH',
            headers: getSupabaseHeaders('return=minimal'),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            return { error };
        }

        return { error: null };
    } catch (error) {
        return { error };
    }
};

// Raw fetch helper for DELETE requests
export const supabaseDelete = async (endpoint: string): Promise<{ error: any }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
            method: 'DELETE',
            headers: getSupabaseHeaders('return=minimal'),
        });

        if (!response.ok) {
            const error = await response.json();
            return { error };
        }

        return { error: null };
    } catch (error) {
        return { error };
    }
};

// Raw fetch helper for UPSERT requests
export const supabaseUpsert = async <T = any>(table: string, data: any, onConflict?: string): Promise<{ data: T | null; error: any }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
        const headers = getSupabaseHeaders('return=representation');
        if (onConflict) {
            headers['Prefer'] = `return=representation,resolution=merge-duplicates`;
        }

        const url = onConflict
            ? `${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`
            : `${supabaseUrl}/rest/v1/${table}`;

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            return { data: null, error };
        }

        const result = await response.json();
        return { data: Array.isArray(result) ? result[0] : result, error: null };
    } catch (error) {
        return { data: null, error };
    }
};

// RPC call helper
export const supabaseRpc = async <T = any>(functionName: string, params?: any): Promise<{ data: T | null; error: any }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
            method: 'POST',
            headers: getSupabaseHeaders(),
            body: params ? JSON.stringify(params) : undefined,
        });

        if (!response.ok) {
            const error = await response.json();
            return { data: null, error };
        }

        const data = await response.json();
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
};
