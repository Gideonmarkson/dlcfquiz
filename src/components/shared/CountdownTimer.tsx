'use client';

import React, { useEffect, useState, useRef } from 'react';
import { playCountdownTick, playUrgentTick } from '@/lib/audio';
import { AlertTriangle, Clock } from 'lucide-react';

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

      {/* Dramatic Full-Screen Low Time State Overlay (<= 10s) */}
      {showFullScreenLowTimeOverlay && isLowTimeState && (
        <div
          aria-live="assertive"
          className="fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Transparent Red Tint: options and buttons remain 100% visible and selectable */}
          <div className="absolute inset-0 bg-red-600/15 pointer-events-none transition-opacity duration-300 ring-4 ring-inset ring-red-500/30" />

          {/* Top Emergency Low Time Badge */}
          <div className="relative z-10 px-5 py-1.5 sm:px-7 sm:py-2 rounded-full bg-red-600/85 border border-red-400/50 text-white font-black text-xs sm:text-base md:text-lg uppercase tracking-widest shadow-xl flex items-center gap-2.5 animate-bounce mb-3">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 animate-pulse shrink-0" />
            <span>
              {isHost
                ? `FINAL ${remainingSeconds} SECONDS!`
                : `HURRY! ${remainingSeconds}S REMAINING!`}
            </span>
          </div>

          {/* Semi-Transparent Background Watermark Number (Never blocks options) */}
          <div
            key={remainingSeconds}
            className="relative z-0 flex flex-col items-center justify-center select-none animate-timer-pop opacity-25"
          >
            <span
              className="font-black text-[38vw] md:text-[30vw] xl:text-[24vw] leading-none text-red-400 tabular-nums tracking-tighter"
            >
              {remainingSeconds}
            </span>
            <span className="text-xs sm:text-lg md:text-xl font-black uppercase tracking-[0.35em] text-red-300/80 -mt-3 sm:-mt-6 md:-mt-8">
              Seconds Remaining
            </span>
          </div>
        </div>
      )}
    </>
  );
};
