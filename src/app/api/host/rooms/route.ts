import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { generateRoomPin, generateRecoveryCode } from '@/lib/pinGenerator';
import {
  generateHostSecret,
  hashHostSecret,
  HOST_COOKIE_NAME,
} from '@/lib/auth/hostAuth';
import { QuestionsArraySchema } from '@/lib/questionParser';
import { isUsingMockDb, mockCreateRoom, mockInsertQuestions } from '@/lib/mockDb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title = 'DLCF AFIT Live Bible Quiz', questions = [] } = body;

    const validation = QuestionsArraySchema.safeParse(questions);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid question bank payload', details: validation.error.format() },
        { status: 400 }
      );
    }

    const pin = generateRoomPin();
    const hostSecret = generateHostSecret();
    const hostSecretHash = hashHostSecret(hostSecret);
    const hostRecoveryCode = generateRecoveryCode();

    let roomId = '';
    let roomStatus = 'LOBBY';

    if (isUsingMockDb()) {
      // Local development fallback
      const room = mockCreateRoom({
        pin,
        title: title.slice(0, 120),
        host_secret_hash: hostSecretHash,
        host_recovery_code: hostRecoveryCode,
      });
      mockInsertQuestions(room.id, validation.data);
      roomId = room.id;
      roomStatus = room.status;
    } else {
      try {
        const supabase = getSupabaseServerClient();
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .insert({
            pin,
            title: title.slice(0, 120),
            host_secret_hash: hostSecretHash,
            host_recovery_code: hostRecoveryCode,
            status: 'LOBBY',
            current_question_index: -1,
          })
          .select()
          .single();

        if (roomError || !room) {
          throw new Error(roomError?.message || 'Database error');
        }

        roomId = room.id;
        roomStatus = room.status;

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

        const { error: qError } = await supabase.from('questions').insert(questionRows);
        if (qError) {
          throw new Error('Failed to store questions: ' + qError.message);
        }
      } catch (dbErr) {
        console.warn('Supabase insert failed, falling back to local memory store:', dbErr);
        const room = mockCreateRoom({
          pin,
          title: title.slice(0, 120),
          host_secret_hash: hostSecretHash,
          host_recovery_code: hostRecoveryCode,
        });
        mockInsertQuestions(room.id, validation.data);
        roomId = room.id;
        roomStatus = room.status;
      }
    }

    const response = NextResponse.json(
      {
        roomId,
        pin,
        title,
        recoveryCode: hostRecoveryCode,
        status: roomStatus,
        questionCount: validation.data.length,
      },
      { status: 201 }
    );

    // Set HttpOnly host cookie
    response.cookies.set(HOST_COOKIE_NAME, hostSecret, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: unknown) {
    console.error('Create room unhandled error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
