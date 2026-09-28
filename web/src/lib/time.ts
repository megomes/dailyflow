import { DAY_CUTOFF_HOUR } from './config';

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
export function logicalDay(now: Date = new Date(), cutoffHour = DAY_CUTOFF_HOUR): string {
  const d = new Date(now);
  if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  return isoDate(d);
}

/** Minutes since the start of the logical day's calendar date (01:30 after midnight → 25:30 = 1530). */
export function minutesInLogicalDay(now: Date = new Date(), cutoffHour = DAY_CUTOFF_HOUR): number {
  const m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return now.getHours() < cutoffHour ? m + 1440 : m;
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

/** Weekday template for Monday–Friday, weekend template for Saturday and Sunday. */
export function templateIdForDate(iso: string): 'weekday' | 'weekend' {
  const dow = dateFromIso(iso).getDay();
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday';
}
