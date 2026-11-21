'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { playUrgentTick } from '@/lib/audio';

interface CountdownTimerProps {
  totalSeconds: number;
  questionEndsAtMs: number;
  clockOffsetMs?: number;
  isHost?: boolean;
  onTimeUp?: () => void;
  className?: string;
  showFullScreenLowTimeOverlay?: boolean;
}

const URGENT_AT_SECONDS = 10;

/**
 * React only re-renders once per second (when the number changes).
 * The bar shrinks with a single CSS transition, which stays smooth on low-end phones
 * instead of re-rendering the whole question 60 times a second.
 */
export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  totalSeconds,
  questionEndsAtMs,
  clockOffsetMs = 0,
  isHost = false,
  onTimeUp,
  className = '',
  showFullScreenLowTimeOverlay = true,
}) => {
  const totalMs = totalSeconds * 1000;
  const getRemainingMs = () => Math.max(0, questionEndsAtMs - (Date.now() + clockOffsetMs));

  const [seconds, setSeconds] = useState(() => Math.ceil(getRemainingMs() / 1000));
  const barRef = useRef<HTMLDivElement>(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  // Start (or restart) the bar animation whenever the deadline changes.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const remaining = getRemainingMs();
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${totalMs > 0 ? Math.min(1, remaining / totalMs) : 0})`;
    // Force a reflow so the browser registers the starting width before transitioning.
    void bar.offsetWidth;
    bar.style.transition = `transform ${remaining}ms linear`;
    bar.style.transform = 'scaleX(0)';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionEndsAtMs, clockOffsetMs, totalMs]);

  // Tick the number once per second, aligned to second boundaries.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let lastSec = -1;
    let fired = false;

    const tick = () => {
      const remaining = getRemainingMs();
      const sec = Math.ceil(remaining / 1000);

      if (sec !== lastSec) {
        lastSec = sec;
        setSeconds(sec);
        // Only the last 5 seconds tick, on the projector only.
        if (isHost && sec > 0 && sec <= 5) playUrgentTick(sec);
      }

      if (remaining <= 0) {
        if (!fired) {
          fired = true;
          onTimeUpRef.current?.();
        }
        return;
      }
      timer = setTimeout(tick, (remaining % 1000) + 15);
    };

    tick();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionEndsAtMs, clockOffsetMs, isHost]);

  const isUrgent = seconds > 0 && seconds <= URGENT_AT_SECONDS;

  return (
    <>
      <div className={`flex w-full items-center gap-3 ${className}`} role="timer" aria-label={`${seconds} seconds left`}>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-cover-2">
          <div
            ref={barRef}
            className={`timer-fill absolute inset-0 rounded-full transition-colors ${isUrgent ? 'bg-ribbon' : 'bg-gilt'}`}
          />
        </div>
        <span
          className={`w-[3ch] text-right font-semibold tabular-nums ${
            isHost ? 'text-3xl' : 'text-xl'
          } ${isUrgent ? 'text-[#f0a49d]' : 'text-page'}`}
        >
          {seconds}
        </span>
      </div>

      {/* Last 10 seconds: a huge countdown over the screen. pointer-events-none keeps
          every answer tappable through it, and it's translucent so options stay readable. */}
      {showFullScreenLowTimeOverlay && isUrgent && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <span
            key={seconds}
            className="animate-timer-pop font-sans font-extrabold leading-none tabular-nums text-ribbon opacity-45 text-[clamp(12rem,72vw,30rem)] [text-shadow:0_0_40px_rgba(20,23,53,0.6)]"
          >
            {seconds}
          </span>
        </div>
      )}
    </>
  );
};
