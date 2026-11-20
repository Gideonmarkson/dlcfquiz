import Link from 'next/link';
import { BookOpen, Users, Trophy, Flame, Monitor, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-12 relative overflow-hidden">
      {/* Background Accent Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-amber-500/10 via-blue-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Fellowship Brand Header */}
      <header className="flex flex-col items-center text-center gap-2 max-w-4xl mx-auto pt-4 z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 text-xs md:text-sm font-bold tracking-wide">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>Deeper Life Campus Fellowship • AFIT Kaduna</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-50 tracking-tight mt-2">
          DLCF AFIT <span className="text-amber-400">Live Bible Quiz</span>
        </h1>

        <p className="text-slate-400 text-sm md:text-lg max-w-2xl mt-1 leading-relaxed">
          Real-time, zero-login fellowship quiz platform. Compete with your peers, test your scriptural knowledge, and study God&apos;s Word with millisecond-accurate speed + accuracy scoring.
        </p>
      </header>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mx-auto my-8 z-10">
        {/* Student Action Card */}
        <Link
          href="/play"
          className="group flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-800/90 border-2 border-slate-700/80 hover:border-amber-400/80 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.01]"
        >
          <div className="flex flex-col gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                For Students & Fellowship Members
              </span>
              <h2 className="text-2xl font-black text-slate-100 group-hover:text-amber-300 transition-colors mt-1">
                Join Quiz as Student
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Scan the hall QR code or enter the 6-digit Room PIN. No account or email needed—join with your name and academic level (100L–500L).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm md:text-base mt-6 pt-4 border-t border-slate-700/60">
            <span>Enter Room & Play</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Host / Media Console Card */}
        <Link
          href="/host"
          className="group flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-800/90 border-2 border-slate-700/80 hover:border-blue-400/80 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.01]"
        >
          <div className="flex flex-col gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Monitor className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                For Media Team & Quizmasters
              </span>
              <h2 className="text-2xl font-black text-slate-100 group-hover:text-blue-300 transition-colors mt-1">
                Host / Media Console
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Upload questions via CSV or JSON, project the live PIN and QR code in the fellowship hall, track real-time answers, and reveal the Top 5 and podium.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-blue-400 font-extrabold text-sm md:text-base mt-6 pt-4 border-t border-slate-700/60">
            <span>Create Quiz Room</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Feature Highlights Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full mx-auto z-10 text-center">
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col items-center gap-1.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold text-slate-200">Zero-Auth Friction</span>
          <span className="text-[11px] text-slate-400">Join in &lt; 8 seconds</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col items-center gap-1.5">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold text-slate-200">Speed + Accuracy</span>
          <span className="text-[11px] text-slate-400">500–1,000 pts per round</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col items-center gap-1.5">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <span className="text-xs font-bold text-slate-200">Scripture Verification</span>
          <span className="text-[11px] text-slate-400">Verses verified live</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex flex-col items-center gap-1.5">
          <Flame className="w-5 h-5 text-red-400" />
          <span className="text-xs font-bold text-slate-200">Live HYPE Floats</span>
          <span className="text-[11px] text-slate-400">Zero database writes</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 pt-8 z-10">
        &ldquo;Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.&rdquo;
        <span className="block text-slate-400 font-bold mt-1">— 2 Timothy 2:15</span>
      </footer>
    </main>
  );
}
