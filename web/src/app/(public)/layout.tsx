import Link from 'next/link';
import type { ReactNode } from 'react';

/** Public pages (no session): home, privacy policy and terms, linked from the Google OAuth consent screen. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="legal">
      <header className="legal-head">
        <Link href="/about" className="legal-brand"><img src="/brand/logo-120.png" alt="" width={32} height={32} />DailyFlow</Link>
        <nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav>
      </header>
      <article>{children}</article>
      <footer className="hint">DailyFlow · personal time manager · <Link href="/login">Sign in</Link></footer>
    </main>
  );
}
