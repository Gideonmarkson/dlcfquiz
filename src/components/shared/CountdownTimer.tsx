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
          className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Uniform Red Fill & Texture Across the Entire Viewport (No corner borders) */}
          <div className="absolute inset-0 bg-red-600/95 backdrop-blur-sm pointer-events-none transition-opacity duration-200" />

          {/* Top Emergency Low Time Badge */}
          <div className="relative z-10 px-5 py-2 sm:px-7 sm:py-2.5 rounded-full bg-red-800/95 text-white font-black text-xs sm:text-base md:text-lg uppercase tracking-widest shadow-2xl flex items-center gap-2.5 animate-bounce mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 animate-pulse shrink-0" />
            <span>
              {isHost
                ? `FINAL ${remainingSeconds} SECONDS!`
                : `HURRY! ONLY ${remainingSeconds}S REMAINING!`}
            </span>
          </div>

          {/* Ultra-Thick High-Contrast Countdown Number */}
          <div
            key={remainingSeconds}
            className="relative z-10 flex flex-col items-center justify-center select-none animate-timer-pop"
          >
            <span
              className="font-black text-[42vw] md:text-[36vw] xl:text-[30vw] leading-none text-white tabular-nums tracking-tighter drop-shadow-[0_16px_50px_rgba(0,0,0,0.7)]"
              style={{
                WebkitTextStroke: '4px rgba(153, 27, 27, 0.8)',
                paintOrder: 'stroke fill',
              }}
            >
              {remainingSeconds}
            </span>
            <span className="text-sm sm:text-xl md:text-2xl font-black uppercase tracking-[0.35em] text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] -mt-4 sm:-mt-8 md:-mt-12">
              Seconds Remaining
            </span>
          </div>
        </div>
      )}
    </>
  );
};
