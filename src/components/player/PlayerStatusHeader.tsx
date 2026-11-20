'use client';

import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';
import { Trophy, Award, ArrowLeft } from 'lucide-react';

export const PlayerStatusHeader: React.FC = () => {
  const nickname = usePlayerStore((s) => s.nickname);
  const academicLevel = usePlayerStore((s) => s.academicLevel);
  const result = usePlayerStore((s) => s.result);
  const clearSession = usePlayerStore((s) => s.clearSession);

  const score = result?.cumulativeScore ?? 0;
  const rank = result?.currentRank;

  const handleExit = () => {
    if (typeof window !== 'undefined' && confirm('Exit back to join page?')) {
      clearSession();
      window.location.href = '/play';
    }
  };

  return (
    <header className="w-full flex items-center justify-between py-3 px-4 bg-slate-800/80 border-b border-slate-700/80 backdrop-blur sticky top-0 z-30 shadow-md">
      {/* Player Identity */}
      <div className="flex items-center gap-2 overflow-hidden">
        <button
          type="button"
          onClick={handleExit}
          className="text-slate-400 hover:text-slate-200 p-1 -ml-1 rounded-lg hover:bg-slate-700/60 transition flex items-center gap-1 text-xs font-semibold"
          title="Exit Quiz"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <span className="font-bold text-slate-100 text-sm truncate max-w-[120px]">
          {nickname || 'Student'}
        </span>
        <AcademicLevelBadge level={academicLevel} size="sm" />
      </div>

      {/* Live Stats */}
      <div className="flex items-center gap-3">
        {rank !== undefined && rank > 0 && (
          <div className="flex items-center gap-1 text-xs font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
            <Trophy className="w-3.5 h-3.5" />
            <span className="tabular-nums">#{rank}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/60 px-2.5 py-1 rounded-xl">
          <Award className="w-4 h-4 text-amber-400" />
          <span className="font-black text-amber-400 text-sm tabular-nums">
            {score.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-bold">pts</span>
        </div>
      </div>
    </header>
  );
};
