'use client';
import { track } from '../analytics';
import { getDB } from '../db';
import { savePrefs } from '../prefs';
import { syncNow } from '../sync';
import { addDays, cutoffHour, logicalDay } from '../time';

/** Client side of E9: asks the server to refresh events, then pulls them through the normal sync. */
export interface CalSyncResult { account: string; provider: string; events?: number; removed?: number; ms: number; error?: string }
export type CalStatus = { running: boolean; at: number | null; results: CalSyncResult[]; error: string | null };

let status: CalStatus = { running: false, at: null, results: [], error: null };
const subs = new Set<(s: CalStatus) => void>();
const set = (p: Partial<CalStatus>) => { status = { ...status, ...p }; subs.forEach(f => f(status)); };
export const subscribeCal = (f: (s: CalStatus) => void) => { subs.add(f); f(status); return () => { subs.delete(f); }; };
export const getCalStatus = () => status;

export async function hasCalendars() {
  return (await getDB().calendars.filter(c => !c.deleted).count()) > 0;
}

export async function syncCalendars(reason: string, opts: { refreshCalendars?: boolean; force?: boolean } = {}) {
  // The server syncs on its own too (when phone/widget/watch call it): it needs this device's zone.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const prefs = await getDB().prefs.get('prefs');
  if (prefs?.timeZone !== tz) await savePrefs({ timeZone: tz });
  if (status.running) return;
  if (!opts.force && !(await hasCalendars())) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  set({ running: true, error: null });
  const today = logicalDay();
  try {
    const res = await fetch('/api/calendars/sync', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, cutoff: cutoffHour(), from: addDays(today, -1), to: addDays(today, 14), refreshCalendars: !!opts.refreshCalendars }),
    });
    if (!res.ok) throw new Error(`calendar sync ${res.status}`);
    const body = (await res.json()) as { results: CalSyncResult[] };
    set({ running: false, at: Date.now(), results: body.results });
    for (const r of body.results) track('calendar_synced', { provider: r.provider, events: r.events ?? 0, removed: r.removed ?? 0, ms: r.ms, error: r.error ?? null, reason });
    await syncNow('calendar');
  } catch (e) {
    set({ running: false, error: String((e as Error).message) });
    track('calendar_synced', { error: String((e as Error).message).slice(0, 200), reason });
  }
}

/** Refresh on start and every 15 minutes while visible. */
export function startCalendarLoop() {
  void syncCalendars('boot');
  const t = setInterval(() => { if (document.visibilityState === 'visible') void syncCalendars('interval'); }, 15 * 60_000);
  return () => clearInterval(t);
}
