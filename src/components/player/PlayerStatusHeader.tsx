'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isAudioEnabled, setAudioEnabled } from '@/lib/audio';
import { usePlayerStore } from '@/store/usePlayerStore';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';

export const PlayerStatusHeader: React.FC = () => {
  const nickname = usePlayerStore((s) => s.nickname);
  const academicLevel = usePlayerStore((s) => s.academicLevel);
  const result = usePlayerStore((s) => s.result);
  const clearSession = usePlayerStore((s) => s.clearSession);
  const [soundOn, setSoundOn] = useState(() => isAudioEnabled());

  const toggleSound = () => {
    setAudioEnabled(!soundOn);
    setSoundOn(!soundOn);
  };

  const score = result?.cumulativeScore ?? 0;
  const rank = result?.currentRank;

  const handleLeave = () => {
    if (confirm('Leave this game? Your score stays, but you’ll need the PIN to get back in.')) {
      clearSession();
      window.location.href = '/play';
    }
  };

  const showRank = Boolean(rank && score > 0);

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-ink/95">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{nickname || 'Player'}</p>
          <p className="text-xs text-muted">{levelLabel(academicLevel)}</p>
        </div>

        <div className="flex items-center gap-4">
          {showRank && (
            <p className="text-right leading-tight">
              <span className={`block text-2xl font-extrabold tabular-nums ${rank === 1 ? 'text-gilt' : 'text-page'}`}>
                {ordinal(rank as number)}
              </span>
              <span className="block text-xs text-muted">place</span>
            </p>
          )}
          <p className="text-right leading-tight">
            <span className="block text-2xl font-extrabold tabular-nums text-gilt">{score.toLocaleString()}</span>
            <span className="block text-xs text-muted">points</span>
          </p>
          <button
            type="button"
            onClick={toggleSound}
            className="-mx-1 p-1 text-faint transition-colors hover:text-page"
            aria-label={soundOn ? 'Mute sounds' : 'Turn sounds on'}
          >
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button type="button" onClick={handleLeave} className="text-sm text-faint hover:text-page transition-colors">
            Leave
          </button>
        </div>
      </div>
    </header>
  );
};

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
