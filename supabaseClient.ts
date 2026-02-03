/// <reference types="vite/client" />

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase Environment Variables');
}

// Singleton pattern to prevent multiple instances during HMR
declare global {
    interface Window {
        __supabaseClient?: SupabaseClient;
    }
}

function getSupabaseClient(): SupabaseClient {
    if (typeof window !== 'undefined' && window.__supabaseClient) {
        return window.__supabaseClient;
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        }
    });

    if (typeof window !== 'undefined') {
        window.__supabaseClient = client;
    }

    return client;
}

export const supabase = getSupabaseClient();
