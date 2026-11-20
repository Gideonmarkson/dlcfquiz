import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getHostSecretFromRequest, verifyHostSecret } from '@/lib/auth/hostAuth';
import { QuestionsArraySchema } from '@/lib/questionParser';

export async function PUT(
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

    if (room.status !== 'DRAFT' && room.status !== 'LOBBY') {
      return NextResponse.json(
        { error: 'Cannot modify questions once quiz has started' },
        { status: 409 }
      );
    }

    const body = await req.json();
    const validation = QuestionsArraySchema.safeParse(body.questions);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid question bank payload', details: validation.error.format() },
        { status: 400 }
      );
    }

    // Delete existing questions
    await supabase.from('questions').delete().eq('room_id', room.id);

    // Insert replacement questions
    const questionRows = validation.data.map((q, idx) => ({
      room_id: room.id,
      order_index: idx,
      prompt: q.prompt,
      option_a: q.options[0],
      option_b: q.options[1],
      option_c: q.options[2],
      option_d: q.options[3],
      correct_option_index: q.correctOptionIndex,
      scripture_ref: q.scriptureRef,
      explanation: q.explanation || null,
      time_limit_sec: q.timeLimitSec,
    }));

    const { error: insertError } = await supabase.from('questions').insert(questionRows);
    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to update questions: ' + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      updatedCount: questionRows.length,
      message: 'Questions updated successfully',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
