import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rateLimiter';
import { broadcastToRoom } from '@/lib/supabase/broadcast';
import { AcademicLevel } from '@/types/quiz';
import {
  isUsingMockDb,
  mockGetRoomByPin,
  mockAddPlayer,
  mockGetPlayers,
} from '@/lib/mockDb';
import { isNeonAvailable, joinPlayerInNeon } from '@/lib/db/neonService';

const RATE_LIMIT_PER_MIN = parseInt(process.env.JOIN_RATE_LIMIT_PER_MIN || '5000', 10);

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    // Generous rate limit (5,000/min) ensures 200+ students on the same fellowship Wi-Fi router join smoothly
    const rateCheck = checkRateLimit(`join:${ip}`, RATE_LIMIT_PER_MIN, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Connection busy. Please tap join again in a few seconds.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { pin, nickname, name, academicLevel, existingToken } = body as {
      pin?: string;
      nickname?: string;
      name?: string;
      academicLevel?: AcademicLevel;
      existingToken?: string;
    };

    if (!pin || !/^[0-9]{6}$/.test(pin)) {
      return NextResponse.json({ error: 'Valid 6-digit Room PIN is required.' }, { status: 400 });
    }

    const cleanNick = (name || nickname || '').trim();
    if (cleanNick.length < 2 || cleanNick.length > 20) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 20 characters.' },
        { status: 400 }
      );
    }

    const VALID_LEVELS: AcademicLevel[] = ['100L', '200L', '300L', '400L', '500L', 'PG/STAFF'];
    const selectedLevel: AcademicLevel = VALID_LEVELS.includes(academicLevel as AcademicLevel)
      ? (academicLevel as AcademicLevel)
      : '100L';

    // 1. Neon Database Join Path
    if (isNeonAvailable()) {
      try {
        const joinResult = await joinPlayerInNeon({
          pin,
          nickname: cleanNick,
          academicLevel: selectedLevel,
          existingToken,
        });

        if (joinResult.success && joinResult.player) {
          const p = joinResult.player;
          await broadcastToRoom(pin, 'lobby_update', {
            action: 'join',
            player: {
              id: p.id,
              nickname: p.nickname,
              academicLevel: p.academic_level,
            },
            totalPlayers: joinResult.totalPlayers || 1,
          });

          return NextResponse.json(
            {
              playerId: p.id,
              playerToken: p.player_token,
              pin,
              nickname: p.nickname,
              academicLevel: p.academic_level,
              totalScore: p.total_score,
              resumed: joinResult.resumed || false,
            },
            { status: joinResult.statusCode }
          );
        } else if (joinResult.error) {
          return NextResponse.json(
            {
              error: joinResult.error,
              suggestedNickname:
                joinResult.statusCode === 409 ? `${cleanNick}_${selectedLevel}` : undefined,
            },
            { status: joinResult.statusCode }
          );
        }
      } catch (neonErr) {
        console.warn('Neon join failed, falling back to mock:', neonErr);
      }
    }

    // Mock DB Fallback
    const mockRoom = mockGetRoomByPin(pin);
    if (isUsingMockDb() || mockRoom) {
      if (!mockRoom) {
        return NextResponse.json({ error: 'Room PIN not found.' }, { status: 404 });
      }

      if (mockRoom.status === 'GAME_OVER') {
        return NextResponse.json({ error: 'This quiz session has already ended.' }, { status: 409 });
      }

      const existingPlayers = mockGetPlayers(mockRoom.id);
      if (existingToken) {
        const found = existingPlayers.find((p) => p.player_token === existingToken);
        if (found) {
          return NextResponse.json({
            playerId: found.id,
            playerToken: found.player_token,
            pin: mockRoom.pin,
            nickname: found.nickname,
            academicLevel: found.academic_level,
            totalScore: found.total_score,
            resumed: true,
            roomSnapshot: {
              status: mockRoom.status,
              currentQuestionIndex: mockRoom.current_question_index,
            },
          });
        }
      }

      // Check duplicate
      const duplicate = existingPlayers.find((p) => p.nickname.toLowerCase() === cleanNick.toLowerCase());
      if (duplicate) {
        return NextResponse.json(
          {
            error: `The name '${cleanNick}' is already taken in this room.`,
            suggestedNickname: `${cleanNick}_${selectedLevel}`,
          },
          { status: 409 }
        );
      }

      const newPlayer = mockAddPlayer(mockRoom.id, cleanNick, selectedLevel);
      const total = mockGetPlayers(mockRoom.id).length;

      await broadcastToRoom(pin, 'lobby_update', {
        action: 'join',
        player: {
          id: newPlayer.id,
          nickname: newPlayer.nickname,
          academicLevel: newPlayer.academic_level,
        },
        totalPlayers: total,
      });

      return NextResponse.json(
        {
          playerId: newPlayer.id,
          playerToken: newPlayer.player_token,
          pin: mockRoom.pin,
          nickname: newPlayer.nickname,
          academicLevel: newPlayer.academic_level,
          roomSnapshot: {
            status: mockRoom.status,
            currentQuestionIndex: mockRoom.current_question_index,
          },
        },
        { status: 201 }
      );
    }

    // Supabase
    const supabase = getSupabaseServerClient();
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, pin, title, status, current_question_index, question_started_at, allow_late_join')
      .eq('pin', pin)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room PIN not found.' }, { status: 404 });
    }

    if (room.status === 'GAME_OVER') {
      return NextResponse.json({ error: 'This quiz session has already ended.' }, { status: 409 });
    }

    if (existingToken) {
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id)
        .eq('player_token', existingToken)
        .eq('is_kicked', false)
        .single();

      if (existingPlayer) {
        return NextResponse.json({
          playerId: existingPlayer.id,
          playerToken: existingPlayer.player_token,
          pin: room.pin,
          nickname: existingPlayer.nickname,
          academicLevel: existingPlayer.academic_level,
          totalScore: existingPlayer.total_score,
          resumed: true,
          roomSnapshot: {
            status: room.status,
            currentQuestionIndex: room.current_question_index,
          },
        });
      }
    }

    const normalizedNick = cleanNick.toLowerCase();
    const { data: duplicate } = await supabase
      .from('players')
      .select('id, nickname')
      .eq('room_id', room.id)
      .eq('nickname_normalized', normalizedNick)
      .maybeSingle();

    if (duplicate) {
      const suggestion = `${cleanNick}_${selectedLevel}`;
      return NextResponse.json(
        {
          error: `The name '${cleanNick}' is already taken in this room.`,
          suggestedNickname: suggestion,
        },
        { status: 409 }
      );
    }

    const { data: newPlayer, error: playerError } = await supabase
      .from('players')
      .insert({
        room_id: room.id,
        nickname: cleanNick,
        academic_level: selectedLevel,
      })
      .select()
      .single();

    if (playerError || !newPlayer) {
      return NextResponse.json(
        { error: 'Failed to join room: ' + (playerError?.message || '') },
        { status: 500 }
      );
    }

    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('is_kicked', false);

    await broadcastToRoom(pin, 'lobby_update', {
      action: 'join',
      player: {
        id: newPlayer.id,
        nickname: newPlayer.nickname,
        academicLevel: newPlayer.academic_level,
      },
      totalPlayers: count || 0,
    });

    return NextResponse.json(
      {
        playerId: newPlayer.id,
        playerToken: newPlayer.player_token,
        pin: room.pin,
        nickname: newPlayer.nickname,
        academicLevel: newPlayer.academic_level,
        roomSnapshot: {
          status: room.status,
          currentQuestionIndex: room.current_question_index,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Play join unhandled error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
