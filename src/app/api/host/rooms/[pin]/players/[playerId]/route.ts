import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getHostSecretFromRequest, verifyHostSecret } from '@/lib/auth/hostAuth';
import { broadcastToRoom } from '@/lib/supabase/broadcast';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ pin: string; playerId: string }> }
) {
  try {
    const { pin, playerId } = await params;
    const { secret, recoveryCode } = await getHostSecretFromRequest(req);
    const supabase = getSupabaseServerClient();

    const { data: room } = await supabase
      .from('rooms')
      .select('*')
      .eq('pin', pin)
      .single();

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const isSecretValid = secret ? verifyHostSecret(secret, room.host_secret_hash) : false;
    const isRecoveryValid = recoveryCode ? recoveryCode === room.host_recovery_code : false;

    if (!isSecretValid && !isRecoveryValid) {
      return NextResponse.json({ error: 'Unauthorized host session' }, { status: 401 });
    }

    const { data: player, error: playerErr } = await supabase
      .from('players')
      .update({ is_kicked: true })
      .eq('id', playerId)
      .eq('room_id', room.id)
      .select()
      .single();

    if (playerErr || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Broadcast kick to lobby
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('is_kicked', false);

    await broadcastToRoom(pin, 'lobby_update', {
      action: 'kick',
      player: {
        id: player.id,
        nickname: player.nickname,
        academicLevel: player.academic_level,
      },
      totalPlayers: count || 0,
    });

    return NextResponse.json({
      kicked: true,
      playerId,
      totalPlayers: count || 0,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
