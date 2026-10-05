import { DAY_CUTOFF_HOUR } from './config';

/** Hour the logical day turns over. Configurable in Settings (synced pref); read everywhere through here. */
let cutoff = DAY_CUTOFF_HOUR;
export function setCutoffHour(h: number) { if (Number.isInteger(h) && h >= 0 && h <= 8) cutoff = h; }
export function cutoffHour() { return cutoff; }

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Minutes since midnight → "HH:MM". Values ≥ 24h wrap (used for blocks past midnight). */
export function fmtMin(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** "HH:MM" → minutes since midnight. Returns null for invalid input. */
export function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 24 || mm > 59 || (h === 24 && mm > 0)) return null;
  return h * 60 + mm;
}

/** Duration in minutes → "1h30", "45m", "2h". */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h${pad2(r)}` : `${h}h`;
}

export const snap = (min: number, step: number) => Math.round(min / step) * step;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The logical day a moment belongs to: before the cutoff hour it is still the previous day. */
export function logicalDay(now: Date = new Date(), hour = cutoff): string {
  const d = new Date(now);
  if (d.getHours() < hour) d.setDate(d.getDate() - 1);
  return isoDate(d);
}

/** Minutes since the start of the logical day's calendar date (01:30 after midnight → 25:30 = 1530). */
export function minutesInLogicalDay(now: Date = new Date(), hour = cutoff): number {
  const m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return now.getHours() < hour ? m + 1440 : m;
}

export function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = dateFromIso(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKeyT = (typeof DAY_KEYS)[number];

/** Each day of the week has its own template. */
export function templateIdForDate(iso: string): DayKeyT {
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[dateFromIso(iso).getDay()];
}

/** Absolute Date of a minute inside a logical day (minutes may exceed 1440). */
export function dateAtMinute(dayIso: string, min: number): Date {
  const d = dateFromIso(dayIso);
  d.setMinutes(Math.round(min));
  return d;
}

/** Minute inside a given logical day for an absolute moment (can be negative or past 1440). */
export function minuteOfDay(dayIso: string, at: Date): number {
  return (at.getTime() - dateFromIso(dayIso).getTime()) / 60000;
}

/** Elapsed "1:02:03" or "12:03" for timers. */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;
}
