'use client';

import React from 'react';
import { Trash2, Plus, ArrowUp, ArrowDown, BookOpen, Clock } from 'lucide-react';
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

  const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
  const OPTION_COLORS = [
    'border-blue-500/40 text-blue-400 focus-within:border-blue-400',
    'border-amber-500/40 text-amber-400 focus-within:border-amber-400',
    'border-teal-500/40 text-teal-400 focus-within:border-teal-400',
    'border-violet-500/40 text-violet-400 focus-within:border-violet-400',
  ];

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base md:text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>Question Bank</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
              {questions.length} Questions
            </span>
          </h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Universal Timer: {universalTimer}s</span>
          </span>
        </div>

        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs md:text-sm rounded-lg transition"
        >
          <Plus className="w-4 h-4" /> Add Question
        </button>
      </div>

      {questions.map((q, idx) => (
        <div
          key={idx}
          className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md flex flex-col gap-4 relative"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-amber-400 text-sm tracking-wide">
                Question #{idx + 1}
              </span>
              <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                {q.timeLimitSec}s
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => moveQuestion(idx, idx - 1)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                title="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={idx === questions.length - 1}
                onClick={() => moveQuestion(idx, idx + 1)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                title="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => removeQuestion(idx)}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/20 transition ml-1"
                title="Delete question"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase text-slate-400">
              Question Prompt
            </label>
            <textarea
              rows={2}
              value={q.prompt}
              onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
              placeholder="e.g. Which epistle instructs believers to 'Study to shew thyself approved unto God'?"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* 4 Options Grid with Correct Radio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase text-slate-400">
              Options (Select radio for correct answer)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {OPTION_LABELS.map((label, optIdx) => {
                const isSelected = q.correctOptionIndex === optIdx;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900 border transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : OPTION_COLORS[optIdx]
                    }`}
                  >
                    <input
                      type="radio"
                      name={`correct_opt_${idx}`}
                      checked={isSelected}
                      onChange={() => updateQuestion(idx, { correctOptionIndex: optIdx as 0 | 1 | 2 | 3 })}
                      className="w-4 h-4 text-emerald-500 focus:ring-emerald-400 accent-emerald-500 cursor-pointer"
                    />
                    <span className="font-bold text-xs">{label}</span>
                    <input
                      type="text"
                      value={q.options[optIdx]}
                      onChange={(e) => {
                        const newOpts = [...q.options] as [string, string, string, string];
                        newOpts[optIdx] = e.target.value;
                        updateQuestion(idx, { options: newOpts });
                      }}
                      placeholder={`Option ${label}`}
                      className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs md:text-sm focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scripture Reference, Explanation & Per-Question Override */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Scripture Ref
              </label>
              <input
                type="text"
                value={q.scriptureRef}
                onChange={(e) => updateQuestion(idx, { scriptureRef: e.target.value })}
                placeholder="e.g. 2 Timothy 2:15"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs md:text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400">
                Doctrinal Note (Optional)
              </label>
              <input
                type="text"
                value={q.explanation || ''}
                onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                placeholder="e.g. Paul's final charge in Rome."
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs md:text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Override Timer
              </label>
              <select
                value={q.timeLimitSec}
                onChange={(e) => updateQuestion(idx, { timeLimitSec: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs md:text-sm focus:outline-none focus:border-amber-400"
              >
                <option value={10}>10s (Rapid)</option>
                <option value={15}>15s</option>
                <option value={20}>20s (Standard)</option>
                <option value={30}>30s</option>
                <option value={45}>45s</option>
                <option value={60}>60s</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
