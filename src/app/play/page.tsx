import React, { Suspense } from 'react';
import Link from 'next/link';
import { JoinRoomForm } from '@/components/player/JoinRoomForm';

export default function PlayJoinPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col px-5">
      <header className="mx-auto flex w-full max-w-md items-center justify-between py-5">
        <Link href="/" className="font-display text-xl text-page hover:text-gilt transition-colors">
          Bible Quiz
        </Link>
        <span className="text-sm text-faint">DLCF AFIT</span>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 pb-10 pt-4">
        <Suspense fallback={<p className="py-10 text-muted">Loading…</p>}>
          <JoinRoomForm />
        </Suspense>
      </div>
    </main>
  );
}
