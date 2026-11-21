'use client';

import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { ScriptureNote } from '@/components/player/PlayerResultCard';
import { OPTION_LETTERS, OPTION_STYLES, ui } from '@/lib/ui';

interface HostAnswerRevealedViewProps {
  onShowLeaderboard: () => void;
  isLastQuestion: boolean;
  isBusy?: boolean;
}

export const HostAnswerRevealedView: React.FC<HostAnswerRevealedViewProps> = ({
  onShowLeaderboard,
  isLastQuestion,
  isBusy = false,
}) => {
  const currentQuestionIndex = useHostStore((s) => s.currentQuestionIndex);
  const questions = useHostStore((s) => s.questions);
  const reveal = useHostStore((s) => s.reveal);
  const [showNames, setShowNames] = useState(true);

  const currentQ = questions[currentQuestionIndex];
  if (!currentQ || !reveal) return null;

  const correctIndex = reveal.correctOptionIndex;
  const counts = reveal.optionCounts || [0, 0, 0, 0];
  const totalAnswered = reveal.totalAnswered || 0;
  const maxCount = Math.max(...counts, 1);
  const names = reveal.optionPlayerNames || [[], [], [], []];
  const correctCount = counts[correctIndex] || 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 animate-enter">
      <div>
        <p className="text-xl text-muted tabular-nums">Question {currentQuestionIndex + 1}</p>
        <h1 className="mt-2 max-w-5xl font-display text-[clamp(1.75rem,3vw,3rem)] leading-[1.12] text-page/90">
          {currentQ.prompt}
        </h1>
      </div>

      <ol className="flex flex-col gap-3">
        {currentQ.options.map((text, idx) => {
          const isCorrect = idx === correctIndex;
          const count = counts[idx] || 0;
          const pct = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0;
          const style = OPTION_STYLES[idx];
          const pickedBy = names[idx] || [];

          return (
            <li
              key={idx}
              className={`rounded-[var(--radius-tile)] p-4 ${isCorrect ? 'bg-cover ring-2 ring-psalm' : 'opacity-70'}`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] font-display text-2xl ${style.bg} ${style.text}`}
                >
                  {OPTION_LETTERS[idx]}
                </span>
                <span className="min-w-0 flex-1 text-[clamp(1.125rem,1.8vw,1.75rem)] font-medium leading-snug">
                  {text}
                  {isCorrect && (
                    <span className="ml-3 inline-flex items-center gap-1 align-middle text-base font-semibold text-psalm">
                      <Check className="h-5 w-5" strokeWidth={3} /> Correct
                    </span>
                  )}
                </span>
                <span className="w-24 shrink-0 text-right text-2xl font-semibold tabular-nums">
                  {count}
                  <span className="ml-1.5 text-base font-normal text-muted">{pct}%</span>
                </span>
              </div>

              <div className="ml-16 mt-3 h-2.5 overflow-hidden rounded-full bg-cover-2">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${isCorrect ? 'bg-psalm' : 'bg-faint'}`}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>

              {showNames && pickedBy.length > 0 && (
                <p className="ml-16 mt-2.5 text-sm leading-relaxed text-muted">{pickedBy.join(', ')}</p>
              )}
            </li>
          );
        })}
      </ol>

      <ScriptureNote reference={reveal.scriptureRef} explanation={reveal.explanation} large />

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
        <p className="text-xl text-muted">
          <span className="font-semibold tabular-nums text-page">{correctCount}</span> of{' '}
          <span className="tabular-nums">{totalAnswered}</span> got it right
        </p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowNames((v) => !v)} className={ui.btnQuiet}>
            {showNames ? 'Hide names' : 'Show names'}
          </button>
          <button type="button" onClick={onShowLeaderboard} disabled={isBusy} className={`${ui.btnPrimary} px-6 text-lg`}>
            {isBusy ? 'Loading…' : isLastQuestion ? 'Show final results' : 'Show standings'}
          </button>
        </div>
      </div>
    </div>
  );
};
