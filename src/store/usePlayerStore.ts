'use client';

import { create } from 'zustand';
import {
  RoomStatus,
  AcademicLevel,
  HypeEmoji,
  PublicQuestionDTO,
  RevealedAnswerDTO,
  PlayerSessionStorage,
  StateChangePayload,
  TimerSyncPayload,
} from '@/types/quiz';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { startAdaptivePoll } from '@/lib/adaptivePoll';
import { playTap, playCorrect, playWrong, playPhoneQuestion } from '@/lib/audio';
import { RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY = 'dlcf_quiz_session_v1';

export interface PlayerResultState {
  isCorrect: boolean;
  pointsAwarded: number;
  cumulativeScore: number;
  currentRank: number;
  totalPlayers: number;
  pointsToNextRank?: number;
}

interface PlayerStore {
  pin: string;
  playerId: string | null;
  playerToken: string | null;
  nickname: string;
  academicLevel: AcademicLevel;
  roomStatus: RoomStatus;
  currentQuestionIndex: number;
  activeQuestion: PublicQuestionDTO | null;
  questionEndsAtMs: number | null;
  clockOffsetMs: number;
  selectedOption: number | null;
  isLocked: boolean;
  isSubmittingAnswer: boolean;
  reveal: RevealedAnswerDTO | null;
  result: PlayerResultState | null;
  isConnected: boolean;
  isReconnecting: boolean;
  channel: RealtimeChannel | null;
  stopPolling: (() => void) | null;
  realtimeLive: boolean;
  lastHypeTime: number;
  hypeCountWindow: number[];

  initSessionFromStorage: () => PlayerSessionStorage | null;
  saveSessionToStorage: (session: PlayerSessionStorage) => void;
  clearSession: () => void;
  setPlayerState: (state: Partial<PlayerStore>) => void;
  setSelectedOption: (option: number) => void;
  lockAnswer: () => void;
  submitAnswer: (questionId: string, optionIndex: 0 | 1 | 2 | 3) => Promise<boolean>;
  sendHype: (emoji: HypeEmoji) => boolean;
  subscribeToRoom: (pin: string) => void;
  fetchPersonalResult: (pin: string, questionId: string) => Promise<void>;
  cleanup: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  pin: '',
  playerId: null,
  playerToken: null,
  nickname: '',
  academicLevel: '100L',
  roomStatus: 'LOBBY',
  currentQuestionIndex: -1,
  activeQuestion: null,
  questionEndsAtMs: null,
  clockOffsetMs: 0,
  selectedOption: null,
  isLocked: false,
  isSubmittingAnswer: false,
  reveal: null,
  result: null,
  isConnected: false,
  isReconnecting: false,
  channel: null,
  stopPolling: null,
  realtimeLive: false,
  lastHypeTime: 0,
  hypeCountWindow: [],

  initSessionFromStorage: () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PlayerSessionStorage;
      if (parsed.pin && parsed.playerToken) {
        set({
          pin: parsed.pin,
          playerId: parsed.playerId,
          playerToken: parsed.playerToken,
          nickname: parsed.nickname,
          academicLevel: parsed.academicLevel,
        });
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  },

  saveSessionToStorage: (session) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      set({
        pin: session.pin,
        playerId: session.playerId,
        playerToken: session.playerToken,
        nickname: session.nickname,
        academicLevel: session.academicLevel,
      });
    } catch (e) {
      console.warn('Failed to save session to localStorage', e);
    }
  },

  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({
      playerId: null,
      playerToken: null,
      nickname: '',
      selectedOption: null,
      isLocked: false,
      result: null,
    });
  },

  setPlayerState: (state) => set((prev) => ({ ...prev, ...state })),

  setSelectedOption: (option) => {
    const { isLocked } = get();
    if (!isLocked) {
      set({ selectedOption: option });
    }
  },

  lockAnswer: () => set({ isLocked: true }),

  submitAnswer: async (questionId, optionIndex) => {
    const { pin, playerToken, isSubmittingAnswer } = get();
    if (!pin || !playerToken || isSubmittingAnswer) return false;

    // Synchronously lock option in UI immediately (0ms feedback)
    set({ selectedOption: optionIndex, isLocked: true, isSubmittingAnswer: true });
    playTap();

    try {
      const res = await fetch('/api/play/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Player-Token': playerToken,
        },
        body: JSON.stringify({
          pin,
          questionId,
          selectedOption: optionIndex,
        }),
      });

      if (!res.ok) {
        console.error('Answer submission returned status', res.status);
      }
      return true;
    } catch (err) {
      console.error('Failed to submit answer, will retry on recovery', err);
      return false;
    } finally {
      set({ isSubmittingAnswer: false });
    }
  },

  fetchPersonalResult: async (pin, questionId) => {
    const { playerToken } = get();
    if (!playerToken) return;

    try {
      const res = await fetch(`/api/play/result?pin=${pin}&questionId=${questionId}`, {
        headers: {
          'X-Player-Token': playerToken,
        },
      });

      if (res.ok) {
        const data = await res.json();
        set({
          result: {
            isCorrect: data.isCorrect,
            pointsAwarded: data.pointsAwarded,
            cumulativeScore: data.cumulativeScore,
            currentRank: data.currentRank,
            totalPlayers: data.totalPlayers,
            pointsToNextRank: data.pointsToNextRank,
          },
        });
      }
    } catch (err) {
      console.error('Failed to fetch personal result', err);
    }
  },

  sendHype: (emoji) => {
    const { channel, academicLevel, lastHypeTime, hypeCountWindow } = get();
    if (!channel) return false;

    const now = Date.now();
    // 1,500ms cooldown
    if (now - lastHypeTime < 1500) {
      return false;
    }

    // Sliding window: max 5 reactions per 10 seconds
    const recentWindow = hypeCountWindow.filter((ts) => now - ts < 10000);
    if (recentWindow.length >= 5) {
      return false;
    }

    recentWindow.push(now);
    set({ lastHypeTime: now, hypeCountWindow: recentWindow });

    channel.send({
      type: 'broadcast',
      event: 'hype',
      payload: {
        id: Math.random().toString(36).substring(2, 6),
        e: emoji,
        l: academicLevel,
      },
    });

    return true;
  },

  subscribeToRoom: (pin: string) => {
    get().cleanup();

    // How often to poll: fast when polling is the only source of updates,
    // slow when the realtime channel is pushing changes and polling is just a safety net.
    const POLL_FAST_MS = 1200;
    const POLL_SAFETY_MS = 5000;
    let consecutiveFailures = 0;
    let resultFetchedFor: string | null = null;

    const applySnapshot = (data: {
      roomSnapshot: {
        status: RoomStatus;
        currentQuestionIndex: number;
        serverNowMs: number;
        questionEndsAtMs: number | null;
      };
      activeQuestion: PublicQuestionDTO | null;
      lockedOptionForActiveQuestion: number | null;
      reveal: RevealedAnswerDTO | null;
      player?: { totalScore: number; currentRank: number; totalPlayers: number };
      myResult?: { isCorrect: boolean; pointsAwarded: number } | null;
    }) => {
      const offset = data.roomSnapshot.serverNowMs - Date.now();
      const nextStatus = data.roomSnapshot.status;
      const nextQIdx = data.roomSnapshot.currentQuestionIndex;

      set((prev) => {
        const isNewQuestion = nextStatus === 'QUESTION_ACTIVE' && nextQIdx !== prev.currentQuestionIndex;
        const selectedOpt = isNewQuestion ? null : (data.lockedOptionForActiveQuestion ?? prev.selectedOption);

        // Personal result now arrives inside the session payload, so no extra request at reveal time.
        let result = isNewQuestion ? null : prev.result;
        if (data.player) {
          result = {
            isCorrect: data.myResult?.isCorrect ?? result?.isCorrect ?? false,
            pointsAwarded: data.myResult?.pointsAwarded ?? result?.pointsAwarded ?? 0,
            cumulativeScore: data.player.totalScore,
            currentRank: data.player.currentRank,
            totalPlayers: data.player.totalPlayers,
          };
        }

        return {
          roomStatus: nextStatus,
          currentQuestionIndex: nextQIdx,
          activeQuestion: data.activeQuestion ?? (isNewQuestion ? null : prev.activeQuestion),
          questionEndsAtMs: data.roomSnapshot.questionEndsAtMs ?? prev.questionEndsAtMs,
          reveal: data.reveal ?? (nextStatus === 'ANSWER_REVEALED' ? prev.reveal : null),
          clockOffsetMs: offset,
          selectedOption: selectedOpt,
          isLocked: isNewQuestion ? false : selectedOpt !== null ? true : prev.isLocked,
          result,
          isConnected: true,
          isReconnecting: false,
        };
      });
    };

    const stopPolling = startAdaptivePoll(
      async () => {
        const { playerToken } = get();
        if (!playerToken) return;
        try {
          const res = await fetch(`/api/play/session?pin=${pin}`, {
            headers: { 'X-Player-Token': playerToken },
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (data?.roomSnapshot) {
            applySnapshot(data);
            // Backends that don't include myResult in the session payload: fetch it once per question.
            const revealedId = data.reveal?.questionId as string | undefined;
            if (data.roomSnapshot.status === 'ANSWER_REVEALED' && revealedId && data.myResult === undefined && resultFetchedFor !== revealedId) {
              resultFetchedFor = revealedId;
              get().fetchPersonalResult(pin, revealedId);
            }
          }
          consecutiveFailures = 0;
        } catch {
          consecutiveFailures++;
          if (consecutiveFailures >= 3 && !get().realtimeLive) {
            set({ isConnected: false, isReconnecting: true });
          }
        }
      },
      () => (get().realtimeLive ? POLL_SAFETY_MS : POLL_FAST_MS),
    );

    // Realtime broadcast channel (only when Supabase is configured)
    set({ channel: null, pin, stopPolling });

    getSupabaseBrowser().then((supabase) => {
      // Bail if Supabase is off, or the page already unsubscribed while the library loaded.
      if (!supabase || get().stopPolling !== stopPolling) return;

      const roomChannel: RealtimeChannel = supabase.channel(`room:${pin}`, { config: { broadcast: { ack: false } } });

      roomChannel
        .on('broadcast', { event: 'state_change' }, (msg: { payload: StateChangePayload }) => {
          const payload = msg.payload;
          const offset = payload.serverNowMs - Date.now();

          set((prev) => {
            const isNewQuestion =
              payload.status === 'QUESTION_ACTIVE' && payload.currentQuestionIndex !== prev.currentQuestionIndex;

            return {
              ...(isNewQuestion ? { selectedOption: null, isLocked: false } : {}),
              roomStatus: payload.status,
              currentQuestionIndex: payload.currentQuestionIndex,
              activeQuestion: payload.question ?? prev.activeQuestion,
              questionEndsAtMs: payload.questionEndsAtMs ?? null,
              reveal: payload.reveal ?? null,
              clockOffsetMs: offset,
            };
          });

          // Spread the 200 result requests over ~400ms so they don't all land at once.
          if (payload.status === 'ANSWER_REVEALED' && payload.reveal?.questionId) {
            const questionId = payload.reveal.questionId;
            setTimeout(() => get().fetchPersonalResult(pin, questionId), Math.random() * 400);
          }
        })
        .on('broadcast', { event: 'timer_sync' }, (msg: { payload: TimerSyncPayload }) => {
          const payload = msg.payload;
          if (!payload.questionEndsAtMs) return;
          set({
            questionEndsAtMs: payload.questionEndsAtMs,
            clockOffsetMs: payload.serverNowMs - Date.now(),
          });
        })
        .subscribe((status) => {
          const live = status === 'SUBSCRIBED';
          set({ realtimeLive: live, ...(live ? { isConnected: true, isReconnecting: false } : {}) });
        });
      set({ channel: roomChannel });
    });
  },

  cleanup: () => {
    const current = get();
    current.stopPolling?.();
    current.channel?.unsubscribe();
    set({ channel: null, isConnected: false, stopPolling: null, realtimeLive: false });
  },
}));

// Phone sounds: a ping when a question appears, and correct / not-correct at the reveal.
// Driven by state transitions, so poll and realtime updates never double a sound.
if (typeof window !== 'undefined') {
  usePlayerStore.subscribe((state, prev) => {
    if (!state.playerToken) return;

    const questionId = state.activeQuestion?.id;
    if (
      state.roomStatus === 'QUESTION_ACTIVE' &&
      questionId &&
      (prev.roomStatus !== 'QUESTION_ACTIVE' || prev.activeQuestion?.id !== questionId)
    ) {
      playPhoneQuestion();
    }

    if (state.roomStatus === 'ANSWER_REVEALED' && state.reveal && prev.roomStatus === 'QUESTION_ACTIVE') {
      if (state.selectedOption === state.reveal.correctOptionIndex) playCorrect();
      else playWrong();
    }
  });
}
