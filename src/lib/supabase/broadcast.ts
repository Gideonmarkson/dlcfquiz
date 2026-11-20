import { RealtimeBroadcastEvent } from '@/types/quiz';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Broadcasts an ephemeral event to room:{pin} channel via Supabase Realtime REST API.
 * Consumes 0 database writes and handles serverless cold starts efficiently.
 */
export async function broadcastToRoom(
  pin: string,
  event: RealtimeBroadcastEvent['event'],
  payload: unknown
): Promise<boolean> {
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(`[Broadcast Skipped] Missing Supabase config for room:${pin} event:${event}`);
    return false;
  }

  try {
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/realtime/v1/api/broadcast`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `room:${pin}`,
            event: event,
            payload: payload,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Broadcast Error] room:${pin} event:${event} HTTP ${res.status}:`, text);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Broadcast Exception] room:${pin} event:${event}:`, err);
    return false;
  }
}
