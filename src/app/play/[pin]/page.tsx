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
import { Users, BookOpen, Clock, AlertCircle } from 'lucide-react';

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
            setErrorMessage('Your session was not found or you were removed from the room.');
          } else {
            setErrorMessage('Quiz room could not be loaded.');
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
            isCorrect: false,
            pointsAwarded: 0,
            cumulativeScore: data.player.totalScore,
            currentRank: data.player.currentRank,
            totalPlayers: data.player.totalPlayers,
          },
        });

        setIsLoading(false);
      } catch (err) {
        console.error('Session hydration failed:', err);
        setErrorMessage('Failed to connect to room.');
        setIsLoading(false);
      }
    }

    rehydrateSession(token);
    subscribeToRoom(pin);

    return () => {
      cleanup();
    };
  }, [pin, playerToken, initSessionFromStorage, router, setPlayerState, subscribeToRoom, cleanup]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-semibold">Connecting to fellowship arena...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold text-slate-100">{errorMessage}</h2>
        <a
          href={`/play?pin=${pin}`}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm"
        >
          Re-enter Room
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-900 text-slate-50 flex flex-col justify-between pb-[84px] relative overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
      {/* Network Alert Toast */}
      <ConnectionStatusToast isConnected={isConnected} isReconnecting={isReconnecting} />

      {/* Sticky Header */}
      <PlayerStatusHeader />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 max-w-md w-full mx-auto">
        {/* State 1: LOBBY */}
        {roomStatus === 'LOBBY' && (
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 md:p-8 text-center shadow-2xl backdrop-blur flex flex-col items-center gap-4 w-full animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/15 text-amber-400 flex items-center justify-center shadow-inner">
              <Users className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                You&apos;re Connected!
              </span>
              <h2 className="text-2xl font-black text-slate-100 mt-1">
                Welcome, {nickname}!
              </h2>
              <div className="mt-1">
                <AcademicLevelBadge level={academicLevel} size="md" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-700/60 text-slate-300 text-xs leading-relaxed mt-2">
              Eyes on the fellowship screen! The quizmaster will start Question 1 shortly. Tap reactions below to send HYPE to the hall screen!
            </div>
          </div>
        )}

        {/* State 2: QUESTION_ACTIVE */}
        {roomStatus === 'QUESTION_ACTIVE' && activeQuestion && (
          <div className="flex flex-col gap-4 w-full animate-fadeIn">
            {/* Countdown Bar */}
            {questionEndsAtMs && (
              <CountdownTimer
                totalSeconds={activeQuestion.timeLimitSec}
                questionEndsAtMs={questionEndsAtMs}
                clockOffsetMs={clockOffsetMs}
              />
            )}

            {/* Compact Prompt Card */}
            <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl text-center">
              <span className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider">
                Question {currentQuestionIndex + 1} of {activeQuestion.totalQuestions}
              </span>
              <h3 className="text-lg md:text-xl font-bold text-slate-100 mt-1 leading-snug">
                {activeQuestion.prompt}
              </h3>
            </div>

            {/* 4 Large Tap Buttons */}
            <PlayerAnswerGrid question={activeQuestion} />
          </div>
        )}

        {/* State 3: ANSWER_REVEALED */}
        {roomStatus === 'ANSWER_REVEALED' && <PlayerResultCard />}

        {/* State 4: LEADERBOARD */}
        {roomStatus === 'LEADERBOARD' && (
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 text-center shadow-2xl backdrop-blur flex flex-col items-center gap-4 w-full animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
                Leaderboard Showing on Screen
              </span>
              <h3 className="text-xl font-black text-slate-100">
                Look at the Fellowship Projector!
              </h3>
            </div>

            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Check the main screen to see the Top 5 fellowship standings. Get ready for the next round!
            </p>
          </div>
        )}

        {/* State 5: GAME_OVER */}
        {roomStatus === 'GAME_OVER' && <PlayerGameOverCard />}
      </main>

      {/* Persistent Bottom Floating HYPE Pill Bar */}
      <HypePillBar />
    </div>
  );
}
