'use client';

import React from 'react';
import { Trophy, ArrowRight, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';

interface HostLeaderboardViewProps {
  onNextQuestion: () => void;
  isLastQuestion: boolean;
}

export const HostLeaderboardView: React.FC<HostLeaderboardViewProps> = ({
  onNextQuestion,
  isLastQuestion,
}) => {
  const top5 = useHostStore((s) => s.top5);
  const currentQuestionIndex = useHostStore((s) => s.currentQuestionIndex);
  const questions = useHostStore((s) => s.questions);

  const RANK_BADGES: Record<number, { bg: string; text: string; label: string }> = {
    1: { bg: 'bg-amber-500 text-slate-950 shadow-amber-500/40', text: 'text-amber-400', label: '1st' },
    2: { bg: 'bg-slate-300 text-slate-950 shadow-slate-300/40', text: 'text-slate-300', label: '2nd' },
    3: { bg: 'bg-amber-700 text-slate-100 shadow-amber-700/40', text: 'text-amber-600', label: '3rd' },
    4: { bg: 'bg-slate-700 text-slate-200 shadow-slate-700/40', text: 'text-slate-400', label: '4th' },
    5: { bg: 'bg-slate-700 text-slate-200 shadow-slate-700/40', text: 'text-slate-400', label: '5th' },
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-100">
              Live Fellowship Leaderboard
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              Standings after Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNextQuestion}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm md:text-base rounded-xl shadow-lg transition active:scale-95"
        >
          <span>{isLastQuestion ? 'Championship Podium' : 'Next Question'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Top 5 Rows */}
      <div className="flex flex-col gap-3">
        {top5.map((entry, index) => {
          const rank = entry.rank || index + 1;
          const badge = RANK_BADGES[rank] || RANK_BADGES[5];

          return (
            <div
              key={entry.playerId}
              className={`flex items-center justify-between p-4 md:p-5 rounded-2xl bg-slate-800/90 border transition-all duration-300 shadow-lg ${
                rank === 1
                  ? 'border-amber-500/80 bg-gradient-to-r from-slate-800 to-amber-950/30 ring-1 ring-amber-500/50'
                  : 'border-slate-700/70'
              }`}
            >
              {/* Rank Badge & Nickname */}
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-base shadow-md ${badge.bg}`}
                >
                  {badge.label}
                </div>

                <div className="flex flex-col">
                  <span className="font-extrabold text-slate-100 text-base md:text-xl">
                    {entry.nickname}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <AcademicLevelBadge level={entry.academicLevel} size="sm" />
                    <span className="text-xs text-slate-400">
                      {entry.correctCount} correct
                    </span>
                  </div>
                </div>
              </div>

              {/* Score & Rank Delta */}
              <div className="flex items-center gap-4">
                {entry.rankDelta !== undefined && (
                  <div className="hidden sm:flex items-center gap-0.5 text-xs font-bold">
                    {entry.rankDelta > 0 ? (
                      <span className="text-emerald-400 flex items-center">
                        <ArrowUp className="w-3.5 h-3.5" /> +{entry.rankDelta}
                      </span>
                    ) : entry.rankDelta < 0 ? (
                      <span className="text-red-400 flex items-center">
                        <ArrowDown className="w-3.5 h-3.5" /> {entry.rankDelta}
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center">
                        <Minus className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                )}

                <div className="text-right">
                  <div className="text-xl md:text-2xl font-black text-amber-400 tabular-nums">
                    {entry.totalScore.toLocaleString()}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    points
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
