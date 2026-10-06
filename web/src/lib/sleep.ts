import { addDays, isoDate, minuteOfDay } from './time';
import type { Sleep } from './types';

/**
 * Sleep (note #29): nights are their own records, not blocks. Pure helpers for the timeline,
 * the Now card and Insights. Minutes are counted from 00:00 of a date, so 03:10 after midnight
 * is 1630 for the night before and an 08:20 wake-up is 1940.
 */

export const DEFAULT_TARGET = { bed: 22 * 60, wake: 6 * 60 };
export type SleepTarget = typeof DEFAULT_TARGET;

/** The night a bedtime belongs to: anything from noon to noon next day (bed at 03:00 or 05:00 is still last night). */
export function nightOf(start: Date): string {
  return isoDate(new Date(start.getTime() - 12 * 3600_000));
}

export function sleepMinutes(s: Pick<Sleep, 'start' | 'end'>, now = Date.now()): number {
  return Math.max(0, ((s.end ? Date.parse(s.end) : now) - Date.parse(s.start)) / 60000);
}

/** Planned length of a night from the target (22:00 → 06:00 = 8h). */
export function targetMinutes(t: SleepTarget): number {
  return ((t.wake - t.bed) % 1440 + 1440) % 1440 || 1440;
}

/** Target bedtime and wake-up of a night, in that night's minutes (wake-up goes past 1440). */
export function targetSpan(t: SleepTarget): { bed: number; wake: number } {
  const bed = t.bed < 12 * 60 ? t.bed + 1440 : t.bed;
  return { bed, wake: bed + targetMinutes(t) };
}

/** A night, not a nap: starts in the evening/at night, or lasts 3h or more. */
export function isNight(s: Pick<Sleep, 'start' | 'end'>): boolean {
  const h = new Date(s.start).getHours();
  return h >= 18 || h < 7 || !s.end || sleepMinutes(s) >= 180;
}

/** The main sleep of each night (the longest; naps never count as the night). */
export function mainSleeps(sleeps: Sleep[]): Map<string, Sleep> {
  const out = new Map<string, Sleep>();
  for (const s of sleeps) {
    if (s.deleted || !isNight(s)) continue;
    const cur = out.get(s.night);
    if (!cur || sleepMinutes(s) > sleepMinutes(cur)) out.set(s.night, s);
  }
  return out;
}

export interface SleepBand {
  id: string;
  sleepId: string;
  /** Minutes in the logical day being drawn. */
  start: number;
  end: number;
  part: 'morning' | 'night';
  sleep: Sleep;
}

/**
 * What a day's timeline shows: the end of last night (until the wake-up) and the start of tonight
 * (from bedtime), clipped to the logical day [cutoff, 24h + cutoff].
 */
export function sleepBands(day: string, sleeps: Sleep[], cutoffHour: number, now = new Date()): SleepBand[] {
  const lo = cutoffHour * 60, hi = 1440 + cutoffHour * 60;
  const out: SleepBand[] = [];
  const nights = mainSleeps(sleeps);
  const last = nights.get(addDays(day, -1));
  if (last) {
    const end = last.end ? minuteOfDay(day, new Date(last.end)) : minuteOfDay(day, now);
    const start = Math.max(lo, minuteOfDay(day, new Date(last.start)));
    if (end > lo + 5) out.push({ id: `sleep:${last.id}:am`, sleepId: last.id, start, end: Math.min(hi, end), part: 'morning', sleep: last });
  }
  const tonight = nights.get(day);
  if (tonight) {
    const start = minuteOfDay(day, new Date(tonight.start));
    const end = Math.min(hi, tonight.end ? minuteOfDay(day, new Date(tonight.end)) : Math.max(start + 30, minuteOfDay(day, now)));
    if (start < hi && end > start) out.push({ id: `sleep:${tonight.id}:pm`, sleepId: tonight.id, start: Math.max(lo, start), end, part: 'night', sleep: tonight });
  }
  return out;
}

export interface NightRow {
  night: string;
  bed: number;
  wake: number;
  minutes: number;
  stages?: Sleep['stages'];
  source: Sleep['source'];
}

