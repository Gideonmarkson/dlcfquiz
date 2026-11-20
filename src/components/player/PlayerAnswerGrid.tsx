'use client';

import React from 'react';
import { Circle, Diamond, Triangle, Square, Check, Lock } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { PublicQuestionDTO } from '@/types/quiz';

interface PlayerAnswerGridProps {
  question: PublicQuestionDTO;
}

export const PlayerAnswerGrid: React.FC<PlayerAnswerGridProps> = ({ question }) => {
  const selectedOption = usePlayerStore((s) => s.selectedOption);
  const isLocked = usePlayerStore((s) => s.isLocked);
  const submitAnswer = usePlayerStore((s) => s.submitAnswer);

  const handleSelect = (index: 0 | 1 | 2 | 3) => {
    if (isLocked) return;
    submitAnswer(question.id, index);
  };

  const OPTIONS = [
    {
      index: 0 as const,
      label: 'A',
      text: question.options[0],
      bg: 'bg-blue-600 active:bg-blue-700 border-blue-500',
      badgeBg: 'bg-blue-800 text-white',
      icon: Circle,
    },
    {
      index: 1 as const,
      label: 'B',
      text: question.options[1],
      bg: 'bg-amber-600 active:bg-amber-700 border-amber-500',
      badgeBg: 'bg-amber-800 text-white',
      icon: Diamond,
    },
    {
      index: 2 as const,
      label: 'C',
      text: question.options[2],
      bg: 'bg-teal-600 active:bg-teal-700 border-teal-500',
      badgeBg: 'bg-teal-800 text-white',
      icon: Triangle,
    },
    {
      index: 3 as const,
      label: 'D',
      text: question.options[3],
      bg: 'bg-violet-600 active:bg-violet-700 border-violet-500',
      badgeBg: 'bg-violet-800 text-white',
      icon: Square,
    },
  ];

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 4 Large Touch Buttons */}
      <div className="grid grid-cols-1 gap-3 w-full">
        {OPTIONS.map((opt) => {
          const isSelected = selectedOption === opt.index;
          const isDimmed = isLocked && !isSelected;
          const Icon = opt.icon;

          return (
            <button
              key={opt.label}
              type="button"
              disabled={isLocked}
              onClick={() => handleSelect(opt.index)}
              className={`w-full min-h-[68px] p-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all duration-150 active:scale-98 select-none ${
                isSelected
                  ? 'border-amber-400 bg-slate-800 ring-4 ring-amber-400/40 scale-[1.02] shadow-2xl'
                  : isDimmed
                  ? 'opacity-35 pointer-events-none bg-slate-800/60 border-slate-700 text-slate-400'
                  : `${opt.bg} text-white shadow-lg`
              }`}
            >
              <div className="flex items-center gap-3.5 flex-1 pr-2">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow ${
                    isSelected ? 'bg-amber-500 text-slate-950' : opt.badgeBg
                  }`}
                >
                  {opt.label}
                </div>
                <span
                  className={`font-bold text-base md:text-lg leading-snug ${
                    isSelected ? 'text-amber-300' : 'text-slate-50'
                  }`}
                >
                  {opt.text}
                </span>
              </div>

              <div className="shrink-0 pl-1">
                {isSelected ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-full shadow">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Locked</span>
                  </div>
                ) : (
                  <Icon className="w-5 h-5 opacity-40 text-white" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lock Confirmation Note */}
      {isLocked && (
        <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-center flex items-center justify-center gap-2 text-xs md:text-sm text-slate-300 font-semibold shadow-inner">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Answer submitted! Look at the main screen for the reveal.</span>
        </div>
      )}
    </div>
  );
};
