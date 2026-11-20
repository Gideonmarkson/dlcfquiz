'use client';

import React, { useState, useEffect } from 'react';
import { HypeEmoji } from '@/types/quiz';
import { usePlayerStore } from '@/store/usePlayerStore';

const HYPE_EMOJIS: HypeEmoji[] = ['🔥', '🚀', '👏', '💡', '⚡'];

export const HypePillBar: React.FC = () => {
  const sendHype = usePlayerStore((s) => s.sendHype);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);

  const handleTap = (emoji: HypeEmoji) => {
    if (cooldownRemainingMs > 0) return;
    const sent = sendHype(emoji);
    if (sent) {
      setCooldownRemainingMs(1500);
    }
  };

  useEffect(() => {
    if (cooldownRemainingMs <= 0) return;

    const interval = setInterval(() => {
      setCooldownRemainingMs((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(interval);
  }, [cooldownRemainingMs]);

  const isCooling = cooldownRemainingMs > 0;
  const cooldownRatio = cooldownRemainingMs / 1500;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 select-none">
      <div className="relative flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl">
        {/* Subtle cooldown progress underline */}
        {isCooling && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-full transition-all duration-100 ease-linear"
            style={{ width: `${cooldownRatio * 100}%` }}
          />
        )}

        {HYPE_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={isCooling}
            onClick={() => handleTap(emoji)}
            className={`min-w-[44px] min-h-[44px] sm:min-w-[48px] sm:min-h-[48px] rounded-full flex items-center justify-center text-2xl sm:text-3xl transition-transform active:scale-125 ${
              isCooling
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:scale-110 hover:bg-slate-800'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
