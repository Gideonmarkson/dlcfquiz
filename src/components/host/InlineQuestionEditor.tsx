'use client';

import React from 'react';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { ui, OPTION_LETTERS, OPTION_STYLES } from '@/lib/ui';
import { QuestionInput } from '@/types/quiz';

interface InlineQuestionEditorProps {
  questions: QuestionInput[];
  onChange: (questions: QuestionInput[]) => void;
  universalTimer?: number;
  onApplyUniversalTimer?: (sec: number) => void;
}

export const InlineQuestionEditor: React.FC<InlineQuestionEditorProps> = ({
  questions,
  onChange,
  universalTimer = 20,
  onApplyUniversalTimer,
}) => {
  const updateQuestion = (index: number, updated: Partial<QuestionInput>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...updated };
    onChange(next);
  };

  const removeQuestion = (index: number) => {
    const next = questions.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length) return;
    const next = [...questions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  const addQuestion = () => {
    const newQ: QuestionInput = {
      prompt: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      scriptureRef: '',
      explanation: '',
      timeLimitSec: universalTimer,
    };
    onChange([...questions, newQ]);
  };

  const fieldClass = `${ui.input} bg-ink py-2 text-sm`;
  const iconBtn =
    'rounded-[var(--radius-control)] p-1.5 text-muted transition-colors hover:bg-cover-2 hover:text-page disabled:pointer-events-none disabled:opacity-25';

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">
          Questions <span className="font-sans text-lg tabular-nums text-muted">({questions.length})</span>
        </h2>
        <button type="button" onClick={addQuestion} className={`${ui.btnSecondary} px-3.5 py-2 text-sm`}>
          <Plus className="h-4 w-4" /> Add question
        </button>
      </div>

      {questions.length === 0 && (
        <p className="rounded-[var(--radius-tile)] border border-dashed border-rule p-8 text-center text-muted">
          No questions yet. Upload a file above or add one by hand.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {questions.map((q, idx) => (
          <li key={idx} className={`${ui.surface} flex flex-col gap-4 p-5`}>
            <div className="flex items-center justify-between">
              <span className="font-display text-xl tabular-nums text-gilt">{idx + 1}</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveQuestion(idx, idx - 1)}
                  className={iconBtn}
                  aria-label={`Move question ${idx + 1} up`}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={idx === questions.length - 1}
                  onClick={() => moveQuestion(idx, idx + 1)}
                  className={iconBtn}
                  aria-label={`Move question ${idx + 1} down`}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(idx)}
                  className={`${iconBtn} hover:text-[#f0a49d]`}
                  aria-label={`Delete question ${idx + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`q-${idx}-prompt`} className={ui.label}>
                Question
              </label>
              <textarea
                id={`q-${idx}-prompt`}
                rows={2}
                value={q.prompt}
                onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                placeholder="e.g. Which epistle says “Study to shew thyself approved unto God”?"
                className={`${fieldClass} resize-y`}
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className={`${ui.label} mb-1.5`}>Answers — tick the correct one</legend>
              <div className="grid gap-2 md:grid-cols-2">
                {OPTION_LETTERS.map((label, optIdx) => {
                  const isCorrect = q.correctOptionIndex === optIdx;
                  const style = OPTION_STYLES[optIdx];
                  return (
                    <div
                      key={label}
                      className={`flex items-center gap-2.5 rounded-[var(--radius-control)] border bg-ink px-2.5 py-1.5 transition-colors ${
                        isCorrect ? 'border-psalm' : 'border-rule focus-within:border-gilt'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded font-display text-sm ${style.bg} ${style.text}`}
                      >
                        {label}
                      </span>
                      <input
                        type="text"
                        value={q.options[optIdx]}
                        onChange={(e) => {
                          const newOpts = [...q.options] as [string, string, string, string];
                          newOpts[optIdx] = e.target.value;
                          updateQuestion(idx, { options: newOpts });
                        }}
                        placeholder={`Answer ${label}`}
                        aria-label={`Question ${idx + 1}, answer ${label}`}
                        className="w-full bg-transparent py-1 text-sm text-page placeholder:text-faint focus:outline-none"
                      />
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted">
                        <input
                          type="radio"
                          name={`correct_opt_${idx}`}
                          checked={isCorrect}
                          onChange={() => updateQuestion(idx, { correctOptionIndex: optIdx as 0 | 1 | 2 | 3 })}
                          className="h-4 w-4 cursor-pointer accent-[#3f9474]"
                        />
                        <span className={isCorrect ? 'text-psalm' : ''}>Correct</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`q-${idx}-ref`} className={ui.label}>
                  Scripture
                </label>
                <input
                  id={`q-${idx}-ref`}
                  type="text"
                  value={q.scriptureRef}
                  onChange={(e) => updateQuestion(idx, { scriptureRef: e.target.value })}
                  placeholder="e.g. 2 Timothy 2:15"
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`q-${idx}-note`} className={ui.label}>
                  Note shown with the answer <span className="text-faint">(optional)</span>
                </label>
                <input
                  id={`q-${idx}-note`}
                  type="text"
                  value={q.explanation || ''}
                  onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                  placeholder="e.g. Paul’s final charge to Timothy, written from Rome."
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`q-${idx}-time`} className={ui.label}>
                  Time
                </label>
                <select
                  id={`q-${idx}-time`}
                  value={q.timeLimitSec}
                  onChange={(e) => updateQuestion(idx, { timeLimitSec: parseInt(e.target.value, 10) })}
                  className={`${fieldClass} pr-8`}
                >
                  {[10, 15, 20, 30, 45, 60].map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} seconds
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
