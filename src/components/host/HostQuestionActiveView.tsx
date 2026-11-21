'use client';

import React from 'react';
import { useHostStore } from '@/store/useHostStore';
import { CountdownTimer } from '@/components/shared/CountdownTimer';
import { OPTION_LETTERS, OPTION_STYLES, ui } from '@/lib/ui';

interface HostQuestionActiveViewProps {
  onEndEarly: () => void;
  isBusy?: boolean;
}

export const HostQuestionActiveView: React.FC<HostQuestionActiveViewProps> = ({ onEndEarly, isBusy = false }) => {
  const currentQuestionIndex = useHostStore((s) => s.currentQuestionIndex);
  const questions = useHostStore((s) => s.questions);
  const questionEndsAtMs = useHostStore((s) => s.questionEndsAtMs);
  const players = useHostStore((s) => s.players);
  const answeredCount = useHostStore((s) => s.answeredCount);

  const currentQ = questions[currentQuestionIndex];
  if (!currentQ) return null;

  const totalPlayers = players.filter((p) => !p.isKicked).length;

  return (
    <div key={currentQ.id} className="mx-auto flex w-full max-w-7xl flex-col gap-8 animate-enter">
      <div className="flex items-center gap-8">
        <p className="shrink-0 text-xl tabular-nums text-muted">
          Question {currentQuestionIndex + 1} <span className="text-faint">of {questions.length}</span>
        </p>
        {questionEndsAtMs && (
          <CountdownTimer
            totalSeconds={currentQ.timeLimitSec}
            questionEndsAtMs={questionEndsAtMs}
            isHost
            onTimeUp={onEndEarly}
          />
        )}
      </div>

      <h1 className="max-w-5xl font-display text-[clamp(2.25rem,4.4vw,4.5rem)] leading-[1.08]">{currentQ.prompt}</h1>

      <div className="grid gap-3 md:grid-cols-2">
        {currentQ.options.map((text, idx) => {
          const style = OPTION_STYLES[idx];
          return (
            <div
              key={idx}
              className={`flex min-h-[96px] items-center gap-5 rounded-[var(--radius-tile)] p-5 ${style.bg} ${style.text}`}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-black/15 font-display text-3xl">
                {OPTION_LETTERS[idx]}
              </span>
              <span className="text-[clamp(1.25rem,2vw,2rem)] font-medium leading-snug">{text}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-rule pt-5">
        <p className="text-2xl">
          <span className="font-semibold tabular-nums">{answeredCount}</span>
          <span className="text-muted tabular-nums"> of {totalPlayers} answered</span>
        </p>
        <button type="button" onClick={onEndEarly} disabled={isBusy} className={ui.btnSecondary}>
          {isBusy ? 'Revealing…' : 'Reveal answer now'}
        </button>
      </div>
    </div>
  );
};
