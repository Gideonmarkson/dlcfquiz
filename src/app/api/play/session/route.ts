import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { PublicQuestionDTO, RevealedAnswerDTO } from '@/types/quiz';
import {
  isUsingMockDb,
  mockGetRoomByPin,
  mockGetPlayerByToken,
  mockGetQuestions,
  mockGetAnswersForQuestion,
  mockGetPlayers,
} from '@/lib/mockDb';
import { isNeonAvailable, getPlayerSessionFromNeon } from '@/lib/db/neonService';

export async function GET(req: NextRequest) {
  try {
    const playerToken = req.headers.get('x-player-token');
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get('pin');

    if (!pin || !playerToken) {
      return NextResponse.json(
        { error: 'Missing PIN or X-Player-Token header' },
        { status: 400 }
      );
    }

    // 1. Neon Database Session Path (Single Round-Trip Query)
    if (isNeonAvailable()) {
      try {
        const neonSession = await getPlayerSessionFromNeon(pin, playerToken);
        if (neonSession) {
          if ('kicked' in neonSession && neonSession.kicked) {
            return NextResponse.json({ error: 'Player kicked' }, { status: 403 });
          }
          return NextResponse.json(neonSession);
        }
      } catch (neonErr) {
        console.warn('Neon getPlayerSession error, falling back:', neonErr);
      }
    }

    const mockRoom = mockGetRoomByPin(pin);
    if (isUsingMockDb() || mockRoom) {
      if (!mockRoom) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      const player = mockGetPlayerByToken(playerToken);
      if (!player || player.room_id !== mockRoom.id || player.is_kicked) {
        return NextResponse.json({ error: 'Player session unauthorized or kicked' }, { status: 401 });
      }

      const allPlayers = mockGetPlayers(mockRoom.id);
      const higherCount = allPlayers.filter((p) => p.total_score > player.total_score).length;
      const currentRank = higherCount + 1;
      const totalPlayers = allPlayers.length;

      const allQuestions = mockGetQuestions(mockRoom.id);
      const totalQuestions = allQuestions.length;

      let publicQuestion: PublicQuestionDTO | null = null;
      let lockedOptionForActiveQuestion: number | null = null;
      let questionEndsAtMs: number | null = null;
      let reveal: RevealedAnswerDTO | null = null;

      if (mockRoom.status === 'QUESTION_ACTIVE' && mockRoom.current_question_index >= 0) {
        const activeQ = allQuestions[mockRoom.current_question_index];
        if (activeQ) {
          publicQuestion = {
            id: activeQ.id,
            orderIndex: mockRoom.current_question_index,
            totalQuestions,
            prompt: activeQ.prompt,
            options: [activeQ.option_a, activeQ.option_b, activeQ.option_c, activeQ.option_d],
            timeLimitSec: activeQ.time_limit_sec,
          };

          if (mockRoom.question_started_at) {
            questionEndsAtMs = new Date(mockRoom.question_started_at).getTime() + activeQ.time_limit_sec * 1000;
          }

          const existingAnswers = mockGetAnswersForQuestion(mockRoom.id, activeQ.id);
          const userAns = existingAnswers.find((a) => a.player_id === player.id);
          if (userAns) {
            lockedOptionForActiveQuestion = userAns.selected_option;
          }
        }
      } else if (mockRoom.status === 'ANSWER_REVEALED' && mockRoom.current_question_index >= 0) {
        const activeQ = allQuestions[mockRoom.current_question_index];
        if (activeQ) {
          const ans = mockGetAnswersForQuestion(mockRoom.id, activeQ.id);
          const optionCounts: [number, number, number, number] = [0, 0, 0, 0];
          const optionPlayerNames: [string[], string[], string[], string[]] = [[], [], [], []];
          const playerMap = new Map(allPlayers.map((p) => [p.id, p.nickname]));

          ans.forEach((a) => {
            if (a.selected_option >= 0 && a.selected_option <= 3) {
              optionCounts[a.selected_option]++;
              const name = playerMap.get(a.player_id);
              if (name) optionPlayerNames[a.selected_option].push(name);
            }
          });

          reveal = {
            questionId: activeQ.id,
            correctOptionIndex: activeQ.correct_option_index as 0 | 1 | 2 | 3,
            scriptureRef: activeQ.scripture_ref,
            explanation: activeQ.explanation,
            optionCounts,
            optionPlayerNames,
            totalAnswered: ans.length,
          };
        }
      }

      return NextResponse.json({
        player: {
          id: player.id,
          nickname: player.nickname,
          academicLevel: player.academic_level,
          totalScore: player.total_score,
          correctCount: player.correct_count,
          currentRank,
          totalPlayers,
        },
        roomSnapshot: {
          status: mockRoom.status,
          currentQuestionIndex: mockRoom.current_question_index,
          serverNowMs: Date.now(),
          questionEndsAtMs,
        },
        activeQuestion: publicQuestion,
        lockedOptionForActiveQuestion,
        reveal,
      });
    }

    // Supabase
    const supabase = getSupabaseServerClient();
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('pin', pin)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('player_token', playerToken)
      .single();

    if (playerError || !player || player.is_kicked) {
      return NextResponse.json({ error: 'Player session unauthorized or kicked' }, { status: 401 });
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

    let publicQuestion: PublicQuestionDTO | null = null;
    let lockedOptionForActiveQuestion: number | null = null;
    let questionEndsAtMs: number | null = null;
    let reveal: RevealedAnswerDTO | null = null;

    const { data: allQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('room_id', room.id)
      .order('order_index', { ascending: true });

    const totalQuestions = allQuestions?.length || 0;

    if (room.status === 'QUESTION_ACTIVE' && room.current_question_index >= 0) {
      const activeQ = allQuestions?.[room.current_question_index];
      if (activeQ) {
        publicQuestion = {
          id: activeQ.id,
          orderIndex: room.current_question_index,
          totalQuestions,
          prompt: activeQ.prompt,
          options: [activeQ.option_a, activeQ.option_b, activeQ.option_c, activeQ.option_d],
          timeLimitSec: activeQ.time_limit_sec,
        };

        if (room.question_started_at) {
          const startedMs = new Date(room.question_started_at).getTime();
          questionEndsAtMs = startedMs + activeQ.time_limit_sec * 1000;
        }

        const { data: existingAnswer } = await supabase
          .from('answers')
          .select('selected_option')
          .eq('question_id', activeQ.id)
          .eq('player_id', player.id)
          .maybeSingle();

        if (existingAnswer) {
          lockedOptionForActiveQuestion = existingAnswer.selected_option;
        }
      }
    } else if (room.status === 'ANSWER_REVEALED' && room.current_question_index >= 0) {
      const activeQ = allQuestions?.[room.current_question_index];
      if (activeQ) {
        const { data: answers } = await supabase
          .from('answers')
          .select('selected_option, player_id')
          .eq('question_id', activeQ.id);

        const optionCounts: [number, number, number, number] = [0, 0, 0, 0];
        const optionPlayerNames: [string[], string[], string[], string[]] = [[], [], [], []];

        const playerIds = (answers || []).map((a) => a.player_id).filter(Boolean);
        let playerMap = new Map<string, string>();
        if (playerIds.length > 0) {
          const { data: playersList } = await supabase
            .from('players')
            .select('id, nickname')
            .in('id', playerIds);
          playerMap = new Map((playersList || []).map((p) => [p.id, p.nickname]));
        }

        (answers || []).forEach((a) => {
          if (a.selected_option >= 0 && a.selected_option <= 3) {
            optionCounts[a.selected_option]++;
            const name = playerMap.get(a.player_id);
            if (name) optionPlayerNames[a.selected_option].push(name);
          }
        });

        reveal = {
          questionId: activeQ.id,
          correctOptionIndex: activeQ.correct_option_index as 0 | 1 | 2 | 3,
          scriptureRef: activeQ.scripture_ref,
          explanation: activeQ.explanation,
          optionCounts,
          optionPlayerNames,
          totalAnswered: answers?.length || 0,
        };
      }
    }

    return NextResponse.json({
      player: {
        id: player.id,
        nickname: player.nickname,
        academicLevel: player.academic_level,
        totalScore: player.total_score,
        correctCount: player.correct_count,
        currentRank,
        totalPlayers,
      },
      roomSnapshot: {
        status: room.status,
        currentQuestionIndex: room.current_question_index,
        serverNowMs: Date.now(),
        questionEndsAtMs,
      },
      activeQuestion: publicQuestion,
      lockedOptionForActiveQuestion,
      reveal,
    });
  } catch (err: unknown) {
    console.error('Play session error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
