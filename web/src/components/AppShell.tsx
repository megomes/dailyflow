'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { CalendarDays, MessageSquareText, Moon, Settings, Sun } from 'lucide-react';
import { m } from '@/i18n/en';
import { setScreen, track } from '@/lib/analytics';
import { useSyncState } from '@/lib/hooks';
import { currentTheme, toggleTheme } from '@/lib/theme';

const NAV = [
  { href: '/', label: m.nav.today, icon: CalendarDays, match: (p: string) => p === '/' },
  { href: '/notes', label: m.nav.notes, icon: MessageSquareText, match: (p: string) => p.startsWith('/notes') },
  { href: '/settings', label: m.nav.settings, icon: Settings, match: (p: string) => p.startsWith('/settings') },
];

function screenName(path: string) {
  if (path === '/') return 'today';
  return path.replace(/^\//, '').replace(/\//g, '.');
}

export function SyncBadge() {
  const s = useSyncState();
  const label = m.sync[s.status];
  return (
    <div className="sync" data-s={s.status} title={s.lastSyncedAt ? m.device.lastSync(new Date(s.lastSyncedAt).toLocaleTimeString()) : m.device.never}>
      <i />{label}{s.pending > 0 && s.status !== 'syncing' ? ` · ${s.pending}` : ''}
    </div>
  );
}

function subscribeTheme(cb: () => void) {
  window.addEventListener('df-theme', cb);
  return () => window.removeEventListener('df-theme', cb);
}

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'dark' as const);
  const Icon = theme === 'dark' ? Sun : Moon;
  const label = theme === 'dark' ? m.device.light : m.device.dark;
  return (
    <button ref={ref} type="button" className={withLabel ? 'btn sm' : 'btn icon sm ghost'} onClick={() => toggleTheme(ref.current)} title={label} aria-label={label}>
      <Icon size={15} strokeWidth={1.75} />{withLabel && label}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const name = screenName(path);
    setScreen(name);
    track('screen_viewed', { screen: name, from: prev.current });
    prev.current = name;
    // On phones the content area (not the window) scrolls: start each screen at the top.
    document.querySelector('.main')?.scrollTo(0, 0);
  }, [path]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><img src="/icon-192.png" alt="" />{m.app.name}</div>
        <nav className="nav" aria-label="Main">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className="nav-item" aria-current={n.match(path) ? 'page' : undefined}>
              <n.icon size={18} strokeWidth={1.6} />{n.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="row"><SyncBadge /><span className="spacer" /><ThemeToggle /></div>
        </div>
      </aside>
      <main className="main">{children}</main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map(n => (
          <Link key={n.href} href={n.href} aria-current={n.match(path) ? 'page' : undefined}>
            <n.icon size={20} strokeWidth={1.6} />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
