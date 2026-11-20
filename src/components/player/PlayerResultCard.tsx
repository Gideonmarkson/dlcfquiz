'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, BookOpen, Trophy } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

export const PlayerResultCard: React.FC = () => {
  const result = usePlayerStore((s) => s.result);
  const reveal = usePlayerStore((s) => s.reveal);
  const selectedOption = usePlayerStore((s) => s.selectedOption);

  if (!reveal) return null;

  const isAnswered = selectedOption !== null;
  const isCorrect = isAnswered && selectedOption === reveal.correctOptionIndex;
  const points = result?.pointsAwarded ?? (isCorrect ? 500 : 0);
  const score = result?.cumulativeScore;
  const rank = result?.currentRank;
  const totalPlayers = result?.totalPlayers;

  return (
    <div className="flex flex-col gap-4 w-full animate-fadeIn">
      {/* Outcome Banner */}
      <div
        className={`p-6 rounded-3xl border-2 flex flex-col items-center text-center gap-2 shadow-2xl ${
          isCorrect
            ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/30'
            : isAnswered
            ? 'bg-red-950/70 border-red-500 text-red-100 ring-2 ring-red-500/30'
            : 'bg-slate-800/80 border-slate-700 text-slate-300'
        }`}
      >
        {isCorrect ? (
          <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
        ) : isAnswered ? (
          <XCircle className="w-12 h-12 text-red-400" />
        ) : (
          <Clock className="w-12 h-12 text-slate-400" />
        )}

        <div className="flex flex-col">
          <span className="text-2xl md:text-3xl font-black">
            {isCorrect
              ? `Correct! +${points} pts`
              : isAnswered
              ? 'Not Quite! +0 pts'
              : "Time Expired! +0 pts"}
          </span>
          <span className="text-xs md:text-sm text-slate-300 font-medium mt-0.5">
            {isCorrect
              ? 'Excellent knowledge of the Scriptures!'
              : 'Keep your eyes on the fellowship screen to review.'}
          </span>
        </div>
      </div>

      {/* Scripture Verification Card */}
      <div className="bg-slate-800 border-l-4 border-amber-500 rounded-2xl p-5 shadow-xl flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          <span>Scripture Reference</span>
        </div>
        <div className="text-xl md:text-2xl font-black text-amber-300">
          {reveal.scriptureRef}
        </div>
        {reveal.explanation && (
          <p className="text-slate-300 text-xs md:text-sm mt-1 leading-relaxed">
            {reveal.explanation}
          </p>
        )}
      </div>

      {/* Live Rank & Total Score Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Your Live Rank</span>
          </div>
          <span className="text-2xl font-black text-amber-400 tabular-nums">
            {rank ? `#${rank}` : 'Calculating...'}
          </span>
          {totalPlayers ? (
            <span className="text-[10px] text-slate-500">of {totalPlayers} players</span>
          ) : null}
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-md">
          <span className="text-xs text-slate-400 font-semibold uppercase mb-1">
            Total Score
          </span>
          <span className="text-2xl font-black text-amber-300 tabular-nums">
            {score !== undefined ? score.toLocaleString() : '---'}
          </span>
          <span className="text-[10px] text-slate-500 uppercase font-bold">points</span>
        </div>
      </div>
    </div>
  );
};
