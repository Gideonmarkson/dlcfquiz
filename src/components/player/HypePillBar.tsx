'use client';

import React, { useState, useEffect } from 'react';
import { HypeEmoji } from '@/types/quiz';
import { usePlayerStore } from '@/store/usePlayerStore';

const HYPE_EMOJIS: HypeEmoji[] = ['🔥', '🚀', '👏', '💡', '⚡'];
const COOLDOWN_MS = 1500;

export const HypePillBar: React.FC = () => {
  const sendHype = usePlayerStore((s) => s.sendHype);
  const [coolingUntil, setCoolingUntil] = useState(0);
  const isCooling = coolingUntil > 0;

  useEffect(() => {
    if (!coolingUntil) return;
    const t = setTimeout(() => setCoolingUntil(0), Math.max(0, coolingUntil - Date.now()));
    return () => clearTimeout(t);
  }, [coolingUntil]);

  const handleTap = (emoji: HypeEmoji) => {
    if (isCooling) return;
    if (sendHype(emoji)) setCoolingUntil(Date.now() + COOLDOWN_MS);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-ink/95 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
        <span className="text-xs text-faint">Cheer on screen</span>
        <div className="flex gap-1">
          {HYPE_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={isCooling}
              onClick={() => handleTap(emoji)}
              aria-label={`Send ${emoji}`}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-2xl transition-[opacity,transform] active:scale-125 disabled:opacity-30"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
