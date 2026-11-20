import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getHostSecretFromRequest, verifyHostSecret } from '@/lib/auth/hostAuth';
import { broadcastToRoom } from '@/lib/supabase/broadcast';
import {
  RoomStatus,
  PublicQuestionDTO,
  RevealedAnswerDTO,
  LeaderboardEntryDTO,
} from '@/types/quiz';
import {
  isUsingMockDb,
  mockGetRoomByPin,
  mockUpdateRoom,
  mockGetQuestions,
  mockGetPlayers,
  mockGetAnswersForQuestion,
} from '@/lib/mockDb';
import { isNeonAvailable, transitionRoomInNeon } from '@/lib/db/neonService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const { pin } = await params;
    const { secret, recoveryCode } = await getHostSecretFromRequest(req);

    const body = await req.json();
    const { targetState, questionIndex } = body as {
      targetState: RoomStatus;
      questionIndex?: number;
    };

    const serverNowMs = Date.now();
    let questionEndsAtMs: number | undefined;
    let publicQuestion: PublicQuestionDTO | undefined;
    let revealedAnswer: RevealedAnswerDTO | undefined;
    let top5Entries: LeaderboardEntryDTO[] | undefined;
    let podiumEntries: LeaderboardEntryDTO[] | undefined;

    // 1. Neon Database Transition Path
    if (isNeonAvailable()) {
      try {
        const neonRes = await transitionRoomInNeon({
          pin,
          targetState,
          questionIndex,
          hostSecret: secret,
          recoveryCode,
        });

        if (neonRes.success && neonRes.room) {
          const room = neonRes.room;
          if (room.status === 'QUESTION_ACTIVE' && room.question_started_at && neonRes.publicQuestion) {
            questionEndsAtMs =
              new Date(room.question_started_at).getTime() +
              neonRes.publicQuestion.timeLimitSec * 1000;
          }

          await broadcastToRoom(pin, 'state_change', {
            status: targetState,
            currentQuestionIndex: room.current_question_index,
            serverNowMs,
            questionEndsAtMs,
            question: neonRes.publicQuestion,
            reveal: neonRes.revealedAnswer,
            top5: neonRes.top5,
            podium: neonRes.podium,
          });

          return NextResponse.json({
            status: room.status,
            currentQuestionIndex: room.current_question_index,
            serverNowMs,
            questionEndsAtMs,
            question: neonRes.publicQuestion,
            reveal: neonRes.revealedAnswer,
            top5: neonRes.top5,
            podium: neonRes.podium,
          });
        } else if (neonRes.error) {
          return NextResponse.json({ error: neonRes.error }, { status: neonRes.statusCode });
        }
      } catch (neonErr) {
        console.warn('Neon transition error, falling back:', neonErr);
      }
    }

    // Check Mock DB fallback
    const mockRoom = mockGetRoomByPin(pin);
    if (isUsingMockDb() || mockRoom) {
      if (!mockRoom) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      const allQuestions = mockGetQuestions(mockRoom.id);
      const totalQuestions = allQuestions.length;
      const allPlayers = mockGetPlayers(mockRoom.id);
      const totalPlayers = allPlayers.length;

      if (targetState === 'QUESTION_ACTIVE') {
        const qIdx = questionIndex !== undefined ? questionIndex : mockRoom.current_question_index + 1;
        const activeQ = allQuestions[qIdx];
        if (!activeQ) {
          return NextResponse.json({ error: 'Question out of bounds' }, { status: 400 });
        }

        questionEndsAtMs = serverNowMs + activeQ.time_limit_sec * 1000;
        mockUpdateRoom(mockRoom.id, {
          status: 'QUESTION_ACTIVE',
          current_question_index: qIdx,
          question_started_at: new Date(serverNowMs).toISOString(),
        });

        publicQuestion = {
          id: activeQ.id,
          orderIndex: qIdx,
          totalQuestions,
          prompt: activeQ.prompt,
          options: [activeQ.option_a, activeQ.option_b, activeQ.option_c, activeQ.option_d],
          timeLimitSec: activeQ.time_limit_sec,
        };
      } else if (targetState === 'ANSWER_REVEALED') {
        const qIdx = mockRoom.current_question_index;
        const activeQ = allQuestions[qIdx];
        if (activeQ) {
          const ans = mockGetAnswersForQuestion(mockRoom.id, activeQ.id);
          const optionCounts: [number, number, number, number] = [0, 0, 0, 0];
          const optionPlayerNames: [string[], string[], string[], string[]] = [[], [], [], []];
          const playerMap = new Map(allPlayers.map((p) => [p.id, p.nickname]));

          ans.forEach((a) => {
            if (a.selected_option >= 0 && a.selected_option <= 3) {
              optionCounts[a.selected_option]++;
              const name = playerMap.get(a.player_id);
              if (name) {
                optionPlayerNames[a.selected_option].push(name);
              }
            }
          });

          revealedAnswer = {
            questionId: activeQ.id,
            correctOptionIndex: activeQ.correct_option_index as 0 | 1 | 2 | 3,
            scriptureRef: activeQ.scripture_ref,
            explanation: activeQ.explanation,
            optionCounts,
            optionPlayerNames,
            totalAnswered: ans.length,
          };

          mockUpdateRoom(mockRoom.id, { status: 'ANSWER_REVEALED' });
        }
      } else if (targetState === 'LEADERBOARD') {
        const sorted = [...allPlayers].sort((a, b) => b.total_score - a.total_score);
        top5Entries = sorted.slice(0, 5).map((p, idx) => ({
          rank: idx + 1,
          playerId: p.id,
          nickname: p.nickname,
          academicLevel: p.academic_level,
          totalScore: p.total_score,
          correctCount: p.correct_count,
        }));
        mockUpdateRoom(mockRoom.id, { status: 'LEADERBOARD' });
      } else if (targetState === 'GAME_OVER') {
        const sorted = [...allPlayers].sort((a, b) => b.total_score - a.total_score);
        podiumEntries = sorted.slice(0, 10).map((p, idx) => ({
          rank: idx + 1,
          playerId: p.id,
          nickname: p.nickname,
          academicLevel: p.academic_level,
          totalScore: p.total_score,
          correctCount: p.correct_count,
        }));
        mockUpdateRoom(mockRoom.id, { status: 'GAME_OVER' });
      }

      await broadcastToRoom(pin, 'state_change', {
        status: targetState,
        currentQuestionIndex: targetState === 'QUESTION_ACTIVE' ? (questionIndex ?? mockRoom.current_question_index + 1) : mockRoom.current_question_index,
        serverNowMs,
        questionEndsAtMs,
        question: publicQuestion,
        reveal: revealedAnswer,
        top5: top5Entries,
        podium: podiumEntries,
        totalPlayers,
      });

      return NextResponse.json({
        status: targetState,
        currentQuestionIndex: targetState === 'QUESTION_ACTIVE' ? (questionIndex ?? mockRoom.current_question_index + 1) : mockRoom.current_question_index,
        serverNowMs,
        questionEndsAtMs,
        question: publicQuestion,
        reveal: revealedAnswer,
        top5: top5Entries,
        podium: podiumEntries,
      });
    }

    // Otherwise use Supabase
    const supabase = getSupabaseServerClient();
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('pin', pin)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const isSecretValid = secret ? verifyHostSecret(secret, room.host_secret_hash) : false;
    const isRecoveryValid = recoveryCode ? recoveryCode === room.host_recovery_code : false;

    if (!isSecretValid && !isRecoveryValid) {
      return NextResponse.json({ error: 'Unauthorized host session' }, { status: 401 });
    }

    const { data: allQuestions } = await supabase
      .from('questions')
      .select('*')
      .eq('room_id', room.id)
      .order('order_index', { ascending: true });

    const totalQuestions = allQuestions?.length || 0;

    const { count: totalPlayersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('is_kicked', false);

    const totalPlayers = totalPlayersCount || 0;

    if (targetState === 'QUESTION_ACTIVE') {
      const qIdx = questionIndex !== undefined ? questionIndex : room.current_question_index + 1;
      if (qIdx < 0 || qIdx >= totalQuestions) {
        return NextResponse.json({ error: 'Question index out of bounds' }, { status: 400 });
      }

      const activeQ = allQuestions![qIdx];
      const timeLimitSec = activeQ.time_limit_sec;
      questionEndsAtMs = serverNowMs + timeLimitSec * 1000;

      await supabase
        .from('rooms')
        .update({
          status: 'QUESTION_ACTIVE',
          current_question_index: qIdx,
          question_started_at: new Date(serverNowMs).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);

      publicQuestion = {
        id: activeQ.id,
        orderIndex: qIdx,
        totalQuestions,
        prompt: activeQ.prompt,
        options: [activeQ.option_a, activeQ.option_b, activeQ.option_c, activeQ.option_d],
        timeLimitSec,
      };
    } else if (targetState === 'ANSWER_REVEALED') {
      const qIdx = room.current_question_index;
      const activeQ = allQuestions![qIdx];

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
          if (name) {
            optionPlayerNames[a.selected_option].push(name);
          }
        }
      });

      revealedAnswer = {
        questionId: activeQ.id,
        correctOptionIndex: activeQ.correct_option_index as 0 | 1 | 2 | 3,
        scriptureRef: activeQ.scripture_ref,
        explanation: activeQ.explanation,
        optionCounts,
        optionPlayerNames,
        totalAnswered: answers?.length || 0,
      };

      await supabase
        .from('rooms')
        .update({
          status: 'ANSWER_REVEALED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);
    } else if (targetState === 'LEADERBOARD') {
      const { data: topPlayers } = await supabase
        .from('players')
        .select('id, nickname, academic_level, total_score, correct_count')
        .eq('room_id', room.id)
        .eq('is_kicked', false)
        .order('total_score', { ascending: false })
        .order('total_correct_response_ms', { ascending: true })
        .order('joined_at', { ascending: true })
        .limit(5);

      top5Entries = (topPlayers || []).map((p, idx) => ({
        rank: idx + 1,
        playerId: p.id,
        nickname: p.nickname,
        academicLevel: p.academic_level,
        totalScore: p.total_score,
        correctCount: p.correct_count,
      }));

      await supabase
        .from('rooms')
        .update({
          status: 'LEADERBOARD',
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);
    } else if (targetState === 'GAME_OVER') {
      const { data: podiumPlayers } = await supabase
        .from('players')
        .select('id, nickname, academic_level, total_score, correct_count')
        .eq('room_id', room.id)
        .eq('is_kicked', false)
        .order('total_score', { ascending: false })
        .order('total_correct_response_ms', { ascending: true })
        .order('joined_at', { ascending: true })
        .limit(10);

      podiumEntries = (podiumPlayers || []).map((p, idx) => ({
        rank: idx + 1,
        playerId: p.id,
        nickname: p.nickname,
        academicLevel: p.academic_level,
        totalScore: p.total_score,
        correctCount: p.correct_count,
      }));

      await supabase
        .from('rooms')
        .update({
          status: 'GAME_OVER',
          updated_at: new Date().toISOString(),
        })
        .eq('id', room.id);
    }

    await broadcastToRoom(pin, 'state_change', {
      status: targetState,
      currentQuestionIndex: targetState === 'QUESTION_ACTIVE' ? (questionIndex ?? room.current_question_index + 1) : room.current_question_index,
      serverNowMs,
      questionEndsAtMs,
      question: publicQuestion,
      reveal: revealedAnswer,
      top5: top5Entries,
      podium: podiumEntries,
      totalPlayers,
    });

    return NextResponse.json({
      status: targetState,
      currentQuestionIndex: targetState === 'QUESTION_ACTIVE' ? (questionIndex ?? room.current_question_index + 1) : room.current_question_index,
      serverNowMs,
      questionEndsAtMs,
      question: publicQuestion,
      reveal: revealedAnswer,
      top5: top5Entries,
      podium: podiumEntries,
    });
  } catch (err: unknown) {
    console.error('Transition state error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
