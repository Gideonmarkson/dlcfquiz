'use client';

import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';

export const PlayerStatusHeader: React.FC = () => {
  const nickname = usePlayerStore((s) => s.nickname);
  const academicLevel = usePlayerStore((s) => s.academicLevel);
  const result = usePlayerStore((s) => s.result);
  const clearSession = usePlayerStore((s) => s.clearSession);

  const score = result?.cumulativeScore ?? 0;
  const rank = result?.currentRank;

  const handleLeave = () => {
    if (confirm('Leave this game? Your score stays, but you’ll need the PIN to get back in.')) {
      clearSession();
      window.location.href = '/play';
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-ink/95">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{nickname || 'Player'}</p>
          <p className="text-xs text-muted">
            {levelLabel(academicLevel)}
            {rank && score > 0 ? <span className="tabular-nums"> · {ordinal(rank)} place</span> : null}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-right leading-tight">
            <span className="block text-xl font-semibold tabular-nums text-gilt">{score.toLocaleString()}</span>
            <span className="block text-xs text-muted">points</span>
          </p>
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
