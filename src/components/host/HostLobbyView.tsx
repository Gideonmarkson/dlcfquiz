'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';
import { ui } from '@/lib/ui';
import { getJoinUrl, JoinQr } from '@/components/host/JoinCode';

interface HostLobbyViewProps {
  onStartQuiz: () => void;
  isStarting: boolean;
}

export const HostLobbyView: React.FC<HostLobbyViewProps> = ({ onStartQuiz, isStarting }) => {
  const pin = useHostStore((s) => s.pin);
  const allPlayers = useHostStore((s) => s.players);
  const questions = useHostStore((s) => s.questions);
  const [copied, setCopied] = useState(false);

  const players = allPlayers.filter((p) => !p.isKicked);

  const { joinUrl, displayHost } = getJoinUrl(pin);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKickPlayer = async (playerId: string) => {
    try {
      const secret = localStorage.getItem(`dlcf_host_secret_${pin}`);
      await fetch(`/api/host/rooms/${pin}/players/${playerId}`, {
        method: 'DELETE',
        headers: secret ? { 'x-host-secret': secret } : {},
      });
    } catch (e) {
      console.error('Failed to remove player', e);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 md:grid-cols-[1fr_auto] md:items-center">
      <section>
        <p className="text-xl text-muted">
          Go to <span className="text-page">{displayHost}</span> or scan the code, then enter
        </p>
        <p
          className="mt-2 font-display leading-none tracking-[0.06em] tabular-nums text-gilt text-[clamp(5rem,16vw,13rem)]"
          aria-label={`Game PIN ${pin.split('').join(' ')}`}
        >
          {pin}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={players.length === 0 || isStarting}
            onClick={onStartQuiz}
            className={`${ui.btnPrimary} px-7 py-4 text-xl`}
          >
            {isStarting ? 'Starting…' : 'Start the quiz'}
          </button>
          <span className="text-muted">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'} ready
          </span>
          <button type="button" onClick={handleCopyUrl} className={`${ui.btnQuiet} ml-auto`}>
            {copied ? 'Link copied' : 'Copy join link'}
          </button>
        </div>
      </section>

      {/* Always visible: on smaller laptops/projectors it sits beside or under the PIN */}
      <JoinQr pin={pin} className="w-[min(18rem,70vw)] justify-self-start md:w-[min(20rem,30vw)] md:justify-self-end" />

      <section className="md:col-span-2 border-t border-rule pt-6">
        <h2 className="text-xl">
          <span className="font-semibold tabular-nums">{players.length}</span>{' '}
          <span className="text-muted">{players.length === 1 ? 'player has joined' : 'players have joined'}</span>
        </h2>

        {players.length === 0 ? (
          <p className="mt-4 text-lg text-faint">Names appear here as people join.</p>
        ) : (
          <ul className="mt-5 flex max-h-[40vh] flex-wrap gap-x-2 gap-y-2 overflow-y-auto">
            {players.map((p) => (
              <li
                key={p.id}
                className="group inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-cover py-1.5 pl-3 pr-1.5 text-lg"
              >
                <span>{p.nickname}</span>
                <span className="text-sm text-faint">{levelLabel(p.academicLevel)}</span>
                <button
                  type="button"
                  onClick={() => handleKickPlayer(p.id)}
                  className="rounded p-1 text-faint opacity-0 transition-opacity hover:text-[#f0a49d] focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label={`Remove ${p.nickname}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
