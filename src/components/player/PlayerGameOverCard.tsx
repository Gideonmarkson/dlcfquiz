'use client';

import React from 'react';
import { Crown, Trophy, Award, RotateCcw, ArrowLeft, Home } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';
import Link from 'next/link';

export const PlayerGameOverCard: React.FC = () => {
  const nickname = usePlayerStore((s) => s.nickname);
  const academicLevel = usePlayerStore((s) => s.academicLevel);
  const result = usePlayerStore((s) => s.result);
  const clearSession = usePlayerStore((s) => s.clearSession);

  const finalScore = result?.cumulativeScore ?? 0;
  const finalRank = result?.currentRank;
  const totalPlayers = result?.totalPlayers;

  const isPodium = finalRank !== undefined && finalRank <= 3;

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto text-center py-4">
      {/* Hero Badge */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur flex flex-col items-center gap-3">
        {isPodium ? (
          <Crown className="w-14 h-14 text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-bounce" />
        ) : (
          <Trophy className="w-12 h-12 text-slate-400" />
        )}

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
            Fellowship Quiz Completed
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-100">
            Well Done, {nickname}!
          </h2>
          <AcademicLevelBadge level={academicLevel} size="md" className="mt-1" />
        </div>

        {/* Final Rank Pill */}
        <div className="my-2 px-6 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <span className="font-extrabold text-lg md:text-xl">
            {finalRank ? `Final Rank #${finalRank}` : 'Completed'}
          </span>
          {totalPlayers ? (
            <span className="text-xs text-slate-400">of {totalPlayers}</span>
          ) : null}
        </div>

        {/* Final Score */}
        <div className="flex flex-col items-center">
          <span className="text-4xl md:text-5xl font-black text-amber-400 tabular-nums">
            {finalScore.toLocaleString()}
          </span>
          <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mt-0.5">
            Total Points
          </span>
        </div>
      </div>

      {/* Scriptural encouragement */}
      <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs md:text-sm italic leading-relaxed">
        &ldquo;Thy word have I hid in mine heart, that I might not sin against thee.&rdquo;
        <span className="block mt-1 font-bold not-italic text-amber-400">
          — Psalm 119:11
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
        <button
          type="button"
          onClick={() => {
            clearSession();
            window.location.href = '/play';
          }}
          className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm md:text-base shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Join Another Quiz</span>
        </button>

        <button
          type="button"
          onClick={() => {
            clearSession();
            window.location.href = '/';
          }}
          className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-extrabold text-sm md:text-base shadow transition active:scale-95 flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      </div>
    </div>
  );
};
