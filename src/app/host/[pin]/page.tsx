'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Volume2, VolumeX, Maximize, Minimize, QrCode } from 'lucide-react';
import { JoinCodeOverlay } from '@/components/host/JoinCode';
import { ui } from '@/lib/ui';
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
  const [showJoinCode, setShowJoinCode] = useState(false);
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
            setErrorMessage('This browser isn’t the host for that game. Open it from the device that created it.');
          } else {
            setErrorMessage('No game with that PIN.');
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
          setErrorMessage('Can’t reach the server. Check the internet connection and reload.');
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
  const transitionInFlight = React.useRef(false);

  const handleTransition = async (targetState: string, qIdx?: number) => {
    if (transitionInFlight.current) return;
    transitionInFlight.current = true;
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
      transitionInFlight.current = false;
      setIsTransitioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <p className="text-lg text-muted">Loading the game…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-[100dvh] flex flex-col justify-center gap-6 px-8 max-w-2xl mx-auto">
        <h1 className="font-display text-4xl leading-tight">{errorMessage}</h1>
        <a href="/host" className={`${ui.btnPrimary} self-start`}>
          Back to setup
        </a>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  return (
    <div className="min-h-[100dvh] flex flex-col px-5 sm:px-8 lg:px-12 select-none">
      <FloatingHypeOverlay />
      {showJoinCode && <JoinCodeOverlay pin={pin} onClose={() => setShowJoinCode(false)} />}
      <ConnectionStatusToast isConnected={isConnected} />

      <header className="flex items-center justify-between gap-4 border-b border-rule py-3">
        <div className="flex items-center gap-5">
          <Link href="/host" className="font-display text-xl text-page hover:text-gilt transition-colors">
            Bible Quiz
          </Link>
          {status !== 'LOBBY' && status !== 'GAME_OVER' && (
            <button
              type="button"
              onClick={() => setShowJoinCode(true)}
              className="inline-flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 text-muted transition-colors hover:bg-cover-2 hover:text-page"
              title="Show the QR code for latecomers"
            >
              <QrCode className="h-5 w-5" />
              Join with PIN <span className="font-semibold tabular-nums tracking-wider text-page">{pin}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSound}
            className={ui.btnQuiet}
            aria-label={soundOn ? 'Mute sound' : 'Turn sound on'}
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className={ui.btnQuiet}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center w-full py-6">
        {status === 'LOBBY' && (
          <HostLobbyView onStartQuiz={() => handleTransition('QUESTION_ACTIVE', 0)} isStarting={isTransitioning} />
        )}

        {status === 'QUESTION_ACTIVE' && (
          <HostQuestionActiveView onEndEarly={() => handleTransition('ANSWER_REVEALED')} isBusy={isTransitioning} />
        )}

        {status === 'ANSWER_REVEALED' && (
          <HostAnswerRevealedView
            isLastQuestion={isLastQuestion}
            isBusy={isTransitioning}
            onShowLeaderboard={() => handleTransition(isLastQuestion ? 'GAME_OVER' : 'LEADERBOARD')}
          />
        )}

        {status === 'LEADERBOARD' && (
          <HostLeaderboardView
            isLastQuestion={isLastQuestion}
            isBusy={isTransitioning}
            onNextQuestion={() =>
              isLastQuestion
                ? handleTransition('GAME_OVER')
                : handleTransition('QUESTION_ACTIVE', currentQuestionIndex + 1)
            }
          />
        )}

        {status === 'GAME_OVER' && <HostPodiumView />}
      </main>
    </div>
  );
}
