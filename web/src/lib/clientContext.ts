import { deviceId, deviceKind, previousScreen } from './analytics';
import { STAGE } from './config';
import { getDB } from './db';
import { getSyncState } from './sync';
import './native';

/**
 * Snapshot of the environment a note (or event) was written in, for debugging:
 * device, surface (installed app vs browser), layout, screen, network, app state.
 * Every field is best-effort; unsupported APIs are simply omitted.
 */
export interface ClientContext {
  device: { kind: string; os: string; browser: string; surface: 'pwa' | 'browser' | 'android-app'; layout: 'mobile' | 'desktop'; touchPoints: number; pointer: 'coarse' | 'fine'; memoryGb?: number; cores?: number };
  screen: { viewport: string; screen: string; dpr: number; orientation?: string; theme: string; reducedMotion: boolean };
  network: { online: boolean; type?: string; downlinkMbps?: number; rttMs?: number; saveData?: boolean };
  locale: { language: string; timezone: string; localTime: string };
  app: { version: string; stage: string; from: string; path: string; serviceWorker: boolean; sync: string; pendingChanges: number; lastSync: string | null; storageMb?: number };
  deviceId: string;
  userAgent: string;
}

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'local';

/** Version of the Android app (its WebView says it in the user agent: DailyFlowAndroid/0.4.0); null outside the app or on an old APK that only said “/1”. */
export function apkVersion(): string | null {
  if (typeof navigator === 'undefined') return null;
  const v = navigator.userAgent.match(/DailyFlowAndroid\/(\d+\.\d+(?:\.\d+)?)/);
  return v ? v[1] : null;
}

function os(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'unknown';
}

function browser(ua: string): string {
  const pick = (name: string, re: RegExp) => { const m = ua.match(re); return m ? `${name} ${m[1]}` : null; };
  return pick('Edge', /Edg\/(\d+)/) ?? pick('Samsung Internet', /SamsungBrowser\/(\d+)/) ?? pick('Firefox', /(?:Firefox|FxiOS)\/(\d+)/)
    ?? pick('Chrome', /(?:Chrome|CriOS)\/(\d+)/) ?? pick('Safari', /Version\/(\d+(?:\.\d+)?).*Safari/) ?? 'unknown';
}

export async function collectContext(): Promise<ClientContext> {
  const ua = navigator.userAgent;
  const mm = (q: string) => window.matchMedia(q).matches;
  const nav = navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }; deviceMemory?: number };
  const conn = nav.connection;
  const sync = getSyncState();
  let pendingChanges = sync.pending;
  try { pendingChanges = await getDB().outbox.count(); } catch { /* keep sync state value */ }
  let storageMb: number | undefined;
  try { const est = await navigator.storage?.estimate?.(); if (est?.usage != null) storageMb = Math.round(est.usage / 1024 / 1024 * 10) / 10; } catch { /* unsupported */ }

  return {
    device: {
      kind: deviceKind(),
      os: os(ua),
      browser: browser(ua),
      surface: window.ReactNativeWebView ? 'android-app' : mm('(display-mode: standalone)') || (navigator as Navigator & { standalone?: boolean }).standalone ? 'pwa' : 'browser',
      layout: mm('(max-width: 820px)') ? 'mobile' : 'desktop',
      touchPoints: navigator.maxTouchPoints ?? 0,
      pointer: mm('(pointer: coarse)') ? 'coarse' : 'fine',
      memoryGb: nav.deviceMemory,
      cores: navigator.hardwareConcurrency,
    },
    screen: {
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      screen: `${window.screen.width}×${window.screen.height}`,
      dpr: window.devicePixelRatio,
      orientation: window.screen.orientation?.type,
      theme: document.documentElement.getAttribute('data-theme') ?? 'dark',
      reducedMotion: mm('(prefers-reduced-motion: reduce)'),
    },
    network: {
      online: navigator.onLine,
      type: conn?.effectiveType,
      downlinkMbps: conn?.downlink,
      rttMs: conn?.rtt,
      saveData: conn?.saveData,
    },
    locale: {
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      localTime: new Date().toString().slice(0, 33),
    },
    app: {
      version: APP_VERSION,
      stage: STAGE,
      from: previousScreen() || 'direct',
      path: window.location.pathname,
      serviceWorker: !!navigator.serviceWorker?.controller,
      sync: sync.status,
      pendingChanges,
      lastSync: sync.lastSyncedAt,
      storageMb,
    },
    deviceId: deviceId(),
    userAgent: ua,
  };
}

/** One-line human summary: "Phone · iOS · Safari 18 · Installed app · 390×844 · 4g · dark". */
export function summarizeContext(c: Partial<ClientContext> | null | undefined): string {
  if (!c?.device) return '';
  const kind = { mobile: 'Phone', tablet: 'Tablet', desktop: 'Desktop' }[c.device.kind] ?? c.device.kind;
  return [
    kind, c.device.os, c.device.browser, c.device.surface === 'android-app' ? 'Android app' : c.device.surface === 'pwa' ? 'Installed app' : 'Browser',
    c.device.layout === 'mobile' && c.device.kind === 'desktop' ? 'mobile layout' : null,
    c.screen?.viewport, c.network ? (c.network.online ? c.network.type ?? 'online' : 'offline') : null, c.screen?.theme,
  ].filter(Boolean).join(' · ');
}
