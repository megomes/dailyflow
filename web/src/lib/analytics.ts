import { DEVICE_COOKIE, SESSION_IDLE_MS, STAGE } from './config';
import { getDB } from './db';
import { logicalDay } from './time';
import type { ProductEvent } from './types';

/**
 * Product analytics (spec §61–63): every meaningful interaction becomes an event stored
 * locally and uploaded by sync.ts. Kept separate from domain data on the server too.
 */
let screen = 'boot';
let sessionId = '';
let lastActivity = 0;
let sessionStart = 0;

export function deviceId(): string {
  if (typeof document === 'undefined') return 'server';
  const m = document.cookie.match(new RegExp(`(?:^|; )${DEVICE_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : 'unknown';
}

export function deviceKind(): ProductEvent['device'] {
  if (typeof window === 'undefined') return 'desktop';
  const w = Math.min(window.screen.width, window.innerWidth || window.screen.width);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && w < 700) return 'mobile';
  if (coarse) return 'tablet';
  return 'desktop';
}

export function setScreen(name: string) { screen = name; }
export function currentScreen() { return screen; }

function ensureSession(now: number) {
  if (!sessionId || now - lastActivity > SESSION_IDLE_MS) {
    if (sessionId) record('session_ended', { duration_s: Math.round((lastActivity - sessionStart) / 1000), reason: 'idle' }, now, false);
    sessionId = crypto.randomUUID();
    sessionStart = now;
    lastActivity = now;
    record('session_started', { device: deviceKind() }, now, false);
  }
  lastActivity = now;
}

function record(event: string, props: Record<string, unknown>, now: number, touch = true) {
  if (touch) ensureSession(now);
  const e: ProductEvent = {
    id: crypto.randomUUID(),
    ts: new Date(now).toISOString(),
    day: logicalDay(new Date(now)),
    stage: STAGE,
    sessionId,
    deviceId: deviceId(),
    device: deviceKind(),
    screen,
    event,
    props,
    synced: 0,
  };
  getDB().events.add(e).catch(() => { /* storage full or blocked: never break the UI for analytics */ });
  return e;
}

export function track(event: string, props: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  record(event, props, Date.now());
}

/** Called when the page is hidden: closes the session so its duration is known. */
export function endSession(reason: string) {
  if (!sessionId) return;
  record('session_ended', { duration_s: Math.round((Date.now() - sessionStart) / 1000), reason }, Date.now(), false);
  sessionId = '';
}

export function installErrorLogging() {
  window.addEventListener('error', e => track('error_logged', { where: 'window', message: String(e.message).slice(0, 300) }));
  window.addEventListener('unhandledrejection', e => track('error_logged', { where: 'promise', message: String((e.reason && e.reason.message) || e.reason).slice(0, 300) }));
}
