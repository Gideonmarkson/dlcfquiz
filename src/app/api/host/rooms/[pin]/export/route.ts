import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getHostSecretFromRequest, verifyHostSecret } from '@/lib/auth/hostAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const { pin } = await params;
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

    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('is_kicked', false)
      .order('total_score', { ascending: false })
      .order('total_correct_response_ms', { ascending: true })
      .order('joined_at', { ascending: true });

    let csv = 'Rank,Nickname,AcademicLevel,TotalScore,CorrectAnswers,TotalAnswered,AvgCorrectResponseMs\n';

    (players || []).forEach((p, idx) => {
      const rank = idx + 1;
      const avgMs = p.correct_count > 0 ? Math.round(p.total_correct_response_ms / p.correct_count) : 0;
      const cleanNick = `"${p.nickname.replace(/"/g, '""')}"`;
      csv += `${rank},${cleanNick},${p.academic_level},${p.total_score},${p.correct_count},${p.answered_count},${avgMs}\n`;
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="DLCF_AFIT_Quiz_${pin}_Standings.csv"`,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
