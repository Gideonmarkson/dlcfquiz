import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted so phones on campus data don't wait on a third-party font CDN.
const display = localFont({
  src: './fonts/Gloock-Regular.woff2',
  weight: '400',
  display: 'swap',
  variable: '--font-gloock',
});

const sans = localFont({
  src: './fonts/BricolageGrotesque-Variable.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-bricolage',
});

export const metadata: Metadata = {
  title: 'Bible Quiz · DLCF AFIT',
  description: 'Live Bible quiz for Deeper Life Campus Fellowship, AFIT Kaduna. Join from your phone with the PIN on the screen.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#141735',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body
        className="bg-ink text-page antialiased min-h-[100dvh]"
        style={{
          ['--font-display' as string]: 'var(--font-gloock), Georgia, serif',
          ['--font-sans' as string]: 'var(--font-bricolage), ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
