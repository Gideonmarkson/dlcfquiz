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
import { supabaseBrowser } from '@/lib/supabase/client';
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
  pollTimer: ReturnType<typeof setInterval> | null;
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
  pollTimer: null,
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
    const current = get();
    if (current.pollTimer) {
      clearInterval(current.pollTimer);
    }
    if (current.channel) {
      current.channel.unsubscribe();
    }

    // 1. Automatic Realtime Sync Heartbeat (1s interval)
    // Guarantees real-time screen updates without requiring manual browser refreshes
    const pollInterval = setInterval(async () => {
      const { playerToken } = get();
      if (!playerToken) return;

      try {
        const res = await fetch(`/api/play/session?pin=${pin}`, {
          headers: {
            'X-Player-Token': playerToken,
          },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!data || !data.roomSnapshot) return;

        const serverNow = data.roomSnapshot.serverNowMs;
        const localNow = Date.now();
        const offset = serverNow - localNow;
        const nextStatus = data.roomSnapshot.status;
        const nextQIdx = data.roomSnapshot.currentQuestionIndex;

        set((prev) => {
          const isNewQuestion =
            nextStatus === 'QUESTION_ACTIVE' &&
            nextQIdx !== prev.currentQuestionIndex;

          const resetSelection = isNewQuestion
            ? { selectedOption: null, isLocked: false, result: null }
            : {};

          const selectedOpt = isNewQuestion
            ? null
            : (data.lockedOptionForActiveQuestion ?? prev.selectedOption);

          return {
            ...resetSelection,
            roomStatus: nextStatus,
            currentQuestionIndex: nextQIdx,
            activeQuestion: data.activeQuestion ?? prev.activeQuestion,
            questionEndsAtMs: data.roomSnapshot.questionEndsAtMs ?? prev.questionEndsAtMs,
            reveal: data.reveal ?? prev.reveal,
            clockOffsetMs: offset,
            selectedOption: selectedOpt,
            isLocked: isNewQuestion ? false : (selectedOpt !== null ? true : prev.isLocked),
            isConnected: true,
            isReconnecting: false,
          };
        });

        // Automatically fetch personal result when revealed if not yet fetched
        if (nextStatus === 'ANSWER_REVEALED' && data.reveal?.questionId && !get().result) {
          get().fetchPersonalResult(pin, data.reveal.questionId);
        }
      } catch {
        // network jitter, silent
      }
    }, 1000);

    // 2. Supabase Realtime Broadcast Channel
    const roomChannel = supabaseBrowser.channel(`room:${pin}`, {
      config: {
        broadcast: { ack: false },
      },
    });

    roomChannel
      .on('broadcast', { event: 'state_change' }, (msg: { payload: StateChangePayload }) => {
        const payload = msg.payload;
        const serverNow = payload.serverNowMs;
        const localNow = Date.now();
        const offset = serverNow - localNow;

        set((prev) => {
          const isNewQuestion =
            payload.status === 'QUESTION_ACTIVE' &&
            payload.currentQuestionIndex !== prev.currentQuestionIndex;

          const resetSelection = isNewQuestion
            ? { selectedOption: null, isLocked: false, result: null }
            : {};

          return {
            ...resetSelection,
            roomStatus: payload.status,
            currentQuestionIndex: payload.currentQuestionIndex,
            activeQuestion: payload.question ?? prev.activeQuestion,
            questionEndsAtMs: payload.questionEndsAtMs ?? null,
            reveal: payload.reveal ?? null,
            clockOffsetMs: offset,
          };
        });

        // If newly revealed, jitter fetch personal result within 0-300ms
        if (payload.status === 'ANSWER_REVEALED' && payload.reveal?.questionId) {
          const jitter = Math.floor(Math.random() * 300);
          setTimeout(() => {
            get().fetchPersonalResult(pin, payload.reveal!.questionId);
          }, jitter);
        }
      })
      .on('broadcast', { event: 'timer_sync' }, (msg: { payload: TimerSyncPayload }) => {
        const payload = msg.payload;
        const serverNow = payload.serverNowMs;
        const localNow = Date.now();
        const offset = serverNow - localNow;
        set({
          questionEndsAtMs: payload.questionEndsAtMs,
          clockOffsetMs: offset,
        });
      })
      .subscribe((status) => {
        set({
          isConnected: status === 'SUBSCRIBED',
          isReconnecting: status === 'TIMED_OUT' || status === 'CHANNEL_ERROR',
        });
      });

    set({ channel: roomChannel, pin, pollTimer: pollInterval });
  },

  cleanup: () => {
    const current = get();
    if (current.pollTimer) {
      clearInterval(current.pollTimer);
    }
    if (current.channel) {
      current.channel.unsubscribe();
    }
    set({ channel: null, isConnected: false, pollTimer: null });
  },
}));
