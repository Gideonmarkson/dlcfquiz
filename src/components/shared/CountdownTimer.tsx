'use client';

import React, { useEffect, useState, useRef } from 'react';
import { playCountdownTick, playUrgentTick } from '@/lib/audio';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  totalSeconds: number;
  questionEndsAtMs: number;
  clockOffsetMs?: number;
  isHost?: boolean;
  onTimeUp?: () => void;
  className?: string;
  showFullScreenLowTimeOverlay?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  totalSeconds,
  questionEndsAtMs,
  clockOffsetMs = 0,
  isHost = false,
  onTimeUp,
  className = '',
  showFullScreenLowTimeOverlay = true,
}) => {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    const now = Date.now() + clockOffsetMs;
    return Math.max(0, questionEndsAtMs - now);
  });

  const lastTickSecRef = useRef<number>(-1);
  const totalMs = totalSeconds * 1000;

  useEffect(() => {
    let animFrame: number;
    let firedTimeUp = false;

    const tick = () => {
      const now = Date.now() + clockOffsetMs;
      const rem = Math.max(0, questionEndsAtMs - now);
      setRemainingMs(rem);

      const currentSec = Math.ceil(rem / 1000);
      if (isHost && currentSec !== lastTickSecRef.current && currentSec > 0) {
        lastTickSecRef.current = currentSec;
        if (currentSec <= 10) {
          playUrgentTick();
        } else {
          playCountdownTick();
        }
      }

      if (rem <= 0) {
        if (!firedTimeUp && onTimeUp) {
          firedTimeUp = true;
          onTimeUp();
        }
      } else {
        animFrame = requestAnimationFrame(tick);
      }
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [questionEndsAtMs, clockOffsetMs, totalSeconds, isHost, onTimeUp]);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progressRatio = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const isUrgent = remainingSeconds <= 10;
  const isLowTimeState = remainingSeconds <= 10 && remainingSeconds > 0;

  return (
    <>
      {/* Standard Inline Timer Bar */}
      <div className={`flex flex-col items-center gap-1.5 w-full ${className}`}>
        <div className="flex items-center justify-between w-full px-1">
          <span
            className={`text-xs uppercase tracking-wider font-semibold transition-colors duration-200 ${
              isUrgent ? 'text-red-400 font-bold flex items-center gap-1' : 'text-slate-400'
            }`}
          >
            {isUrgent ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Low Time Alert</span>
              </>
            ) : (
              'Time Remaining'
            )}
          </span>
          <span
            className={`tabular-nums font-mono font-bold transition-all duration-200 ${
              isUrgent
                ? 'text-red-400 text-xl md:text-2xl animate-pulse font-black'
                : 'text-amber-400 text-lg md:text-xl'
            }`}
          >
            {remainingSeconds}s
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 shadow-inner">
          <div
            className={`h-full transition-all duration-100 ease-linear rounded-full ${
              isUrgent
                ? 'bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.8)]'
                : 'bg-gradient-to-r from-amber-500 to-yellow-400'
            }`}
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>
      </div>

      {/* Dramatic Low Time Ambient Edge Ring (<= 10s) - NEVER blocks any option or text */}
      {showFullScreenLowTimeOverlay && isLowTimeState && (
        <div
          aria-live="assertive"
          className="fixed inset-0 z-10 pointer-events-none overflow-hidden"
        >
          {/* Subtle Red Edge Ring only: all options A, B, C, D remain 100% visible and unblocked */}
          <div className="absolute inset-0 pointer-events-none ring-4 ring-inset ring-red-500/30 transition-opacity duration-300" />
        </div>
      )}
    </>
  );
};
