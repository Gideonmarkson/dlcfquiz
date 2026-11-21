'use client';

import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { PublicQuestionDTO } from '@/types/quiz';
import { OPTION_LETTERS, OPTION_STYLES } from '@/lib/ui';

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

  return (
    <div className="flex flex-col gap-2.5">
      {question.options.map((text, i) => {
        const index = i as 0 | 1 | 2 | 3;
        const style = OPTION_STYLES[index];
        const isSelected = selectedOption === index;
        const isDimmed = isLocked && !isSelected;

        return (
          <button
            key={index}
            type="button"
            disabled={isLocked}
            onClick={() => handleSelect(index)}
            aria-pressed={isSelected}
            className={`flex min-h-[64px] w-full items-center gap-3.5 rounded-[var(--radius-tile)] p-3 text-left transition-[opacity,transform] duration-150 active:scale-[0.98] select-none ${
              isDimmed ? 'opacity-25' : ''
            } ${isSelected ? `bg-cover ring-2 ${style.ring}` : `${style.bg} ${style.text}`}`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] font-display text-xl ${
                isSelected ? `${style.bg} ${style.text}` : 'bg-black/15'
              }`}
            >
              {OPTION_LETTERS[index]}
            </span>
            <span className="flex-1 text-lg font-medium leading-snug">{text}</span>
          </button>
        );
      })}

      {isLocked && (
        <p className="pt-2 text-center text-muted" aria-live="polite">
          Answer locked in. The result shows when time is up.
        </p>
      )}
    </div>
  );
};
