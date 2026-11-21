'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { OPTION_LETTERS, OPTION_STYLES } from '@/lib/ui';

interface AnswerBarChartProps {
  options: string[];
  counts: number[];
  correctIndex: number;
  /** Names of who picked each option (projector only). */
  names?: string[][];
  size?: 'projector' | 'phone';
  /** Highlight the option this player picked (phone only). */
  myOption?: number | null;
}

/**
 * Column chart of how many people picked each answer. The correct column is green;
 * the others keep their answer colour, dimmed, so the room can match them to A–D.
 */
export const AnswerBarChart: React.FC<AnswerBarChartProps> = ({
  options,
  counts,
  correctIndex,
  names,
  size = 'projector',
  myOption = null,
}) => {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts, 1);
  const isProjector = size === 'projector';

  return (
    <div
      className={`grid grid-cols-4 items-start ${isProjector ? 'gap-6' : 'gap-2.5'}`}
      role="img"
      aria-label={options
        .map((o, i) => `${OPTION_LETTERS[i]}: ${counts[i] ?? 0}${i === correctIndex ? ' (correct)' : ''}`)
        .join(', ')}
    >
      {options.map((text, i) => {
        const count = counts[i] ?? 0;
        const isCorrect = i === correctIndex;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const heightPct = count > 0 ? Math.max(6, (count / max) * 100) : 0;
        const style = OPTION_STYLES[i];

        return (
          <div key={i} className="flex min-w-0 flex-col items-center">
            {/* Fixed-height track. Top padding reserves room for the count label,
                which rides on top of each bar, so all bars share one baseline and scale fully. */}
            <div className={`flex w-full items-end justify-center ${isProjector ? 'h-[40vh] min-h-56 pt-20' : 'h-48 pt-14'}`}>
              <div
                className={`relative w-full transition-[height] duration-700 ease-out ${isProjector ? 'max-w-[11rem]' : ''}`}
                style={{ height: count > 0 ? `${heightPct}%` : '4px' }}
              >
                <div className="absolute inset-x-0 bottom-full mb-2 text-center">
                  <p
                    className={`font-extrabold leading-none tabular-nums ${isProjector ? 'text-4xl' : 'text-xl'} ${
                      isCorrect ? 'text-psalm' : 'text-page/80'
                    }`}
                  >
                    {count}
                  </p>
                  <p className={`mt-1 tabular-nums text-muted ${isProjector ? 'text-base' : 'text-xs'}`}>{pct}%</p>
                </div>
                <div
                  className={`h-full w-full rounded-t-[var(--radius-tile)] ${
                    count === 0 ? 'bg-faint opacity-30' : isCorrect ? 'bg-psalm' : `${style.bg} opacity-40`
                  }`}
                />
              </div>
            </div>

            {/* Letter + answer under the bar */}
            <div className={`w-full border-t-2 ${isCorrect ? 'border-psalm' : 'border-rule'} pt-3 text-center`}>
              <span
                className={`inline-flex items-center justify-center rounded-[var(--radius-control)] font-display ${
                  isProjector ? 'h-12 w-12 text-2xl' : 'h-8 w-8 text-base'
                } ${isCorrect ? 'bg-psalm text-page' : `${style.bg} ${style.text}`}`}
              >
                {isCorrect ? <Check className={isProjector ? 'h-7 w-7' : 'h-5 w-5'} strokeWidth={3} /> : OPTION_LETTERS[i]}
              </span>
              <p
                className={`mt-2 leading-snug ${isProjector ? 'text-xl' : 'text-xs'} ${
                  isCorrect ? 'font-semibold text-page' : 'text-muted'
                } ${isProjector ? '' : 'line-clamp-2'}`}
              >
                {text}
              </p>
              {!isProjector && myOption === i && <p className="mt-1 text-[11px] font-semibold text-gilt">Your pick</p>}
              {isProjector && names && (names[i]?.length ?? 0) > 0 && (
                <p className="mt-2 max-h-28 overflow-y-auto text-sm leading-relaxed text-faint">{names[i].join(', ')}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
