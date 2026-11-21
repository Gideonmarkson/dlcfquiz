'use client';

import { create } from 'zustand';
import {
  RoomStatus,
  AcademicLevel,
  HypeEmoji,
  HostQuestionDTO,
  RevealedAnswerDTO,
  LeaderboardEntryDTO,
  StateChangePayload,
  TimerSyncPayload,
  LobbyUpdatePayload,
  HypePayload,
} from '@/types/quiz';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { startAdaptivePoll } from '@/lib/adaptivePoll';
import { RealtimeChannel } from '@supabase/supabase-js';
import { playRevealChime, playPodiumFanfare } from '@/lib/audio';

export interface HostPlayerItem {
  id: string;
  nickname: string;
  academicLevel: AcademicLevel;
  totalScore: number;
  correctCount: number;
  isKicked: boolean;
}

export interface FloatingHypeItem {
  id: string;
  emoji: HypeEmoji;
  level: AcademicLevel;
  leftPercent: number;
}

interface HostStore {
  pin: string;
  title: string;
  status: RoomStatus;
  currentQuestionIndex: number;
  questionEndsAtMs: number | null;
  questions: HostQuestionDTO[];
  players: HostPlayerItem[];
  answeredCount: number;
  reveal: RevealedAnswerDTO | null;
  top5: LeaderboardEntryDTO[];
  podium: LeaderboardEntryDTO[];
  hypeQueue: FloatingHypeItem[];
  isConnected: boolean;
  soundEnabled: boolean;
  channel: RealtimeChannel | null;
  stopPolling: (() => void) | null;
  realtimeLive: boolean;

  setRoomState: (state: Partial<HostStore>) => void;
  addHype: (emoji: HypeEmoji, level: AcademicLevel) => void;
  removeHype: (id: string) => void;
  toggleSound: () => void;
  subscribeToRoom: (pin: string) => void;
  cleanup: () => void;
}

export const useHostStore = create<HostStore>((set, get) => ({
  pin: '',
  title: 'DLCF AFIT Live Bible Quiz',
  status: 'DRAFT',
  currentQuestionIndex: -1,
  questionEndsAtMs: null,
  questions: [],
  players: [],
  answeredCount: 0,
  reveal: null,
  top5: [],
  podium: [],
  hypeQueue: [],
  isConnected: false,
  soundEnabled: true,
  channel: null,
  stopPolling: null,
  realtimeLive: false,

  setRoomState: (newState) => set((prev) => ({ ...prev, ...newState })),

  addHype: (emoji, level) => {
    set((state) => {
      // Limit to 25 particles in DOM simultaneously
      if (state.hypeQueue.length >= 25) {
        return state;
      }
      const randomLeft = 65 + Math.random() * 30; // Cluster on right side of projector
      const item: FloatingHypeItem = {
        id: Math.random().toString(36).substring(2, 9),
        emoji,
        level,
        leftPercent: randomLeft,
      };
      return { hypeQueue: [...state.hypeQueue, item] };
    });
  },

  removeHype: (id) => {
    set((state) => ({
      hypeQueue: state.hypeQueue.filter((h) => h.id !== id),
    }));
  },

  toggleSound: () => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },

  subscribeToRoom: (pin: string) => {
    get().cleanup();

    const POLL_FAST_MS = 1000;
    const POLL_SAFETY_MS = 4000;
    let consecutiveFailures = 0;

    const stopPolling = startAdaptivePoll(
      async () => {
        try {
          const secret = typeof window !== 'undefined' ? localStorage.getItem(`dlcf_host_secret_${pin}`) : null;
          const headers: Record<string, string> = {};
          if (secret) headers['x-host-secret'] = secret;

          const res = await fetch(`/api/host/rooms/${pin}`, { headers, cache: 'no-store' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!data?.room) return;
          consecutiveFailures = 0;

          set((state) => {
            const nextStatus = data.room.status;
            if (state.status !== nextStatus) {
              if (nextStatus === 'ANSWER_REVEALED') playRevealChime();
              else if (nextStatus === 'GAME_OVER') playPodiumFanfare();
            }

            return {
              status: nextStatus,
              currentQuestionIndex: data.room.currentQuestionIndex,
              questionEndsAtMs: data.room.questionEndsAtMs ?? state.questionEndsAtMs,
              questions: data.questions ?? state.questions,
              players: data.players ?? state.players,
              answeredCount: data.answeredCount ?? state.answeredCount,
              reveal: data.reveal ?? state.reveal,
              top5: data.top5 ?? state.top5,
              podium: data.podium ?? state.podium,
              isConnected: true,
            };
          });
        } catch {
          consecutiveFailures++;
          if (consecutiveFailures >= 3 && !get().realtimeLive) set({ isConnected: false });
        }
      },
      () => (get().realtimeLive ? POLL_SAFETY_MS : POLL_FAST_MS),
    );

    set({ channel: null, pin, stopPolling });

    getSupabaseBrowser().then((supabase) => {
      // Bail if Supabase is off, or the page already unsubscribed while the library loaded.
      if (!supabase || get().stopPolling !== stopPolling) return;

      const roomChannel: RealtimeChannel = supabase.channel(`room:${pin}`, {
        config: { broadcast: { ack: false }, presence: { key: 'host' } },
      });

      roomChannel
        .on('broadcast', { event: 'state_change' }, (msg: { payload: StateChangePayload }) => {
          const payload = msg.payload;
          set((state) => {
            if (payload.status !== state.status) {
              if (payload.status === 'ANSWER_REVEALED') playRevealChime();
              else if (payload.status === 'GAME_OVER') playPodiumFanfare();
            }
            return {
              status: payload.status,
              currentQuestionIndex: payload.currentQuestionIndex,
              questionEndsAtMs: payload.questionEndsAtMs ?? null,
              reveal: payload.reveal ?? null,
              top5: payload.top5 ?? state.top5,
              podium: payload.podium ?? state.podium,
              answeredCount: payload.status === state.status ? state.answeredCount : 0,
            };
          });
        })
        .on('broadcast', { event: 'timer_sync' }, (msg: { payload: TimerSyncPayload }) => {
          const payload = msg.payload;
          // Answer submissions broadcast questionEndsAtMs: 0 — only take the count from those,
          // otherwise the host timer would jump to zero and end the question early.
          set((state) => ({
            answeredCount: Math.max(state.answeredCount, payload.answeredCount ?? 0),
            questionEndsAtMs: payload.questionEndsAtMs ? payload.questionEndsAtMs : state.questionEndsAtMs,
          }));
        })
        .on('broadcast', { event: 'lobby_update' }, (msg: { payload: LobbyUpdatePayload }) => {
          const payload = msg.payload;
          set((state) => {
            if (payload.action === 'join') {
              if (state.players.some((p) => p.id === payload.player.id)) return state;
              return {
                players: [
                  ...state.players,
                  {
                    id: payload.player.id,
                    nickname: payload.player.nickname,
                    academicLevel: payload.player.academicLevel,
                    totalScore: 0,
                    correctCount: 0,
                    isKicked: false,
                  },
                ],
              };
            }
            if (payload.action === 'kick') {
              return { players: state.players.filter((p) => p.id !== payload.player.id) };
            }
            return state;
          });
        })
        .on('broadcast', { event: 'hype' }, (msg: { payload: HypePayload }) => {
          get().addHype(msg.payload.e, msg.payload.l);
        })
        .subscribe((status) => {
          const live = status === 'SUBSCRIBED';
          set({ realtimeLive: live, ...(live ? { isConnected: true } : {}) });
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
