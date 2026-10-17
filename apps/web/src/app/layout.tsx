import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'RunLime', template: '%s · RunLime' },
  description: 'The 5K race calendar and run tracker for Trinidad and Tobago.',
};

export const viewport: Viewport = { themeColor: '#14532D', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-TT">
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-white">
          Skip to content
        </a>
        <header className="bg-forest text-white">
          <nav aria-label="Main" className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="text-white no-underline text-xl font-bold">
              run<span className="text-lime">lime</span>
            </Link>
            <Link href="/races" className="text-white">
              Races
            </Link>
            <Link href="/organiser" prefetch={false} className="text-white">
              Organisers
            </Link>
            <Link href="/account" prefetch={false} className="text-white">
              Account
            </Link>
            <Link href="/support" className="text-white">
              Support
            </Link>
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl px-4 py-8 flex-1">
          {children}
        </main>
        <footer className="border-t border-line bg-surface">
          <nav aria-label="Legal" className="mx-auto max-w-5xl px-4 py-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/refunds">Refunds</Link>
            <Link href="/legal/moderation">Moderation</Link>
            <Link href="/legal/child-safety">Child safety</Link>
            <Link href="/legal/health">Health</Link>
            <Link href="/legal/community-times">Community times</Link>
            <Link href="/delete-account">Delete account</Link>
            <Link href="/support">Support</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
