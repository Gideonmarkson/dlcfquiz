import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** True only when real Supabase credentials are present at build time. */
export const isRealtimeConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')
);

let browserClient: Promise<SupabaseClient> | null = null;

/**
 * Browser-safe Supabase client used only for Realtime broadcast channels.
 * Returns null when Supabase isn't configured, so phones don't sit retrying a
 * websocket to a placeholder host in the background.
 * The library is loaded on demand, so phones don't download it when realtime is off.
 */
export function getSupabaseBrowser(): Promise<SupabaseClient | null> {
  if (!isRealtimeConfigured) return Promise.resolve(null);
  if (!browserClient) {
    browserClient = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        realtime: { params: { eventsPerSecond: 10 } },
      })
    );
  }
  return browserClient;
}
