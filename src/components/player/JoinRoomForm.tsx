'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, RefreshCw, AlertCircle, Sparkles, BookOpen } from 'lucide-react';
import { AcademicLevel, PlayerSessionStorage } from '@/types/quiz';
import { usePlayerStore } from '@/store/usePlayerStore';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';

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
      setErrorMessage('Room PIN must be a 6-digit number.');
      return;
    }

    if (cleanNick.length < 2 || cleanNick.length > 35) {
      setErrorMessage('Name must be between 2 and 35 characters.');
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
        setErrorMessage(data.error || 'Failed to enter fellowship room.');
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
      setErrorMessage('Connection failed. Please check your mobile network.');
      setIsLoading(false);
    }
  };

  const handleResume = () => {
    if (activeSession) {
      router.push(`/play/${activeSession.pin}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
      {/* Resume Session Banner */}
      {activeSession && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex flex-col">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
              Previous Session Found
            </span>
            <span className="text-sm font-semibold text-slate-100">
              {activeSession.nickname} in Room #{activeSession.pin}
            </span>
          </div>
          <button
            type="button"
            onClick={handleResume}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition"
          >
            Resume
          </button>
        </div>
      )}

      {/* Main Join Card */}
      <form
        onSubmit={handleJoin}
        className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur flex flex-col gap-5"
      >
        <div className="text-center flex flex-col items-center gap-1.5 mb-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-1">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-100">
            Join Fellowship Quiz
          </h2>
          <p className="text-slate-400 text-xs md:text-sm">
            Enter PIN and your name to join without login
          </p>
        </div>

        {/* PIN Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            6-Digit Room PIN
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 482917"
            className="w-full text-center tracking-[0.3em] font-mono text-2xl font-bold py-3 px-4 rounded-2xl bg-slate-900 border border-slate-700 text-amber-400 placeholder-slate-600 focus:outline-none focus:border-amber-400 tabular-nums shadow-inner"
            required
          />
        </div>

        {/* Name Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Student Name
            </label>
            <span className="text-[10px] text-slate-500">{nickname.length}/20</span>
          </div>
          <input
            type="text"
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Samuel Adebayo"
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 font-semibold text-base focus:outline-none focus:border-amber-400 shadow-inner"
            required
          />
        </div>

        {/* Academic Level Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Academic Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ACADEMIC_LEVELS.map((lvl) => {
              const isSelected = academicLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setAcademicLevel(lvl)}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center border ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-400 shadow-md'
                      : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-base shadow-xl transition active:scale-98 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Entering Fellowship Room...</span>
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>Enter Fellowship Arena</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
