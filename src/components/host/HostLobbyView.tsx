'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Play, UserX, Copy, Check } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';

interface HostLobbyViewProps {
  onStartQuiz: () => void;
  isStarting: boolean;
}

export const HostLobbyView: React.FC<HostLobbyViewProps> = ({ onStartQuiz, isStarting }) => {
  const pin = useHostStore((s) => s.pin);
  const players = useHostStore((s) => s.players);
  const questions = useHostStore((s) => s.questions);
  const [copied, setCopied] = useState(false);

  const baseUrl =
    typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? window.location.origin
      : 'https://dlcfquiz.vercel.app';
  const joinUrl = `${baseUrl}/play?pin=${pin}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKickPlayer = async (playerId: string) => {
    try {
      await fetch(`/api/host/rooms/${pin}/players/${playerId}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('Failed to kick player', e);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto py-4">
      {/* Top Banner: PIN & QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur">
        {/* Left: Join Instructions & Huge PIN */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider">
              Fellowship Lobby Open
            </span>
            <span className="text-slate-400 text-xs md:text-sm">
              Scan QR code or visit <span className="text-slate-200 font-mono font-semibold">{baseUrl}/play</span>
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs md:text-sm font-semibold uppercase tracking-widest text-slate-400">
              Room PIN
            </span>
            <div className="text-6xl md:text-7xl xl:text-8xl font-black text-amber-400 tracking-[0.25em] tabular-nums drop-shadow-[0_0_35px_rgba(245,158,11,0.25)]">
              {pin}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs md:text-sm rounded-xl font-medium transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copied!' : 'Copy Student Join Link'}</span>
            </button>
            <span className="text-xs text-slate-400">
              {questions.length} questions loaded & ready
            </span>
          </div>
        </div>

        {/* Right: Crisp SVG QR Code */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          <div className="p-4 bg-white rounded-3xl shadow-xl border-4 border-amber-400/40">
            <QRCodeSVG
              value={joinUrl}
              size={220}
              level="H"
              includeMargin={false}
              className="rounded-xl"
            />
          </div>
          <span className="text-slate-400 text-xs mt-3 font-semibold uppercase tracking-wider">
            Point Phone Camera to Join
          </span>
        </div>
      </div>

      {/* Connected Roster Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg md:text-xl font-bold text-slate-100">
              Joined Students ({players.length})
            </h3>
          </div>

          <button
            type="button"
            disabled={players.length === 0 || isStarting}
            onClick={onStartQuiz}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-bold text-base md:text-lg rounded-2xl shadow-lg transition active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{isStarting ? 'Starting...' : `Start Quiz (${questions.length} Qs)`}</span>
          </button>
        </div>

        {/* Roster Grid */}
        {players.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-700/80 rounded-3xl bg-slate-800/30 text-slate-400 flex flex-col items-center justify-center gap-2">
            <Users className="w-8 h-8 text-slate-500 animate-pulse" />
            <p className="text-base font-semibold">Waiting for students to join...</p>
            <p className="text-xs text-slate-500">Students will appear here with their academic levels as they connect.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[360px] overflow-y-auto p-1">
            {players.map((p) => (
              <div
                key={p.id}
                className="group flex items-center justify-between p-3 rounded-2xl bg-slate-800 border border-slate-700 hover:border-slate-500 transition shadow-sm"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-semibold text-slate-100 text-sm truncate">
                    {p.nickname}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <AcademicLevelBadge level={p.academicLevel} size="sm" />
                  <button
                    type="button"
                    onClick={() => handleKickPlayer(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition p-1"
                    title="Remove student"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
