'use client';

import React, { useMemo } from 'react';
import { Crown, Medal } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { LeaderboardEntryDTO } from '@/types/quiz';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';
import { ui } from '@/lib/ui';

type Place = 1 | 2 | 3;

/** Metal finish, height and entrance timing for each step of the stage. */
const STEP: Record<
  Place,
  { height: string; delay: number; metal: string; lip: string; ink: string; ring: string; label: string }
> = {
  1: {
    height: 'h-[34vh] min-h-56',
    delay: 1.1,
    metal: 'linear-gradient(180deg,#f6e3a1 0%,#d9b65f 38%,#b08a35 100%)',
    lip: '#fbedbd',
    ink: '#5a4413',
    ring: '#e9c977',
    label: '1st',
  },
  2: {
    height: 'h-[24vh] min-h-40',
    delay: 0.6,
    metal: 'linear-gradient(180deg,#f1f3f8 0%,#bfc3d2 40%,#8b90a6 100%)',
    lip: '#ffffff',
    ink: '#3f4458',
    ring: '#d6d9e4',
    label: '2nd',
  },
  3: {
    height: 'h-[17vh] min-h-32',
    delay: 0.2,
    metal: 'linear-gradient(180deg,#efc29b 0%,#bf8051 42%,#8a5330 100%)',
    lip: '#f7d5b8',
    ink: '#4e2a14',
    ring: '#d9a17a',
    label: '3rd',
  },
};

const CONFETTI_COLOURS = ['#d9b65f', '#c8463d', '#3f9474', '#6f87e3', '#f1ecdf'];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

const PodiumStep: React.FC<{ entry?: LeaderboardEntryDTO; place: Place }> = ({ entry, place }) => {
  const s = STEP[place];
  if (!entry) return <div />;

  return (
    <div className="relative flex flex-col items-center">
      {/* Winner card above the step */}
      <div
        className="podium-pop mb-4 flex flex-col items-center text-center"
        style={{ animationDelay: `${s.delay + 0.5}s` }}
      >
        <div className="relative">
          {place === 1 ? (
            <Crown
              className="crown-drop absolute inset-x-0 -top-12 mx-auto h-12 w-12 text-gilt"
              style={{ animationDelay: `${s.delay + 0.9}s` }}
              fill="currentColor"
              strokeWidth={1.25}
            />
          ) : (
            <Medal className="absolute inset-x-0 -top-9 mx-auto h-8 w-8" style={{ color: s.ring }} />
          )}
          <div
            className={`flex items-center justify-center rounded-full bg-cover font-extrabold text-page ${
              place === 1 ? 'h-24 w-24 text-3xl' : 'h-18 w-18 text-2xl'
            }`}
            style={{ boxShadow: `0 0 0 4px ${s.ring}, 0 0 0 9px rgba(20,23,53,0.9), 0 0 32px 6px ${s.ring}55` }}
          >
            {initials(entry.nickname)}
          </div>
        </div>
        <p className={`mt-4 font-extrabold leading-tight ${place === 1 ? 'text-4xl' : 'text-2xl'}`}>{entry.nickname}</p>
        <p className="mt-1 text-muted">
          {levelLabel(entry.academicLevel)} ·{' '}
          <span className="font-semibold tabular-nums text-page">{entry.totalScore.toLocaleString()}</span> pts
        </p>
      </div>

      {/* The step itself */}
      <div
        className={`animate-podium-rise relative w-full overflow-hidden rounded-t-[14px] ${s.height}`}
        style={{ background: s.metal, animationDelay: `${s.delay}s`, boxShadow: 'inset 0 -24px 40px rgba(0,0,0,0.25)' }}
      >
        <div className="absolute inset-x-0 top-0 h-3" style={{ background: s.lip, opacity: 0.85 }} />
        <div className="absolute inset-y-0 left-0 w-1/3 bg-white/10 [mask-image:linear-gradient(90deg,black,transparent)]" />
        <span
          className={`absolute inset-x-0 top-6 text-center font-display leading-none ${place === 1 ? 'text-9xl' : 'text-8xl'}`}
          style={{ color: s.ink, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }}
        >
          {place}
        </span>
        <span
          className="absolute inset-x-0 bottom-4 text-center text-sm font-bold tracking-wide"
          style={{ color: s.ink, opacity: 0.75 }}
        >
          {s.label} place
        </span>
      </div>
    </div>
  );
};

export const HostPodiumView: React.FC = () => {
  const pin = useHostStore((s) => s.pin);
  const podium = useHostStore((s) => s.podium);
  const top5 = useHostStore((s) => s.top5);
  const players = useHostStore((s) => s.players);

  const top = podium.length > 0 ? podium : top5;

  // Everyone from 4th down. The full player list comes from the host snapshot, already sorted
  // by score and speed on the server; sort again defensively in case a late join was appended.
  const others = useMemo(() => {
    const ranked = players
      .filter((p) => !p.isKicked)
      .map((p, i) => ({ ...p, order: i }))
      .sort((a, b) => b.totalScore - a.totalScore || a.order - b.order);
    const topIds = new Set(top.slice(0, 3).map((t) => t.playerId));
    const rest = ranked.filter((p) => !topIds.has(p.id));
    return rest.length > 0 || top.length <= 3
      ? rest.map((p, i) => ({ ...p, rank: i + 4 }))
      : top.slice(3).map((t) => ({
          id: t.playerId,
          nickname: t.nickname,
          academicLevel: t.academicLevel,
          totalScore: t.totalScore,
          correctCount: t.correctCount,
          rank: t.rank,
        }));
  }, [players, top]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: 1.6 + ((i * 13) % 20) / 10,
        duration: 3.2 + ((i * 7) % 18) / 10,
        colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
        size: 6 + (i % 4) * 2,
        drift: ((i % 7) - 3) * 18,
      })),
    []
  );

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-14">
      {/* Confetti burst once the winner is on the stage */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="confetti-piece absolute -top-6 rounded-[2px]"
            style={
              {
                left: `${c.left}%`,
                width: c.size,
                height: c.size * 1.6,
                background: c.colour,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
                '--drift': `${c.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="text-center">
        <h1 className="font-display text-6xl leading-none md:text-7xl">Final results</h1>
        <p className="mt-3 text-xl text-muted">Well done, everyone who took part.</p>
      </div>

      {/* The stage */}
      <div className="relative pt-16">
        <div className="relative grid grid-cols-3 items-end gap-3 md:gap-5">
          <PodiumStep entry={top[1]} place={2} />
          <PodiumStep entry={top[0]} place={1} />
          <PodiumStep entry={top[2]} place={3} />
        </div>

        {/* Stage floor */}
        <div className="relative h-5 rounded-b-md bg-cover-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gilt/50" />
        </div>
      </div>

      {others.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl">
            <span className="font-semibold">Everyone else</span>{' '}
            <span className="text-muted tabular-nums">({others.length})</span>
          </h2>
          <ol className="grid max-h-[50vh] gap-x-10 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-4 border-b border-rule py-3 text-lg">
                <span className="w-10 font-extrabold tabular-nums text-muted">{p.rank}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.nickname}</span>
                <span className="text-sm text-faint">{levelLabel(p.academicLevel)}</span>
                <span className="w-20 text-right font-semibold tabular-nums">{p.totalScore.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pb-6">
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
