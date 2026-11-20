'use client';

import React from 'react';
import { Trophy, Download, RotateCcw, Crown, Medal, Home, ArrowLeft } from 'lucide-react';
import { useHostStore } from '@/store/useHostStore';
import { AcademicLevelBadge } from '@/components/shared/AcademicLevelBadge';

export const HostPodiumView: React.FC = () => {
  const pin = useHostStore((s) => s.pin);
  const podium = useHostStore((s) => s.podium);
  const top5 = useHostStore((s) => s.top5);

  const standings = podium.length > 0 ? podium : top5;
  const first = standings[0];
  const second = standings[1];
  const third = standings[2];
  const runnersUp = standings.slice(3, 10);

  const handleExportCsv = () => {
    window.location.href = `/api/host/rooms/${pin}/export`;
  };

  return (
    <div className="flex flex-col gap-10 w-full max-w-5xl mx-auto py-4">
      {/* Top Banner */}
      <div className="text-center flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full font-bold text-xs uppercase tracking-widest">
          <Crown className="w-4 h-4" /> DLCF AFIT Championship Podium
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-slate-100">
          Glory to God! Quiz Completed!
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-md">
          Congratulations to our top Bible scholars and every participating student.
        </p>
      </div>

      {/* Top 3 Podium Visual */}
      <div className="grid grid-cols-3 gap-3 md:gap-6 items-end justify-center min-h-[300px] md:min-h-[360px] pt-8">
        {/* 2nd Place (Silver) */}
        {second ? (
          <div className="flex flex-col items-center gap-3 animate-podium-rise" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-col items-center text-center">
              <Medal className="w-8 h-8 text-slate-300 drop-shadow mb-1" />
              <span className="font-extrabold text-slate-200 text-sm md:text-xl truncate max-w-[120px] md:max-w-[180px]">
                {second.nickname}
              </span>
              <AcademicLevelBadge level={second.academicLevel} size="sm" className="mt-1" />
              <span className="text-xs md:text-sm font-black text-amber-400 mt-1 tabular-nums">
                {second.totalScore.toLocaleString()} pts
              </span>
            </div>
            <div className="w-full h-36 md:h-48 rounded-t-3xl bg-gradient-to-t from-slate-800 to-slate-700/80 border-t-4 border-slate-300 flex items-center justify-center shadow-2xl">
              <span className="text-4xl md:text-6xl font-black text-slate-400/40">2</span>
            </div>
          </div>
        ) : <div />}

        {/* 1st Place (Gold - Elevated) */}
        {first ? (
          <div className="flex flex-col items-center gap-3 animate-podium-rise">
            <div className="flex flex-col items-center text-center">
              <Crown className="w-10 h-10 text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-bounce mb-1" />
              <span className="font-black text-amber-400 text-base md:text-2xl truncate max-w-[140px] md:max-w-[220px]">
                {first.nickname}
              </span>
              <AcademicLevelBadge level={first.academicLevel} size="md" className="mt-1" />
              <span className="text-sm md:text-lg font-black text-amber-300 mt-1 tabular-nums">
                {first.totalScore.toLocaleString()} pts
              </span>
            </div>
            <div className="w-full h-48 md:h-64 rounded-t-3xl bg-gradient-to-t from-amber-950 to-amber-600/60 border-t-4 border-amber-400 flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-400/10 pointer-events-none" />
              <span className="text-5xl md:text-8xl font-black text-amber-400/50">1</span>
            </div>
          </div>
        ) : <div />}

        {/* 3rd Place (Bronze) */}
        {third ? (
          <div className="flex flex-col items-center gap-3 animate-podium-rise" style={{ animationDelay: '0.4s' }}>
            <div className="flex flex-col items-center text-center">
              <Medal className="w-7 h-7 text-amber-700 drop-shadow mb-1" />
              <span className="font-extrabold text-amber-600 text-sm md:text-xl truncate max-w-[120px] md:max-w-[180px]">
                {third.nickname}
              </span>
              <AcademicLevelBadge level={third.academicLevel} size="sm" className="mt-1" />
              <span className="text-xs md:text-sm font-black text-amber-400 mt-1 tabular-nums">
                {third.totalScore.toLocaleString()} pts
              </span>
            </div>
            <div className="w-full h-28 md:h-36 rounded-t-3xl bg-gradient-to-t from-slate-900 to-amber-950/70 border-t-4 border-amber-700 flex items-center justify-center shadow-2xl">
              <span className="text-3xl md:text-5xl font-black text-amber-800/40">3</span>
            </div>
          </div>
        ) : <div />}
      </div>

      {/* Runners-up (#4 - #10) */}
      {runnersUp.length > 0 && (
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl backdrop-blur">
          <h3 className="text-base font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Runners Up (Ranks #4 - #{runnersUp.length + 3})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {runnersUp.map((r, i) => (
              <div
                key={r.playerId}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 w-5">#{i + 4}</span>
                  <span className="font-bold text-slate-200 text-sm">{r.nickname}</span>
                  <AcademicLevelBadge level={r.academicLevel} size="sm" />
                </div>
                <span className="text-xs font-bold text-amber-400 tabular-nums">
                  {r.totalScore.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-Game Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm md:text-base rounded-2xl shadow-lg transition active:scale-95"
        >
          <Download className="w-5 h-5" />
          <span>Export Full Results CSV</span>
        </button>

        <a
          href="/host"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm md:text-base rounded-2xl shadow transition active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
          <span>Host Another Quiz</span>
        </a>

        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm md:text-base rounded-2xl shadow transition active:scale-95"
        >
          <Home className="w-5 h-5" />
          <span>Back to Home</span>
        </a>
      </div>
    </div>
  );
};
