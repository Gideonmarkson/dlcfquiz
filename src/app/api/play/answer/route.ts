import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimiter';
import { broadcastToRoom } from '@/lib/supabase/broadcast';
import {
  isUsingMockDb,
  mockGetRoomByPin,
  mockSubmitAnswer,
} from '@/lib/mockDb';

export async function POST(req: NextRequest) {
  try {
    const playerToken = req.headers.get('x-player-token');
    if (!playerToken) {
      return NextResponse.json({ error: 'Missing X-Player-Token header' }, { status: 401 });
    }

    const rateCheck = checkRateLimit(`ans:${playerToken}`, 5, 10000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many answer requests' }, { status: 429 });
    }

    const body = await req.json();
    const { pin, questionId, selectedOption } = body as {
      pin?: string;
      questionId?: string;
      selectedOption?: number;
    };

    if (!pin || !questionId || selectedOption === undefined || ![0, 1, 2, 3].includes(selectedOption)) {
      return NextResponse.json({ error: 'Invalid answer submission payload' }, { status: 400 });
    }

    const mockRoom = mockGetRoomByPin(pin);
    if (isUsingMockDb() || mockRoom) {
      const res = mockSubmitAnswer(pin, playerToken, questionId, selectedOption);
      if (!res.accepted) {
        return NextResponse.json({ error: res.error_code || 'SUBMISSION_FAILED' }, { status: 400 });
      }

      broadcastToRoom(pin, 'timer_sync', {
        serverNowMs: Date.now(),
        questionEndsAtMs: 0,
        answeredCount: res.answered_count_for_question,
        totalPlayers: 0,
      });

      return NextResponse.json(
        {
          accepted: true,
          lockedOption: res.locked_option,
        },
        { status: 200 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc('submit_player_answer', {
      p_pin: pin,
      p_player_token: playerToken,
      p_question_id: questionId,
      p_selected_option: selectedOption,
    });

    if (error) {
      console.error('submit_player_answer RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data?.[0] || data;
    if (!result || !result.accepted) {
      const errCode = result?.error_code || 'SUBMISSION_FAILED';
      const statusCode = errCode === 'TIME_EXPIRED' ? 409 : errCode === 'PLAYER_UNAUTHORIZED' ? 401 : 400;
      return NextResponse.json({ error: errCode }, { status: statusCode });
    }

    if (result.answered_count_for_question !== undefined) {
      broadcastToRoom(pin, 'timer_sync', {
        serverNowMs: Date.now(),
        questionEndsAtMs: 0,
        answeredCount: result.answered_count_for_question,
        totalPlayers: 0,
      });
    }

    return NextResponse.json(
      {
        accepted: true,
        lockedOption: result.locked_option,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('Answer endpoint unhandled error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
