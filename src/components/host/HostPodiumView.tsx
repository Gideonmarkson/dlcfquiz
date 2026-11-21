'use client';

import React from 'react';
import { useHostStore } from '@/store/useHostStore';
import { LeaderboardEntryDTO } from '@/types/quiz';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';
import { ui } from '@/lib/ui';

const COLUMN = {
  1: { height: 'h-64', delay: '0.5s', tone: 'bg-gilt text-ink', name: 'text-4xl' },
  2: { height: 'h-44', delay: '0.25s', tone: 'bg-cover-2 text-page', name: 'text-2xl' },
  3: { height: 'h-32', delay: '0s', tone: 'bg-cover text-page', name: 'text-2xl' },
} as const;

const PodiumColumn: React.FC<{ entry?: LeaderboardEntryDTO; place: 1 | 2 | 3 }> = ({ entry, place }) => {
  if (!entry) return <div />;
  const c = COLUMN[place];
  return (
    <div className="flex flex-col items-center gap-4 animate-podium-rise" style={{ animationDelay: c.delay }}>
      <div className="text-center">
        <p className={`font-semibold leading-tight ${c.name}`}>{entry.nickname}</p>
        <p className="mt-1 text-muted">
          {levelLabel(entry.academicLevel)} · <span className="tabular-nums">{entry.totalScore.toLocaleString()}</span>
        </p>
      </div>
      <div className={`flex w-full items-start justify-center rounded-t-[var(--radius-tile)] pt-4 ${c.height} ${c.tone}`}>
        <span className="font-display text-6xl">{place}</span>
      </div>
    </div>
  );
};

export const HostPodiumView: React.FC = () => {
  const pin = useHostStore((s) => s.pin);
  const podium = useHostStore((s) => s.podium);
  const top5 = useHostStore((s) => s.top5);

  const standings = podium.length > 0 ? podium : top5;
  const runnersUp = standings.slice(3, 10);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
      <div className="text-center">
        <h1 className="font-display text-6xl leading-none">Final results</h1>
        <p className="mt-3 text-xl text-muted">Well done, everyone who took part.</p>
      </div>

      <div className="grid grid-cols-3 items-end gap-4 border-b border-rule">
        <PodiumColumn entry={standings[1]} place={2} />
        <PodiumColumn entry={standings[0]} place={1} />
        <PodiumColumn entry={standings[2]} place={3} />
      </div>

      {runnersUp.length > 0 && (
        <ol className="grid gap-x-10 md:grid-cols-2" start={4}>
          {runnersUp.map((r, i) => (
            <li key={r.playerId} className="flex items-center gap-4 border-b border-rule py-3 text-lg">
              <span className="w-6 tabular-nums text-faint">{i + 4}</span>
              <span className="flex-1 truncate">{r.nickname}</span>
              <span className="text-sm text-faint">{levelLabel(r.academicLevel)}</span>
              <span className="w-20 text-right tabular-nums text-muted">{r.totalScore.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href={`/api/host/rooms/${pin}/export`} className={ui.btnSecondary}>
          Download results (CSV)
        </a>
        <a href="/host" className={ui.btnPrimary}>
          Set up another game
        </a>
      </div>
    </div>
  );
};
