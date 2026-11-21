/**
 * Polls `task` on a self-scheduling timer instead of setInterval:
 * - the next poll is only scheduled after the previous one finishes (no pile-ups on slow networks)
 * - the delay is re-read every time, so it can speed up or slow down (e.g. when realtime connects)
 * - polling pauses while the tab/phone screen is hidden and fires immediately when it's visible again
 */
export function startAdaptivePoll(task: () => Promise<void>, getDelayMs: () => number): () => void {
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const isHidden = () => typeof document !== 'undefined' && document.hidden;

  const schedule = () => {
    if (stopped || isHidden()) return;
    clearTimeout(timer);
    timer = setTimeout(run, getDelayMs());
  };

  async function run() {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      await task();
    } catch {
      // Network blips are expected on campus data; the next poll retries.
    } finally {
      inFlight = false;
      schedule();
    }
  }

  const onVisibility = () => {
    if (!isHidden()) {
      clearTimeout(timer);
      run();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }
  run();

  return () => {
    stopped = true;
    clearTimeout(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
