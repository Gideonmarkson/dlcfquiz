'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionInput } from '@/types/quiz';
import { SAMPLE_BIBLE_QUESTIONS } from '@/lib/sampleQuestions';
import { QuestionUploader } from '@/components/host/QuestionUploader';
import { InlineQuestionEditor } from '@/components/host/InlineQuestionEditor';
import Link from 'next/link';
import { ui } from '@/lib/ui';

export default function HostSetupPage() {
  const router = useRouter();
  const [title, setTitle] = useState('DLCF AFIT Bible Quiz');
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
      setErrorMessage('Add at least one question before opening the game.');
      return;
    }

    // Verify all questions have prompt and options
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.prompt.trim()) {
        setErrorMessage(`Question ${i + 1} needs the question text.`);
        return;
      }
      if (q.options.some((opt) => !opt.trim())) {
        setErrorMessage(`Question ${i + 1} has an empty answer. Fill in all four.`);
        return;
      }
      if (!q.scriptureRef.trim()) {
        setErrorMessage(`Question ${i + 1} needs a scripture reference.`);
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
          // Optional key saved in the uploader; the server falls back to GEMINI_API_KEY.
          geminiKey: localStorage.getItem('dlcf_gemini_api_key') || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'The game couldn’t be created. Try again.');
        setIsSubmitting(false);
        return;
      }

      if (data.hostSecret) {
        try {
          localStorage.setItem(`dlcf_host_secret_${data.pin}`, data.hostSecret);
        } catch {
          // ignore localStorage error
        }
      }

      // Show Recovery Key modal
      setCreatedRoomInfo({
        pin: data.pin,
        recoveryCode: data.recoveryCode,
      });
    } catch (err: unknown) {
      console.error('Room creation network error:', err);
      setErrorMessage(
        'Can’t reach the server. Check the internet connection and try again.'
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

  const needsNotes = questions.some((q) => !q.explanation || !q.explanation.trim());
  const openButtonLabel = isSubmitting
    ? needsNotes
      ? 'Writing answer notes…'
      : 'Opening…'
    : `Open game with ${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`;

  return (
    <div className="min-h-[100dvh] px-5 sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 pb-32 pt-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-page transition-colors hover:text-gilt">
            Bible Quiz
          </Link>
          <span className="text-sm text-faint">Host setup</span>
        </header>

        <div>
          <h1 className="font-display text-5xl leading-tight">Set up a game</h1>
          <p className="mt-2 max-w-xl text-lg text-muted">
            Load your questions, check them, then open the game. Players join with the PIN shown on the projector.
          </p>
        </div>

        <section className="grid gap-5 md:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-2">
            <label htmlFor="game-title" className={ui.label}>
              Game title
            </label>
            <input
              id="game-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-week Bible study review"
              className={ui.input}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="game-timer" className={ui.label}>
              Time per question
            </label>
            <select
              id="game-timer"
              value={universalTimer}
              onChange={(e) => applyTimerToAll(parseInt(e.target.value, 10))}
              className={ui.input}
            >
              {[10, 15, 20, 30, 45, 60].map((sec) => (
                <option key={sec} value={sec}>
                  {sec} seconds
                </option>
              ))}
            </select>
            <span className="text-sm text-faint">Changing this updates every question.</span>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Questions file</h2>
          <QuestionUploader
            onQuestionsLoaded={(newQs) => {
              setQuestions(newQs.map((q) => ({ ...q, timeLimitSec: universalTimer })));
              setErrorMessage(null);
            }}
          />
        </section>

        <InlineQuestionEditor
          questions={questions}
          onChange={setQuestions}
          universalTimer={universalTimer}
          onApplyUniversalTimer={applyTimerToAll}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-ink/95">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          {errorMessage ? (
            <p role="alert" className="text-sm text-[#f0a49d]">
              {errorMessage}
            </p>
          ) : (
            <p className="text-sm text-muted tabular-nums">
              {questions.length} {questions.length === 1 ? 'question' : 'questions'} · {universalTimer} seconds each
            </p>
          )}
          <button
            type="button"
            disabled={isSubmitting || questions.length === 0}
            onClick={handleCreateRoom}
            className={`${ui.btnPrimary} text-lg`}
          >
            {openButtonLabel}
          </button>
        </div>
      </div>

      {createdRoomInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 animate-enter" role="dialog" aria-modal="true" aria-labelledby="created-title">
          <div className={`${ui.surface} flex w-full max-w-md flex-col gap-6 p-7`}>
            <div>
              <h2 id="created-title" className="font-display text-3xl">
                Game {createdRoomInfo.pin} is ready
              </h2>
              <p className="mt-2 text-muted">
                Write down this recovery code. If this laptop restarts, it lets you take back control of the game.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] bg-ink px-4 py-3">
              <span className="text-2xl font-semibold tracking-[0.15em] tabular-nums text-gilt">
                {createdRoomInfo.recoveryCode}
              </span>
              <button type="button" onClick={handleCopyRecovery} className={ui.btnQuiet}>
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>

            <button type="button" onClick={handleProceedToConsole} className={`${ui.btnPrimary} text-lg`}>
              Open the lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
