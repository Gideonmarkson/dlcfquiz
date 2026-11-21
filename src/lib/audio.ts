/**
 * Small synthesized sound set (Web Audio, no audio files to download).
 *
 * Where sounds play:
 *   Projector: player joins (lobby), question starts, last 5 seconds, answer reveal,
 *              standings, final results.
 *   Phones:    new question, answer locked in, correct / not correct.
 * Everything else stays quiet on purpose.
 */

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let soundEnabled = true;

const STORAGE_KEY = 'dlcf_sound_on';

if (typeof window !== 'undefined') {
  try {
    soundEnabled = localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    // storage unavailable: keep default
  }

  // Browsers only allow audio after a tap/click/key. Unlock on the first one,
  // so sounds work even after a page reload mid-game.
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    }
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function setAudioEnabled(enabled: boolean) {
  soundEnabled = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function isAudioEnabled(): boolean {
  return soundEnabled;
}

type ToneOpts = {
  freq: number;
  start?: number; // seconds from now
  dur?: number; // seconds
  type?: OscillatorType;
  vol?: number;
  slideTo?: number; // glide frequency to this by the end
};

function tone({ freq, start = 0, dur = 0.2, type = 'sine', vol = 0.1, slideTo }: ToneOpts) {
  const ctx = getAudioContext();
  if (!ctx || !master || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + start;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);

  // Short attack avoids clicks; exponential release sounds natural.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function play(fn: () => void) {
  if (!soundEnabled) return;
  try {
    fn();
  } catch {
    // never let a sound break the game
  }
}

// ---------------------------------------------------------------------------
// Projector

let lastJoinBlip = 0;
/** Soft pop when someone joins the lobby (throttled so a rush of joins isn't noisy). */
export function playJoinBlip() {
  const now = Date.now();
  if (now - lastJoinBlip < 350) return;
  lastJoinBlip = now;
  play(() => {
    tone({ freq: 880, dur: 0.12, vol: 0.06 });
    tone({ freq: 1320, start: 0.06, dur: 0.14, vol: 0.04 });
  });
}

/** Rising two-note cue: a new question is on screen. */
export function playQuestionStart() {
  play(() => {
    tone({ freq: 587.33, dur: 0.18, type: 'triangle', vol: 0.09 }); // D5
    tone({ freq: 880, start: 0.12, dur: 0.32, type: 'triangle', vol: 0.09 }); // A5
  });
}

/** One tick per second for the last 5 seconds only. */
export function playUrgentTick(secondsLeft = 5) {
  play(() => {
    const pitch = secondsLeft <= 2 ? 1250 : 1000;
    tone({ freq: pitch, dur: 0.07, type: 'triangle', vol: 0.1, slideTo: pitch * 0.6 });
  });
}

/** Kept for compatibility: earlier seconds are silent now. */
export function playCountdownTick() {}

/** Bright chord when the answer is revealed. */
export function playRevealChime() {
  play(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone({ freq, start: i * 0.06, dur: 0.5, vol: 0.08 })
    );
  });
}

/** Short build-up when the standings come up. */
export function playStandings() {
  play(() => {
    [392, 493.88, 587.33].forEach((freq, i) =>
      tone({ freq, start: i * 0.09, dur: 0.22, type: 'triangle', vol: 0.07 })
    );
  });
}

/** Fanfare for the final podium. */
export function playPodiumFanfare() {
  play(() => {
    const notes = [
      { freq: 523.25, start: 0.0, dur: 0.15 },
      { freq: 523.25, start: 0.18, dur: 0.15 },
      { freq: 523.25, start: 0.36, dur: 0.15 },
      { freq: 659.25, start: 0.54, dur: 0.4 },
      { freq: 783.99, start: 0.98, dur: 0.2 },
      { freq: 1046.5, start: 1.22, dur: 0.8 },
    ];
    notes.forEach((n) => tone({ ...n, type: 'triangle', vol: 0.12 }));
    // soft harmony under the last note
    tone({ freq: 659.25, start: 1.22, dur: 0.8, vol: 0.05 });
    tone({ freq: 783.99, start: 1.22, dur: 0.8, vol: 0.05 });
  });
}

// ---------------------------------------------------------------------------
// Phones (quieter)

/** Gentle ping so players look down: a new question is on their phone. */
export function playPhoneQuestion() {
  play(() => tone({ freq: 784, dur: 0.16, vol: 0.06, type: 'triangle' }));
}

/** Tiny click confirming the answer was locked in. */
export function playTap() {
  play(() => tone({ freq: 660, dur: 0.06, vol: 0.07, slideTo: 520 }));
}

/** Two rising notes for a correct answer. */
export function playCorrect() {
  play(() => {
    tone({ freq: 659.25, dur: 0.14, vol: 0.09, type: 'triangle' });
    tone({ freq: 987.77, start: 0.1, dur: 0.3, vol: 0.09, type: 'triangle' });
  });
}

/** Low, soft falling tone for a wrong or missed answer (not a harsh buzzer). */
export function playWrong() {
  play(() => tone({ freq: 330, dur: 0.35, vol: 0.08, type: 'sine', slideTo: 220 }));
}
