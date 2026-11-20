'use client';

import React from 'react';
import { Circle, Diamond, Triangle, Square, CheckCircle2, FastForward } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { CountdownTimer } from '@/components/shared/CountdownTimer';

interface HostQuestionActiveViewProps {
  onEndEarly: () => void;
}

export const HostQuestionActiveView: React.FC<HostQuestionActiveViewProps> = ({ onEndEarly }) => {
  const currentQuestionIndex = useHostStore((s) => s.currentQuestionIndex);
  const questions = useHostStore((s) => s.questions);
  const questionEndsAtMs = useHostStore((s) => s.questionEndsAtMs);
  const players = useHostStore((s) => s.players);
  const answeredCount = useHostStore((s) => s.answeredCount);

  const currentQ = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const totalPlayers = players.length;

  if (!currentQ) return null;

  const OPTIONS = [
    { label: 'A', text: currentQ.options[0], color: 'bg-blue-600 border-blue-500', icon: Circle },
    { label: 'B', text: currentQ.options[1], color: 'bg-amber-600 border-amber-500', icon: Diamond },
    { label: 'C', text: currentQ.options[2], color: 'bg-teal-600 border-teal-500', icon: Triangle },
    { label: 'D', text: currentQ.options[3], color: 'bg-violet-600 border-violet-500', icon: Square },
  ];

  const answerProgressRatio = totalPlayers > 0 ? Math.min(1, answeredCount / totalPlayers) : 0;

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto py-2">
      {/* Top Bar: Progress & Countdown */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-sm font-extrabold uppercase tracking-wide">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </span>
          <span className="text-slate-400 text-xs md:text-sm font-semibold">
            {currentQ.timeLimitSec}s Round
          </span>
        </div>

        <div className="w-full md:w-72">
          {questionEndsAtMs && (
            <CountdownTimer
              totalSeconds={currentQ.timeLimitSec}
              questionEndsAtMs={questionEndsAtMs}
              isHost={true}
              onTimeUp={onEndEarly}
            />
          )}
        </div>
      </div>

      {/* Prominent Question Prompt Card */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 md:p-10 shadow-2xl min-h-[160px] flex items-center justify-center text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl xl:text-5xl font-black text-slate-50 leading-tight">
          {currentQ.prompt}
        </h2>
      </div>

      {/* 2x2 Grid of High-Contrast Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <div
              key={opt.label}
              className="flex items-center gap-4 p-5 md:p-6 rounded-3xl bg-slate-800/80 border-2 border-slate-700/80 shadow-xl"
            >
              <div
                className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center font-black text-xl md:text-2xl text-white shadow-md ${opt.color}`}
              >
                <span className="mr-0.5">{opt.label}</span>
              </div>
              <div className="flex-1 font-bold text-lg md:text-2xl text-slate-100 leading-snug">
                {opt.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Response Bar & End Early Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 shadow-md">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-sm md:text-base">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="tabular-nums">
              {answeredCount} / {totalPlayers} Answered
            </span>
          </div>

          <div className="w-32 h-2.5 bg-slate-700 rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${answerProgressRatio * 100}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onEndEarly}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-md active:scale-95"
        >
          <FastForward className="w-4 h-4 fill-current" />
          <span>Reveal Answer Now</span>
        </button>
      </div>
    </div>
  );
};
