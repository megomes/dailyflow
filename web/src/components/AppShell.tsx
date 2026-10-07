'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { BarChart3, CalendarDays, CheckSquare, History, MessageSquareText, Moon, Settings, Sun } from 'lucide-react';
import { m } from '@/i18n/en';
import { setScreen, track } from '@/lib/analytics';
import { APP_SEMVER, APP_VERSION, apkVersion } from '@/lib/clientContext';
import { useSyncState } from '@/lib/hooks';
import { syncNativeChrome } from '@/lib/native';
import { currentTheme, toggleTheme } from '@/lib/theme';
import { ContextMenuHost } from './ContextMenu';
import { LiveAgents } from './LiveAgents';
import { Palette } from './Palette';

const NAV = [
  { href: '/', label: m.nav.today, icon: CalendarDays, match: (p: string) => p === '/' || p.startsWith('/plan') || p.startsWith('/close') },
  { href: '/tasks', label: m.nav.tasks, icon: CheckSquare, match: (p: string) => p.startsWith('/tasks') },
  { href: '/history', label: m.nav.history, icon: History, match: (p: string) => p.startsWith('/history') || p.startsWith('/day') },
  { href: '/insights', label: m.nav.insights, icon: BarChart3, match: (p: string) => p.startsWith('/insights') },
  { href: '/notes', label: m.nav.notes, icon: MessageSquareText, match: (p: string) => p.startsWith('/notes'), tab: false },
  { href: '/settings', label: m.nav.settings, icon: Settings, match: (p: string) => p.startsWith('/settings') },
];

function screenName(path: string) {
  if (path === '/') return 'today';
  return path.replace(/^\//, '').replace(/\//g, '.');
}

const noop = () => () => {};

export function SyncBadge() {
  const s = useSyncState();
  const label = m.sync[s.status];
  // Which build this is (note: always say the version released): the web build, and the APK when inside the Android app.
  const apk = useSyncExternalStore(noop, apkVersion, () => null);
  return (
    <div className="sync" data-s={s.status} title={s.lastSyncedAt ? m.device.lastSync(new Date(s.lastSyncedAt).toLocaleTimeString()) : m.device.never}>
      <i />{label}{s.pending > 0 && s.status !== 'syncing' ? ` · ${s.pending}` : ''}
      <span className="ver tabular" title={`build ${APP_VERSION}${apk ? ` · apk ${apk}` : ''}`}>v{APP_SEMVER}</span>
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

function OfflineBanner() {
  const s = useSyncState();
  if (s.status !== 'offline') return null;
  return <div className="offline-banner" role="status">{m.offline.banner(s.pending)}</div>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const prev = useRef<string | null>(null);

  // Android app: no doubled insets, and the bars around the page in the theme's colors (follows theme changes).
  useEffect(() => {
    syncNativeChrome();
    window.addEventListener('df-theme', syncNativeChrome);
    return () => window.removeEventListener('df-theme', syncNativeChrome);
  }, []);

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
      <main className="main"><OfflineBanner />{children}</main>
      <Palette />
      <LiveAgents />
      <ContextMenuHost />
      <nav className="tabbar" aria-label="Main">
        {NAV.filter(n => n.tab !== false).map(n => (
          <Link key={n.href} href={n.href} aria-current={n.match(path) ? 'page' : undefined}>
            <n.icon size={20} strokeWidth={1.6} />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
