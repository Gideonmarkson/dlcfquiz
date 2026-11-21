/** Shared class strings so every screen uses the same controls. */
export const ui = {
  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-gilt px-5 py-3 font-semibold text-ink transition-colors hover:bg-[#e6c675] active:bg-gilt-deep disabled:cursor-not-allowed disabled:opacity-40',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-rule px-5 py-3 font-medium text-page transition-colors hover:bg-cover-2 disabled:cursor-not-allowed disabled:opacity-40',
  btnQuiet:
    'inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-cover-2 hover:text-page',
  input:
    'w-full rounded-[var(--radius-control)] border border-rule bg-cover px-3.5 py-3 text-base text-page placeholder:text-faint transition-colors focus:border-gilt focus:outline-none',
  label: 'text-sm font-medium text-muted',
  surface: 'rounded-[var(--radius-tile)] border border-rule bg-cover',
};

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Background + text colour for each answer, used identically on phones and the projector. */
export const OPTION_STYLES = [
  { bg: 'bg-opt-a', text: 'text-ink', ring: 'ring-opt-a' },
  { bg: 'bg-opt-b', text: 'text-page', ring: 'ring-opt-b' },
  { bg: 'bg-opt-c', text: 'text-page', ring: 'ring-opt-c' },
  { bg: 'bg-opt-d', text: 'text-ink', ring: 'ring-opt-d' },
] as const;
