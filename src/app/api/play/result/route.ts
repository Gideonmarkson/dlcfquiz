import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  isUsingMockDb,
  mockGetRoomByPin,
  mockGetPlayerByToken,
  mockGetAnswersForQuestion,
  mockGetPlayers,
} from '@/lib/mockDb';
import { isNeonAvailable, getPlayerResultFromNeon } from '@/lib/db/neonService';

export async function GET(req: NextRequest) {
  try {
    const playerToken = req.headers.get('x-player-token');
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get('pin');
    const questionId = searchParams.get('questionId');

    if (!pin || !playerToken) {
      return NextResponse.json({ error: 'Missing PIN or player token' }, { status: 400 });
    }

    // 1. Neon Database Result Path
    if (isNeonAvailable()) {
      try {
        const result = await getPlayerResultFromNeon(pin, playerToken, questionId);
        if (result) {
          return NextResponse.json(result);
        }
      } catch (neonErr) {
        console.warn('Neon getPlayerResult error, falling back:', neonErr);
      }
    }

    const mockRoom = mockGetRoomByPin(pin);
    if (isUsingMockDb() || mockRoom) {
      if (!mockRoom) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      if (mockRoom.status === 'QUESTION_ACTIVE') {
        return NextResponse.json(
          { error: 'Results cannot be viewed while question is active' },
          { status: 403 }
        );
      }

      const player = mockGetPlayerByToken(playerToken);
      if (!player || player.room_id !== mockRoom.id || player.is_kicked) {
        return NextResponse.json({ error: 'Unauthorized player session' }, { status: 401 });
      }

      let answerRecord = null;
      if (questionId) {
        const answers = mockGetAnswersForQuestion(mockRoom.id, questionId);
        answerRecord = answers.find((a) => a.player_id === player.id) || null;
      }

      const allPlayers = mockGetPlayers(mockRoom.id);
      const higherCount = allPlayers.filter((p) => p.total_score > player.total_score).length;
      const currentRank = higherCount + 1;
      const totalPlayers = allPlayers.length;

      return NextResponse.json({
        selectedOption: answerRecord ? answerRecord.selected_option : null,
        isCorrect: answerRecord ? answerRecord.is_correct : false,
        pointsAwarded: answerRecord ? answerRecord.points_awarded : 0,
        cumulativeScore: player.total_score,
        currentRank,
        totalPlayers,
      });
    }

    // Supabase
    const supabase = getSupabaseServerClient();
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, pin, status')
      .eq('pin', pin)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status === 'QUESTION_ACTIVE') {
      return NextResponse.json(
        { error: 'Results cannot be viewed while question is active' },
        { status: 403 }
      );
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('player_token', playerToken)
      .single();

    if (playerError || !player || player.is_kicked) {
      return NextResponse.json({ error: 'Unauthorized player session' }, { status: 401 });
    }

    let answerRecord = null;
    if (questionId) {
      const { data: ans } = await supabase
        .from('answers')
        .select('*')
        .eq('question_id', questionId)
        .eq('player_id', player.id)
        .maybeSingle();

      answerRecord = ans;
    }

    const { count: higherCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('is_kicked', false)
      .gt('total_score', player.total_score);

    const { count: totalPlayersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('is_kicked', false);

    const currentRank = (higherCount || 0) + 1;
    const totalPlayers = totalPlayersCount || 1;

    let pointsToNextRank: number | undefined;
    if (currentRank > 1) {
      const { data: nextAbove } = await supabase
        .from('players')
        .select('total_score')
        .eq('room_id', room.id)
        .eq('is_kicked', false)
        .gt('total_score', player.total_score)
        .order('total_score', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextAbove) {
        pointsToNextRank = nextAbove.total_score - player.total_score;
      }
    }

    return NextResponse.json({
      selectedOption: answerRecord ? answerRecord.selected_option : null,
      isCorrect: answerRecord ? answerRecord.is_correct : false,
      pointsAwarded: answerRecord ? answerRecord.points_awarded : 0,
      cumulativeScore: player.total_score,
      currentRank,
      totalPlayers,
      pointsToNextRank,
    });
  } catch (err: unknown) {
    console.error('Play result error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
