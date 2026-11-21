import Link from 'next/link';
import { ui } from '@/lib/ui';

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] flex flex-col px-5 sm:px-8">
      <div className="mx-auto w-full max-w-xl flex-1 flex flex-col pt-8 sm:pt-12">
        <p className="text-sm text-muted">Deeper Life Campus Fellowship, AFIT Kaduna</p>

        <div className="my-auto py-14">
          <h1 className="font-display text-[3.5rem] leading-[0.95] sm:text-[5.5rem] text-page">
            Bible Quiz
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            Enter the PIN on the hall screen to play from your phone. No sign-up, just your name and level.
          </p>

          {/* Plain GET form: works before any JavaScript has loaded on a slow connection */}
          <form action="/play" method="get" className="mt-10 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="home-pin" className="sr-only">
              Game PIN
            </label>
            <input
              id="home-pin"
              name="pin"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="off"
              placeholder="Game PIN"
              required
              className={`${ui.input} sm:max-w-[13rem] text-center sm:text-left text-2xl tracking-[0.2em] tabular-nums font-semibold placeholder:tracking-normal placeholder:text-lg placeholder:font-normal`}
            />
            <button type="submit" className={`${ui.btnPrimary} text-lg`}>
              Join quiz
            </button>
          </form>

          <p className="mt-8 text-muted">
            Running the quiz in the hall?{' '}
            <Link href="/host" className="text-gilt underline decoration-gilt/40 underline-offset-4 hover:decoration-gilt">
              Set up a game
            </Link>
          </p>
        </div>
      </div>

      <footer className="mx-auto w-full max-w-xl border-t border-rule py-6">
        <blockquote className="font-display text-lg leading-snug text-page/90">
          Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.
        </blockquote>
        <cite className="mt-2 block text-sm not-italic text-gilt">2 Timothy 2:15</cite>
      </footer>
    </main>
  );
}