export interface SleepStats {
  rows: NightRow[];
  avgMinutes: number;
  avgBed: number;
  avgWake: number;
  /** Mean distance from the average, in minutes: how regular bedtime and wake-up are. */
  bedSpread: number;
  wakeSpread: number;
  /** Minutes short of the target, summed over the nights logged. */
  debt: number;
  target: number;
  stages: { deep: number; light: number; rem: number; awake: number } | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const spread = (xs: number[]) => { const m = mean(xs); return mean(xs.map(x => Math.abs(x - m))); };

/** Nights in [from, to] (by night date). Ongoing sleep is left out. */
export function sleepStats(sleeps: Sleep[], from: string, to: string, t: SleepTarget = DEFAULT_TARGET): SleepStats {
  const rows: NightRow[] = [...mainSleeps(sleeps.filter(s => s.end)).values()]
    .filter(s => s.night >= from && s.night <= to)
    .sort((a, b) => a.night.localeCompare(b.night))
    .map(s => ({
      night: s.night,
      bed: minuteOfDay(s.night, new Date(s.start)),
      wake: minuteOfDay(s.night, new Date(s.end!)),
      minutes: sleepMinutes(s),
      stages: s.stages,
      source: s.source,
    }));
  const target = targetMinutes(t);
  const staged = rows.filter(r => r.stages);
  const sum = (k: keyof NonNullable<Sleep['stages']>) => mean(staged.map(r => r.stages![k]));
  return {
    rows,
    avgMinutes: mean(rows.map(r => r.minutes)),
    avgBed: mean(rows.map(r => r.bed)),
    avgWake: mean(rows.map(r => r.wake)),
    bedSpread: spread(rows.map(r => r.bed)),
    wakeSpread: spread(rows.map(r => r.wake)),
    debt: rows.reduce((d, r) => d + Math.max(0, target - r.minutes), 0),
    target,
    stages: staged.length ? { deep: sum('deep'), light: sum('light'), rem: sum('rem'), awake: sum('awake') } : null,
  };
}

/** “23:40” / “03:10” for a night minute (wraps past midnight). */
export function clockOf(nightMin: number): string {
  const m = ((Math.round(nightMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface SleepVsPlan {
  kind: 'wake' | 'bed';
  /** Minutes: positive = later than planned. */
  delta: number;
  /** Clock minutes in the day's own minutes (bed after midnight goes past 1440). */
  actual: number;
  planned: number;
}

/**
 * Sleep is not a block, so “what changed today” reads it against the plan instead: when you woke up
 * (last night's end) vs the planned wake-up, and when you went to bed (tonight's start) vs the target.
 * Differences under 5 minutes are not worth a line.
 */
export function sleepVsPlan(dayId: string, sleeps: Sleep[], target: SleepTarget, plannedWake?: number, now = new Date()): SleepVsPlan[] {
  const nights = mainSleeps(sleeps);
  const out: SleepVsPlan[] = [];
  const last = nights.get(addDays(dayId, -1));
  if (last?.end) {
    const actual = Math.round(minuteOfDay(dayId, new Date(last.end)));
    const planned = plannedWake ?? target.wake;
    if (Math.abs(actual - planned) >= 5 && actual < 18 * 60) out.push({ kind: 'wake', delta: actual - planned, actual, planned });
  }
  const tonight = nights.get(dayId);
  if (tonight) {
    const actual = Math.round(minuteOfDay(dayId, new Date(tonight.start)));
    const planned = targetSpan(target).bed;
    if (Math.abs(actual - planned) >= 5 && new Date(tonight.start).getTime() <= now.getTime()) out.push({ kind: 'bed', delta: actual - planned, actual, planned });
  }
  return out;
}

/** The nights as spans of the logical day [dayId], in its minutes (an open night runs until `nowMin`). Gaps never count them. */
export function sleepSpans(dayId: string, sleeps: Sleep[], nowMin: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const night of [addDays(dayId, -1), dayId]) {
    const s = mainSleeps(sleeps).get(night);
    if (!s) continue;
    const start = minuteOfDay(dayId, new Date(s.start));
    const end = s.end ? minuteOfDay(dayId, new Date(s.end)) : nowMin;
    if (end > start) out.push({ start, end });
  }
  return out;
}
