'use client';

import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { ui } from '@/lib/ui';
import { ordinal } from '@/components/player/PlayerStatusHeader';

export const PlayerGameOverCard: React.FC = () => {
  const nickname = usePlayerStore((s) => s.nickname);
  const result = usePlayerStore((s) => s.result);
  const clearSession = usePlayerStore((s) => s.clearSession);

  const finalScore = result?.cumulativeScore ?? 0;
  const finalRank = result?.currentRank;
  const totalPlayers = result?.totalPlayers;

  const leave = (href: string) => {
    clearSession();
    window.location.href = href;
  };

  return (
    <section className="flex flex-col gap-10 animate-enter">
      <div>
        <p className="text-sm text-muted">That’s the last question, {nickname}</p>
        {finalRank ? (
          <h1 className="mt-2 font-display text-6xl leading-none">
            {ordinal(finalRank)}
            <span className="block mt-2 font-sans text-xl text-muted tabular-nums">
              {totalPlayers ? `out of ${totalPlayers} players` : 'place'}
            </span>
          </h1>
        ) : (
          <h1 className="mt-2 font-display text-5xl leading-none">Quiz finished</h1>
        )}
        <p className="mt-6 text-3xl font-semibold tabular-nums text-gilt">
          {finalScore.toLocaleString()} <span className="text-lg font-normal text-muted">points</span>
        </p>
      </div>

      <blockquote className="border-t border-rule pt-5">
        <p className="font-display text-xl leading-snug">
          Thy word have I hid in mine heart, that I might not sin against thee.
        </p>
        <cite className="mt-2 block text-sm not-italic text-gilt">Psalm 119:11</cite>
      </blockquote>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => leave('/play')} className={ui.btnPrimary}>
          Join another game
        </button>
        <button type="button" onClick={() => leave('/')} className={ui.btnSecondary}>
          Done
        </button>
      </div>
    </section>
  );
};
