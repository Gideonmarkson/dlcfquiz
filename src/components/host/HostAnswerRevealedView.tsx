'use client';

import React, { useState } from 'react';
import { useHostStore } from '@/store/useHostStore';
import { ScriptureNote } from '@/components/player/PlayerResultCard';
import { ui } from '@/lib/ui';
import { AnswerBarChart } from '@/components/shared/AnswerBarChart';

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

      <AnswerBarChart
        options={currentQ.options}
        counts={counts}
        correctIndex={correctIndex}
        names={showNames ? names : undefined}
      />

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
