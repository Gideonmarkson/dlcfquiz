import React, { Suspense } from 'react';
import { JoinRoomForm } from '@/components/player/JoinRoomForm';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function PlayJoinPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-72 bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between max-w-md w-full mx-auto pt-2 z-10">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-sm text-slate-200 group-hover:text-amber-400 transition-colors">
            DLCF AFIT Quiz
          </span>
        </Link>
        <span className="text-[11px] font-semibold text-slate-500">Zero-Login Arena</span>
      </header>

      {/* Join Form Component wrapped in Suspense */}
      <div className="flex-1 flex items-center justify-center my-6 z-10">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center gap-3 p-8">
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400 font-semibold">Loading arena...</span>
            </div>
          }
        >
          <JoinRoomForm />
        </Suspense>
      </div>

      {/* Footer Quote */}
      <footer className="text-center text-[11px] text-slate-500 pb-2 z-10">
        Deeper Life Campus Fellowship, AFIT Kaduna • 2 Timothy 2:15
      </footer>
    </main>
  );
}
