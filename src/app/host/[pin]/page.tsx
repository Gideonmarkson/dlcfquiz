'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Volume2, VolumeX, Maximize, Minimize, AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { HostLobbyView } from '@/components/host/HostLobbyView';
import { HostQuestionActiveView } from '@/components/host/HostQuestionActiveView';
import { HostAnswerRevealedView } from '@/components/host/HostAnswerRevealedView';
import { HostLeaderboardView } from '@/components/host/HostLeaderboardView';
import { HostPodiumView } from '@/components/host/HostPodiumView';
import { FloatingHypeOverlay } from '@/components/host/FloatingHypeOverlay';
import { ConnectionStatusToast } from '@/components/shared/ConnectionStatusToast';
import { setAudioEnabled, isAudioEnabled } from '@/lib/audio';

interface HostRoomPageProps {
  params: Promise<{ pin: string }>;
}

export default function HostRoomPage({ params }: HostRoomPageProps) {
  const { pin } = use(params);
  const status = useHostStore((s) => s.status);
  const currentQuestionIndex = useHostStore((s) => s.currentQuestionIndex);
  const questions = useHostStore((s) => s.questions);
  const isConnected = useHostStore((s) => s.isConnected);
  const setRoomState = useHostStore((s) => s.setRoomState);
  const subscribeToRoom = useHostStore((s) => s.subscribeToRoom);
  const cleanup = useHostStore((s) => s.cleanup);

  const [soundOn, setSoundOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Helper for authenticated host calls
  const getHostHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof window !== 'undefined') {
      const secret = localStorage.getItem(`dlcf_host_secret_${pin}`);
      if (secret) headers['x-host-secret'] = secret;
    }
    return headers;
  };

  // 1. Hydrate Initial State from Server
  useEffect(() => {
    let isMounted = true;

    async function loadRoomSnapshot() {
      try {
        const res = await fetch(`/api/host/rooms/${pin}`, {
          headers: getHostHeaders(),
        });
        if (!res.ok) {
          if (res.status === 401) {
            setErrorMessage('Unauthorized host session. Please create or resume from host setup.');
          } else {
            setErrorMessage('Quiz room not found.');
          }
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        if (isMounted) {
          setRoomState({
            pin: data.room.pin,
            title: data.room.title,
            status: data.room.status,
            currentQuestionIndex: data.room.currentQuestionIndex,
            questionEndsAtMs: data.room.questionEndsAtMs,
            questions: data.questions,
            players: data.players,
            answeredCount: data.answeredCount,
            reveal: data.reveal ?? null,
            top5: data.top5,
            podium: data.podium,
          });
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load host room:', err);
        if (isMounted) {
          setErrorMessage('Failed to connect to room server.');
          setIsLoading(false);
        }
      }
    }

    loadRoomSnapshot();
    subscribeToRoom(pin);

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [pin, setRoomState, subscribeToRoom, cleanup]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setAudioEnabled(next);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // State Transition Dispatcher
  const handleTransition = async (targetState: string, qIdx?: number) => {
    setIsTransitioning(true);
    try {
      const res = await fetch(`/api/host/rooms/${pin}/transition`, {
        method: 'POST',
        headers: getHostHeaders(),
        body: JSON.stringify({
          targetState,
          questionIndex: qIdx,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRoomState({
          status: data.status,
          currentQuestionIndex: data.currentQuestionIndex,
          questionEndsAtMs: data.questionEndsAtMs ?? null,
          reveal: data.reveal ?? null,
          top5: data.top5 ?? [],
          podium: data.podium ?? [],
          answeredCount: 0,
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('Transition failed:', errData);
      }
    } catch (err) {
      console.error('Failed to transition state', err);
    } finally {
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-slate-300">
          Loading Fellowship Projection Console...
        </span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <h2 className="text-2xl font-bold text-slate-100">{errorMessage}</h2>
        <a
          href="/host"
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm"
        >
          Return to Host Setup
        </a>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none relative overflow-x-hidden">
      {/* Realtime Floating Emojis Layer */}
      <FloatingHypeOverlay />

      {/* Connection Toast if disconnected */}
      <ConnectionStatusToast isConnected={isConnected} />

      {/* Top Console Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/host"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-700 shadow-sm"
            title="Exit to Host Setup"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Setup / Back</span>
          </Link>
          <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="font-extrabold text-sm tracking-wider uppercase text-slate-300 hidden md:inline">
            DLCF AFIT Projector Console
          </span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40">
            PIN: {pin}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Chimes Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title={soundOn ? 'Sound On' : 'Sound Muted'}
          >
            {soundOn ? <Volume2 className="w-5 h-5 text-amber-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>

          {/* Fullscreen Projector Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (1080p Projector Mode)'}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Stage View Router */}
      <main className="flex-1 flex flex-col justify-center items-center z-10 w-full">
        {status === 'LOBBY' && (
          <HostLobbyView
            onStartQuiz={() => handleTransition('QUESTION_ACTIVE', 0)}
            isStarting={isTransitioning}
          />
        )}

        {status === 'QUESTION_ACTIVE' && (
          <HostQuestionActiveView
            onEndEarly={() => handleTransition('ANSWER_REVEALED')}
          />
        )}

        {status === 'ANSWER_REVEALED' && (
          <HostAnswerRevealedView
            isLastQuestion={isLastQuestion}
            onShowLeaderboard={() => {
              if (isLastQuestion) {
                handleTransition('GAME_OVER');
              } else {
                handleTransition('LEADERBOARD');
              }
            }}
          />
        )}

        {status === 'LEADERBOARD' && (
          <HostLeaderboardView
            isLastQuestion={isLastQuestion}
            onNextQuestion={() => {
              if (isLastQuestion) {
                handleTransition('GAME_OVER');
              } else {
                handleTransition('QUESTION_ACTIVE', currentQuestionIndex + 1);
              }
            }}
          />
        )}

        {status === 'GAME_OVER' && <HostPodiumView />}
      </main>

      {/* Footer Branding Bar */}
      <footer className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-3 mt-4 z-20">
        <span>Deeper Life Campus Fellowship • Air Force Institute of Technology Kaduna</span>
        <span>2 Timothy 2:15 • Speed + Accuracy Scoring</span>
      </footer>
    </div>
  );
}
