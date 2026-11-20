import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let serverClientInstance: SupabaseClient | null = null;

/**
 * Server-only Supabase client with Service Role privileges.
 * Strictly used in Next.js Route Handlers and Server Actions.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase service client must never be instantiated on the client side.');
  }

  if (!serverClientInstance) {
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn(
        'Supabase URL or Service Role Key is missing. Using mock/placeholder server client.'
      );
    }
    serverClientInstance = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      serviceRoleKey || 'placeholder-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return serverClientInstance;
}
