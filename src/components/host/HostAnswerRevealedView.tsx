'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Trophy,
  ArrowRight,
  BarChart3,
  Users,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';

interface HostAnswerRevealedViewProps {
  onShowLeaderboard: () => void;
  isLastQuestion: boolean;
}

export const HostAnswerRevealedView: React.FC<HostAnswerRevealedViewProps> = ({
  onShowLeaderboard,
  isLastQuestion,
}) => {
  const currentQuestionIndex = useHostStore((s) => s.currentQuestionIndex);
  const questions = useHostStore((s) => s.questions);
  const reveal = useHostStore((s) => s.reveal);

  const [showRoster, setShowRoster] = useState<boolean>(true);

  const currentQ = questions[currentQuestionIndex];
  if (!currentQ || !reveal) return null;

  const correctIndex = reveal.correctOptionIndex;
  const counts = reveal.optionCounts || [0, 0, 0, 0];
  const totalAnswered = reveal.totalAnswered || 0;
  const maxCount = Math.max(...counts, 1);
  const optionPlayerNames = reveal.optionPlayerNames || [[], [], [], []];

  const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
  const OPTION_THEME_COLORS = [
    { badge: 'bg-blue-600 text-white', border: 'border-blue-500' },
    { badge: 'bg-amber-600 text-white', border: 'border-amber-500' },
    { badge: 'bg-teal-600 text-white', border: 'border-teal-500' },
    { badge: 'bg-violet-600 text-white', border: 'border-violet-500' },
  ];

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto py-2">
      {/* 1. Scripture Verification Hero Card */}
      <div className="bg-slate-800 border-l-8 border-amber-500 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-2">
        <div className="flex items-center gap-2 text-amber-400 font-extrabold uppercase tracking-widest text-xs md:text-sm">
          <BookOpen className="w-5 h-5" />
          <span>Scripture Verification</span>
        </div>
        <div className="text-3xl md:text-5xl font-black text-amber-400">
          {reveal.scriptureRef}
        </div>
        {reveal.explanation && (
          <p className="text-slate-300 text-sm md:text-lg mt-1 font-medium leading-relaxed">
            {reveal.explanation}
          </p>
        )}
      </div>

      {/* 2. Response Distribution Bar Chart */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur flex flex-col gap-6">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-100 flex items-center gap-2">
                <span>Response Distribution</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold">
                  {totalAnswered} Total {totalAnswered === 1 ? 'Response' : 'Responses'}
                </span>
              </h3>
              <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                Bar height reflects student choices • Correct answer highlighted in green
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRoster((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-700/70 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-600"
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>{showRoster ? 'Hide Student Names' : 'Show Student Names'}</span>
            {showRoster ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 4 Vertical Histogram Bars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-2">
          {currentQ.options.map((optText, idx) => {
            const isCorrect = idx === correctIndex;
            const count = counts[idx] || 0;
            const pct = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0;
            // Calculate proportional height relative to highest bar (min 14% if count > 0)
            const heightPct = count > 0 ? Math.max(14, Math.round((count / maxCount) * 100)) : 6;
            const students = optionPlayerNames[idx] || [];

            return (
              <div
                key={idx}
                className={`flex flex-col items-center justify-end rounded-2xl p-3 md:p-4 border transition-all duration-300 relative ${
                  isCorrect
                    ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                    : 'bg-slate-900/60 border-slate-700/60'
                }`}
              >
                {/* Correct Badge Float at Top */}
                {isCorrect && (
                  <div className="absolute top-2.5 px-2.5 py-0.5 bg-emerald-500 text-slate-950 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1 shadow-md animate-pulse">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Correct Answer</span>
                  </div>
                )}

                {/* Vertical Bar Track Area */}
                <div className="w-full h-52 sm:h-64 flex flex-col justify-end items-center px-2 pt-8 pb-2 relative">
                  {/* The Rising Bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full max-w-[90px] rounded-2xl flex flex-col items-center justify-between py-2.5 px-1 shadow-lg transition-all duration-700 ease-out select-none ${
                      isCorrect
                        ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 border-2 border-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.6)] text-white'
                        : count > 0
                        ? 'bg-gradient-to-t from-slate-700 to-slate-600 border border-slate-500 text-slate-200'
                        : 'bg-slate-800/40 border border-dashed border-slate-700/60 text-slate-500'
                    }`}
                  >
                    {/* Top of Bar: Count */}
                    <div className="flex flex-col items-center">
                      <span className="font-black font-mono text-lg sm:text-2xl leading-none tabular-nums drop-shadow">
                        {count}
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-90">
                        {count === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>

                    {/* Bottom of Bar: Percentage */}
                    <div className="font-mono font-black text-xs sm:text-sm tabular-nums px-2 py-0.5 rounded-lg bg-black/25">
                      {pct}%
                    </div>
                  </div>
                </div>

                {/* Option Letter & Prompt Text */}
                <div className="w-full flex flex-col items-center text-center gap-1.5 pt-3 border-t border-slate-700/60 mt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shadow ${
                        isCorrect
                          ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300'
                          : OPTION_THEME_COLORS[idx].badge
                      }`}
                    >
                      {OPTION_KEYS[idx]}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-200 line-clamp-2">
                      {optText}
                    </span>
                  </div>
                </div>

                {/* Student Names List Under Each Option Bar */}
                {showRoster && (
                  <div className="w-full mt-3 pt-2.5 border-t border-slate-700/40 flex flex-col gap-1.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span>Students ({students.length})</span>
                      {isCorrect && students.length > 0 && (
                        <span className="text-emerald-400 font-semibold text-[10px]">Praise God!</span>
                      )}
                    </div>

                    {students.length === 0 ? (
                      <span className="text-[11px] text-slate-500 italic py-1 text-center">
                        None selected
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-0.5">
                        {students.map((name, sIdx) => (
                          <span
                            key={sIdx}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg truncate max-w-full ${
                              isCorrect
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                            title={name}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Advance Action Button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onShowLeaderboard}
          className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base md:text-lg rounded-2xl shadow-xl transition active:scale-95"
        >
          <Trophy className="w-5 h-5 text-amber-300" />
          <span>
            {isLastQuestion ? 'Show Final Championship Podium' : 'Show Top 5 Leaderboard'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
