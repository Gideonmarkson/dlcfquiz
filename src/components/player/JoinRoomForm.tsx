'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AcademicLevel, PlayerSessionStorage } from '@/types/quiz';
import { usePlayerStore } from '@/store/usePlayerStore';
import { ui } from '@/lib/ui';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';

const ACADEMIC_LEVELS: AcademicLevel[] = ['100L', '200L', '300L', '400L', '500L', 'PG/STAFF'];

export const JoinRoomForm: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initSessionFromStorage = usePlayerStore((s) => s.initSessionFromStorage);
  const saveSessionToStorage = usePlayerStore((s) => s.saveSessionToStorage);

  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [academicLevel, setAcademicLevel] = useState<AcademicLevel>('100L');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<PlayerSessionStorage | null>(null);

  useEffect(() => {
    const existing = initSessionFromStorage();
    if (existing) {
      setActiveSession(existing);
      setPin(existing.pin);
      setNickname(existing.nickname);
      setAcademicLevel(existing.academicLevel);
    }

    const pinParam = searchParams.get('pin');
    if (pinParam && /^[0-9]{6}$/.test(pinParam)) {
      setPin(pinParam);
    }
  }, [searchParams, initSessionFromStorage]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanPin = pin.trim().replace(/[^0-9]/g, '');
    const cleanNick = nickname.trim();

    if (!/^[0-9]{6}$/.test(cleanPin)) {
      setErrorMessage('The PIN is the 6-digit number on the hall screen.');
      return;
    }

    if (cleanNick.length < 2 || cleanNick.length > 20) {
      setErrorMessage('Enter a name between 2 and 20 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/play/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: cleanPin,
          name: cleanNick,
          nickname: cleanNick,
          academicLevel,
          existingToken: activeSession?.playerToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Couldn’t join that game. Check the PIN and try again.');
        setIsLoading(false);
        return;
      }

      saveSessionToStorage({
        pin: cleanPin,
        playerId: data.playerId,
        playerToken: data.playerToken,
        nickname: data.nickname,
        academicLevel: data.academicLevel,
      });

      router.push(`/play/${cleanPin}`);
    } catch {
      setErrorMessage('No connection. Check your mobile data and try again.');
      setIsLoading(false);
    }
  };

  const handleResume = () => {
    if (activeSession) {
      router.push(`/play/${activeSession.pin}`);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-enter">
      {activeSession && (
        <div className="flex items-center justify-between gap-4 border-l-2 border-gilt pl-4">
          <p className="text-sm text-muted">
            You were playing as <span className="text-page">{activeSession.nickname}</span> in game{' '}
            <span className="tabular-nums text-page">{activeSession.pin}</span>.
          </p>
          <button type="button" onClick={handleResume} className={`${ui.btnSecondary} shrink-0 px-4 py-2 text-sm`}>
            Rejoin
          </button>
        </div>
      )}

      <div>
        <h1 className="font-display text-4xl leading-tight">Join the quiz</h1>
        <p className="mt-2 text-muted">Your name shows on the hall screen when you score.</p>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="join-pin" className={ui.label}>
            Game PIN
          </label>
          <input
            id="join-pin"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 digits"
            className={`${ui.input} text-2xl font-semibold tracking-[0.25em] tabular-nums placeholder:text-lg placeholder:font-normal placeholder:tracking-normal`}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="join-name" className={ui.label}>
              Your name
            </label>
            <span className="text-xs tabular-nums text-faint">{nickname.length}/20</span>
          </div>
          <input
            id="join-name"
            type="text"
            maxLength={20}
            autoComplete="name"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Samuel Adebayo"
            className={ui.input}
            required
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={`${ui.label} mb-2`}>Level</legend>
          <div className="grid grid-cols-3 gap-2">
            {ACADEMIC_LEVELS.map((lvl) => {
              const isSelected = academicLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setAcademicLevel(lvl)}
                  className={`rounded-[var(--radius-control)] border py-2.5 text-sm font-medium tabular-nums transition-colors ${
                    isSelected
                      ? 'border-gilt bg-gilt text-ink'
                      : 'border-rule text-muted hover:border-faint hover:text-page'
                  }`}
                >
                  {levelLabel(lvl)}
                </button>
              );
            })}
          </div>
        </fieldset>

        {errorMessage && (
          <p role="alert" className="border-l-2 border-ribbon pl-3 text-sm text-[#f0a49d]">
            {errorMessage}
          </p>
        )}

        <button type="submit" disabled={isLoading} className={`${ui.btnPrimary} mt-2 py-3.5 text-lg`}>
          {isLoading ? 'Joining…' : 'Join quiz'}
        </button>
      </form>
    </div>
  );
};
