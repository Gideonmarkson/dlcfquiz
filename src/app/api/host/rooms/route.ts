import { NextRequest, NextResponse } from 'next/server';
import { generateRoomPin, generateRecoveryCode } from '@/lib/pinGenerator';
import {
  generateHostSecret,
  hashHostSecret,
  HOST_COOKIE_NAME,
} from '@/lib/auth/hostAuth';
import { QuestionsArraySchema } from '@/lib/questionParser';
import { isUsingMockDb, mockCreateRoom, mockInsertQuestions } from '@/lib/mockDb';
import { isNeonAvailable, createRoomInNeon } from '@/lib/db/neonService';

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

    if (isNeonAvailable()) {
      try {
        const neonResult = await createRoomInNeon({
          pin,
          title: title.slice(0, 120),
          hostSecretHash,
          hostRecoveryCode,
          questions: validation.data,
        });
        roomId = neonResult.room.id;
        roomStatus = neonResult.room.status;

        // Also register in in-memory store so process-local queries succeed instantly
        try {
          const room = mockCreateRoom({
            pin,
            title: title.slice(0, 120),
            host_secret_hash: hostSecretHash,
            host_recovery_code: hostRecoveryCode,
          });
          room.id = neonResult.room.id;
          mockInsertQuestions(room.id, validation.data);
        } catch {
          // ignore cache sync error
        }
      } catch (neonErr) {
        console.error('Neon room creation failed, falling back to mock store:', neonErr);
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
    } else {
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
    }

    const response = NextResponse.json(
      {
        roomId,
        pin,
        title,
        recoveryCode: hostRecoveryCode,
        hostSecret,
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
