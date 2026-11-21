'use client';

import React from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { OPTION_LETTERS } from '@/lib/ui';
import { ordinal } from '@/components/player/PlayerStatusHeader';

export const PlayerResultCard: React.FC = () => {
  const result = usePlayerStore((s) => s.result);
  const reveal = usePlayerStore((s) => s.reveal);
  const selectedOption = usePlayerStore((s) => s.selectedOption);

  if (!reveal) return null;

  const isAnswered = selectedOption !== null;
  const isCorrect = isAnswered && selectedOption === reveal.correctOptionIndex;
  const points = isCorrect ? result?.pointsAwarded ?? 0 : 0;
  const rank = result?.currentRank;
  const totalPlayers = result?.totalPlayers;

  const headline = isCorrect ? 'Correct' : isAnswered ? 'Not this time' : 'Time ran out';

  return (
    <section className="flex flex-col gap-8 animate-enter">
      <div>
        <p className={`text-sm ${isCorrect ? 'text-psalm' : isAnswered ? 'text-[#f0a49d]' : 'text-muted'}`}>
          {isAnswered ? `You answered ${OPTION_LETTERS[selectedOption as number]}` : 'No answer sent'}
        </p>
        <h1 className="mt-1 font-display text-5xl leading-none">{headline}</h1>
        <p className="mt-3 text-2xl font-semibold tabular-nums text-gilt">
          {isCorrect && points > 0 ? `+${points.toLocaleString()} points` : '+0 points'}
        </p>
      </div>

      <ScriptureNote reference={reveal.scriptureRef} explanation={reveal.explanation} />

      {rank ? (
        <p className="text-lg text-muted">
          You’re <span className="text-page tabular-nums">{ordinal(rank)}</span>
          {totalPlayers ? <span className="tabular-nums"> of {totalPlayers}</span> : null}
          {result?.cumulativeScore !== undefined ? (
            <> with <span className="text-page tabular-nums">{result.cumulativeScore.toLocaleString()}</span> points.</>
          ) : (
            '.'
          )}
        </p>
      ) : null}
    </section>
  );
};

/** The answer's scripture, marked with a ribbon like a bookmarked page. */
export const ScriptureNote: React.FC<{ reference: string; explanation?: string | null; large?: boolean }> = ({
  reference,
  explanation,
  large = false,
}) => (
  <div className="relative border-t border-rule pt-5">
    <span aria-hidden className={`absolute -top-px left-0 w-3 bg-ribbon [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] ${large ? 'h-12 w-4' : 'h-9'}`} />
    <p className={`pl-7 font-display text-gilt ${large ? 'text-4xl md:text-5xl pl-9' : 'text-2xl'}`}>{reference}</p>
    {explanation && (
      <p className={`mt-2 max-w-prose leading-relaxed text-page/85 ${large ? 'text-xl md:text-2xl pl-9' : 'pl-7'}`}>
        {explanation}
      </p>
    )}
  </div>
);
