'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayerStore } from '@/store/usePlayerStore';
import { PlayerStatusHeader } from '@/components/player/PlayerStatusHeader';
import { PlayerAnswerGrid } from '@/components/player/PlayerAnswerGrid';
import { PlayerResultCard } from '@/components/player/PlayerResultCard';
import { PlayerGameOverCard } from '@/components/player/PlayerGameOverCard';
import { HypePillBar } from '@/components/player/HypePillBar';
import { CountdownTimer } from '@/components/shared/CountdownTimer';
import { ConnectionStatusToast } from '@/components/shared/ConnectionStatusToast';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';
import { isRealtimeConfigured } from '@/lib/supabase/client';
import { ui } from '@/lib/ui';

interface PlayerRoomPageProps {
  params: Promise<{ pin: string }>;
}

export default function PlayerRoomPage({ params }: PlayerRoomPageProps) {
  const { pin } = use(params);
  const router = useRouter();

  const playerToken = usePlayerStore((s) => s.playerToken);
  const nickname = usePlayerStore((s) => s.nickname);
  const academicLevel = usePlayerStore((s) => s.academicLevel);
  const roomStatus = usePlayerStore((s) => s.roomStatus);
  const currentQuestionIndex = usePlayerStore((s) => s.currentQuestionIndex);
  const activeQuestion = usePlayerStore((s) => s.activeQuestion);
  const questionEndsAtMs = usePlayerStore((s) => s.questionEndsAtMs);
  const clockOffsetMs = usePlayerStore((s) => s.clockOffsetMs);
  const isConnected = usePlayerStore((s) => s.isConnected);
  const isReconnecting = usePlayerStore((s) => s.isReconnecting);

  const initSessionFromStorage = usePlayerStore((s) => s.initSessionFromStorage);
  const setPlayerState = usePlayerStore((s) => s.setPlayerState);
  const subscribeToRoom = usePlayerStore((s) => s.subscribeToRoom);
  const cleanup = usePlayerStore((s) => s.cleanup);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Session Rehydration & Sync
  useEffect(() => {
    let token = playerToken;

    if (!token) {
      const stored = initSessionFromStorage();
      if (stored && stored.pin === pin) {
        token = stored.playerToken;
      } else {
        router.push(`/play?pin=${pin}`);
        return;
      }
    }

    async function rehydrateSession(activeToken: string) {
      try {
        const res = await fetch(`/api/play/session?pin=${pin}`, {
          headers: {
            'X-Player-Token': activeToken,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            setErrorMessage('You’re no longer in this game. Join again with the PIN on the screen.');
          } else {
            setErrorMessage('This game couldn’t be found. Check the PIN on the screen.');
          }
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        const serverNow = data.roomSnapshot.serverNowMs;
        const localNow = Date.now();
        const offset = serverNow - localNow;

        setPlayerState({
          playerId: data.player.id,
          nickname: data.player.nickname,
          academicLevel: data.player.academicLevel,
          roomStatus: data.roomSnapshot.status,
          currentQuestionIndex: data.roomSnapshot.currentQuestionIndex,
          activeQuestion: data.activeQuestion,
          questionEndsAtMs: data.roomSnapshot.questionEndsAtMs,
          clockOffsetMs: offset,
          selectedOption: data.lockedOptionForActiveQuestion,
          isLocked: data.lockedOptionForActiveQuestion !== null,
          reveal: data.reveal,
          result: {
            isCorrect: data.myResult?.isCorrect ?? false,
            pointsAwarded: data.myResult?.pointsAwarded ?? 0,
            cumulativeScore: data.player.totalScore,
            currentRank: data.player.currentRank,
            totalPlayers: data.player.totalPlayers,
          },
        });

        setIsLoading(false);
        subscribeToRoom(pin);
      } catch (err) {
        console.error('Session hydration failed:', err);
        setErrorMessage('No connection. Check your mobile data, then try again.');
        setIsLoading(false);
      }
    }

    rehydrateSession(token);

    return () => {
      cleanup();
    };
  }, [pin, playerToken, initSessionFromStorage, router, setPlayerState, subscribeToRoom, cleanup]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6">
        <p className="text-muted">Connecting to the game…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-[100dvh] flex flex-col justify-center gap-6 px-6 max-w-md mx-auto">
        <h1 className="font-display text-3xl leading-tight">{errorMessage}</h1>
        <a href={`/play?pin=${pin}`} className={`${ui.btnPrimary} self-start`}>
          Join again
        </a>
      </div>
    );
  }

  return (
    <div className={`min-h-[100dvh] flex flex-col ${isRealtimeConfigured ? 'pb-24' : 'pb-6'}`}>
      <ConnectionStatusToast isConnected={isConnected} isReconnecting={isReconnecting} />
      <PlayerStatusHeader />

      <main className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto px-4 py-6">
        {roomStatus === 'LOBBY' && (
          <section className="animate-enter">
            <p className="text-sm text-psalm">You’re in</p>
            <h1 className="mt-2 font-display text-4xl leading-tight">Welcome, {nickname}</h1>
            <p className="mt-1 text-muted">
              <AcademicLevelBadge level={academicLevel} size="md" />
            </p>
            <p className="mt-8 text-lg leading-relaxed text-page/85">
              Watch the hall screen. Questions appear here as soon as the quizmaster starts.
            </p>
          </section>
        )}

        {roomStatus === 'QUESTION_ACTIVE' && activeQuestion && (
          <section key={activeQuestion.id} className="flex flex-col gap-5 animate-enter">
            {questionEndsAtMs && (
              <CountdownTimer
                totalSeconds={activeQuestion.timeLimitSec}
                questionEndsAtMs={questionEndsAtMs}
                clockOffsetMs={clockOffsetMs}
              />
            )}
            <div>
              <p className="text-sm tabular-nums text-faint">
                Question {currentQuestionIndex + 1} of {activeQuestion.totalQuestions}
              </p>
              <h2 className="mt-1.5 font-display text-2xl leading-snug">{activeQuestion.prompt}</h2>
            </div>
            <PlayerAnswerGrid question={activeQuestion} />
          </section>
        )}

        {roomStatus === 'ANSWER_REVEALED' && <PlayerResultCard />}

        {roomStatus === 'LEADERBOARD' && (
          <section className="animate-enter">
            <h1 className="font-display text-4xl leading-tight">Standings are on the screen</h1>
            <p className="mt-3 text-lg text-muted">The next question comes up here when it starts.</p>
          </section>
        )}

        {roomStatus === 'GAME_OVER' && <PlayerGameOverCard />}
      </main>

      {isRealtimeConfigured && <HypePillBar />}
    </div>
  );
}
