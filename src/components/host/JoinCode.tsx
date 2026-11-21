'use client';

import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/** Join link for a game, using the live site's address (localhost falls back to production). */
export function getJoinUrl(pin: string) {
  const baseUrl =
    typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
      ? window.location.origin
      : 'https://dlcfquiz.vercel.app';
  return { baseUrl, joinUrl: `${baseUrl}/play?pin=${pin}`, displayHost: baseUrl.replace(/^https?:\/\//, '') };
}

/** QR code on a light tile so phone cameras read it reliably off a projector. */
export const JoinQr: React.FC<{ pin: string; className?: string }> = ({ pin, className = '' }) => (
  <div className={`rounded-[var(--radius-tile)] bg-page p-4 ${className}`}>
    <QRCodeSVG
      value={getJoinUrl(pin).joinUrl}
      size={320}
      level="M"
      bgColor="#f1ecdf"
      fgColor="#141735"
      className="block h-auto w-full"
      aria-label="QR code to join the game"
    />
  </div>
);

/** Full-screen join card the host can pop up mid-game for latecomers. */
export const JoinCodeOverlay: React.FC<{ pin: string; onClose: () => void }> = ({ pin, onClose }) => {
  const { displayHost } = getJoinUrl(pin);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Join this game"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink p-6 animate-enter"
    >
      <div className="flex flex-col items-center gap-8 text-center md:flex-row md:gap-14 md:text-left">
        <JoinQr pin={pin} className="w-[min(60vh,22rem)]" />
        <div>
          <p className="text-2xl text-muted">
            Scan the code, or go to <span className="text-page">{displayHost}</span> and enter
          </p>
          <p className="mt-2 font-display text-[clamp(4rem,12vw,9rem)] leading-none tracking-[0.06em] tabular-nums text-gilt">
            {pin}
          </p>
          <p className="mt-6 text-faint">Tap anywhere to close</p>
        </div>
      </div>
    </div>
  );
};
