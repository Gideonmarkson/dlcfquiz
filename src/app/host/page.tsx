'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionInput } from '@/types/quiz';
import { SAMPLE_BIBLE_QUESTIONS } from '@/lib/sampleQuestions';
import { QuestionUploader } from '@/components/host/QuestionUploader';
import { InlineQuestionEditor } from '@/components/host/InlineQuestionEditor';
import { Play, ShieldAlert, KeyRound, Copy, Check, ArrowRight, Clock } from 'lucide-react';

export default function HostSetupPage() {
  const router = useRouter();
  const [title, setTitle] = useState('DLCF AFIT Live Bible Quiz');
  const [universalTimer, setUniversalTimer] = useState<number>(20);
  const [questions, setQuestions] = useState<QuestionInput[]>(SAMPLE_BIBLE_QUESTIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recovery Key Modal State
  const [createdRoomInfo, setCreatedRoomInfo] = useState<{
    pin: string;
    recoveryCode: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Apply Universal Timer to all questions
  const applyTimerToAll = (seconds: number) => {
    setUniversalTimer(seconds);
    setQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        timeLimitSec: seconds,
      }))
    );
  };

  const handleCreateRoom = async () => {
    setErrorMessage(null);

    if (questions.length === 0) {
      setErrorMessage('Please add or upload at least 1 question.');
      return;
    }

    // Verify all questions have prompt and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) {
        setErrorMessage(`Question #${i + 1} is missing a prompt.`);
        return;
      }
      if (q.options.some((opt) => !opt.trim())) {
        setErrorMessage(`Question #${i + 1} has an empty option.`);
        return;
      }
      if (!q.scriptureRef.trim()) {
        setErrorMessage(`Question #${i + 1} is missing a Scripture reference.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/host/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          questions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to create room.');
        setIsSubmitting(false);
        return;
      }

      // Show Recovery Key modal
      setCreatedRoomInfo({
        pin: data.pin,
        recoveryCode: data.recoveryCode,
      });
    } catch (err: unknown) {
      console.error('Room creation network error:', err);
      setErrorMessage(
        `Failed to reach room creation server: ${err instanceof Error ? err.message : String(err)}`
      );
      setIsSubmitting(false);
    }
  };

  const handleProceedToConsole = () => {
    if (createdRoomInfo) {
      router.push(`/host/${createdRoomInfo.pin}`);
    }
  };

  const handleCopyRecovery = () => {
    if (createdRoomInfo) {
      navigator.clipboard.writeText(createdRoomInfo.recoveryCode);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 md:p-10 max-w-5xl mx-auto flex flex-col gap-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            DLCF AFIT Media Unit Console
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-50 mt-1">
            Create Fellowship Quiz Room
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Prepare question bank, configure timers, and launch the hall projection screen.
          </p>
        </div>

        <button
          type="button"
          disabled={isSubmitting || questions.length === 0}
          onClick={handleCreateRoom}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold text-sm md:text-base rounded-2xl shadow-xl transition active:scale-95"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{isSubmitting ? 'Creating Room...' : 'Create & Open Lobby'}</span>
        </button>
      </div>

      {/* Error Callout */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Session Settings: Title & Universal Timer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6 shadow-xl backdrop-blur">
        {/* Title Input */}
        <div className="md:col-span-2 flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fellowship Session Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. DLCF AFIT Mid-Week Bible Study Review"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-semibold text-base focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Universal Question Timer Setting */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Universal Timer for All Qs
            </label>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={universalTimer}
              onChange={(e) => applyTimerToAll(parseInt(e.target.value, 10))}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs md:text-sm font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value={10}>10s (Rapid Sword Drill)</option>
              <option value={15}>15s (Quick Round)</option>
              <option value={20}>20s (Standard Fellowship)</option>
              <option value={30}>30s (Thoughtful)</option>
              <option value={45}>45s (Extended)</option>
              <option value={60}>60s (Doctrinal Deep-Dive)</option>
            </select>

            <button
              type="button"
              onClick={() => applyTimerToAll(universalTimer)}
              className="px-3 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-extrabold whitespace-nowrap transition active:scale-95 shadow-sm"
              title="Apply this timer to all questions in bank"
            >
              Apply All
            </button>
          </div>
          <span className="text-[11px] text-slate-400 leading-tight">
            Sets the countdown duration for all {questions.length} questions in this quiz.
          </span>
        </div>
      </div>

      {/* Multi-Format Question Uploader Panel (PDF, CSV, JSON) */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6 shadow-xl backdrop-blur">
        <QuestionUploader
          onQuestionsLoaded={(newQs) => {
            // Apply universal timer to newly uploaded questions
            const withTimer = newQs.map((q) => ({
              ...q,
              timeLimitSec: universalTimer,
            }));
            setQuestions(withTimer);
            setErrorMessage(null);
          }}
        />
      </div>

      {/* Inline Question Editor */}
      <InlineQuestionEditor
        questions={questions}
        onChange={setQuestions}
        universalTimer={universalTimer}
        onApplyUniversalTimer={applyTimerToAll}
      />

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 flex items-center justify-between bg-slate-900/95 backdrop-blur p-4 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="flex items-center gap-3 text-xs md:text-sm text-slate-400">
          <span className="font-bold text-slate-200">{questions.length} Questions</span>
          <span>•</span>
          <span className="font-semibold text-amber-400">{universalTimer}s per question</span>
        </div>

        <button
          type="button"
          disabled={isSubmitting || questions.length === 0}
          onClick={handleCreateRoom}
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-base md:text-lg rounded-2xl shadow-xl transition active:scale-95"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{isSubmitting ? 'Creating Room...' : `Open Fellowship Lobby (${questions.length} Qs)`}</span>
        </button>
      </div>

      {/* Host Recovery Key Modal */}
      {createdRoomInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-800 border-2 border-amber-500/80 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl flex flex-col gap-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <KeyRound className="w-7 h-7" />
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-black text-slate-100">
                Room Created Successfully!
              </h2>
              <p className="text-slate-400 text-xs md:text-sm">
                PIN: <span className="text-amber-400 font-mono font-bold">{createdRoomInfo.pin}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Host Emergency Recovery Key
              </span>
              <div className="text-2xl font-mono font-black text-amber-400 tracking-widest tabular-nums">
                {createdRoomInfo.recoveryCode}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Save this key. If the media laptop restarts or crashes, you can instantly regain host access.
              </p>
              <button
                type="button"
                onClick={handleCopyRecovery}
                className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Key Copied!' : 'Copy Recovery Key'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleProceedToConsole}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base shadow-xl transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Proceed to Projection Console</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
