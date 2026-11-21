'use client';

import React from 'react';
import { useHostStore } from '@/store/useHostStore';
import { levelLabel } from '@/components/shared/AcademicLevelBadge';
import { ui } from '@/lib/ui';

interface HostLeaderboardViewProps {
  onNextQuestion: () => void;
  isLastQuestion: boolean;
  isBusy?: boolean;
}

export const HostLeaderboardView: React.FC<HostLeaderboardViewProps> = ({
  onNextQuestion,
  isLastQuestion,
  isBusy = false,
}) => {
  const top5 = useHostStore((s) => s.top5);
  const currentQuestionIndex = useHostStore((s) => s.currentQuestionIndex);
  const questions = useHostStore((s) => s.questions);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 animate-enter">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xl text-muted tabular-nums">
            After question {currentQuestionIndex + 1} of {questions.length}
          </p>
          <h1 className="mt-1 font-display text-6xl leading-none">Top five</h1>
        </div>
        <button type="button" onClick={onNextQuestion} disabled={isBusy} className={`${ui.btnPrimary} px-6 text-lg`}>
          {isBusy ? 'Loading…' : isLastQuestion ? 'Show final results' : 'Next question'}
        </button>
      </div>

      {top5.length === 0 ? (
        <p className="text-xl text-muted">No scores yet.</p>
      ) : (
        <ol className="flex flex-col">
          {top5.map((entry, index) => {
            const rank = entry.rank || index + 1;
            const isFirst = rank === 1;
            return (
              <li key={entry.playerId} className="flex items-center gap-6 border-b border-rule py-5 last:border-b-0">
                <span
                  className={`w-12 shrink-0 font-display tabular-nums ${isFirst ? 'text-5xl text-gilt' : 'text-4xl text-faint'}`}
                >
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${isFirst ? 'text-4xl font-semibold' : 'text-3xl font-medium'}`}>
                    {entry.nickname}
                  </p>
                  <p className="mt-0.5 text-muted">
                    {levelLabel(entry.academicLevel)} · {entry.correctCount} correct
                  </p>
                </div>
                <span className={`font-semibold tabular-nums ${isFirst ? 'text-4xl text-gilt' : 'text-3xl'}`}>
                  {entry.totalScore.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
