import { pausedWithin, recEnd } from './actual';
import { addDays, dateFromIso } from './time';
import type { DayBlock, FocusSession, Revision, Task, TimeRecord } from './types';

/**
 * Pure aggregations for Insights (E11). Inputs are whole tables; every function filters by
 * period itself, so the page stays a thin view. Minutes everywhere.
 */

export interface Period { from: string; to: string; label: string }

/** Monday-first week containing `day`. */
export function weekOf(day: string): Period {
  const d = dateFromIso(day);
  const offset = (d.getDay() + 6) % 7;
  const from = addDays(day, -offset);
  return { from, to: addDays(from, 6), label: 'week' };
}

export function monthOf(day: string): Period {
  const from = `${day.slice(0, 7)}-01`;
  const d = dateFromIso(from);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return { from, to: `${day.slice(0, 7)}-${String(d.getDate()).padStart(2, '0')}`, label: 'month' };
}

/** Rolling last 7 days ending on `day` (default view: never empty on a Monday morning). */
export function last7(day: string): Period {
  return { from: addDays(day, -6), to: day, label: '7d' };
}

/** The period right before `p`, same length. */
export function previous(p: Period): Period {
  const len = daysIn(p).length;
  if (p.label === 'month') return monthOf(addDays(p.from, -1));
  return { from: addDays(p.from, -len), to: addDays(p.from, -1), label: p.label };
}

export function daysIn(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.from; d <= p.to; d = addDays(d, 1)) out.push(d);
  return out;
}

const inP = (p: Period, day: string) => day >= p.from && day <= p.to;
const dur = (r: { start: number; end: number | null; dayId?: string; pauses?: TimeRecord['pauses'] }, now = r.start) => Math.max(0, recEnd(r, now) - r.start - (r.dayId ? pausedWithin({ dayId: r.dayId, pauses: r.pauses }) : 0));

/** Real minutes per area, per day (for the stacked daily bars) and in total. */
export function areaDistribution(records: TimeRecord[], p: Period) {
  const byDay = new Map<string, Map<string, number>>();
  const total = new Map<string, number>();
  for (const r of records) {
    if (r.deleted || !inP(p, r.dayId)) continue;
    const m = dur(r);
    if (!m) continue;
    const day = byDay.get(r.dayId) ?? new Map<string, number>();
    day.set(r.areaId, (day.get(r.areaId) ?? 0) + m);
    byDay.set(r.dayId, day);
    total.set(r.areaId, (total.get(r.areaId) ?? 0) + m);
  }
  return { byDay, total };
}

/** Planned (final plan) vs real minutes per area, only on days that have any record. */
export function plannedVsReal(blocks: DayBlock[], records: TimeRecord[], p: Period) {
  const tracked = new Set(records.filter(r => !r.deleted && inP(p, r.dayId)).map(r => r.dayId));
  const planned = new Map<string, number>();
  for (const b of blocks) {
    if (b.deleted || !tracked.has(b.dayId)) continue;
    planned.set(b.areaId, (planned.get(b.areaId) ?? 0) + (b.end - b.start));
  }
  const { total: real } = areaDistribution(records, p);
  const ids = [...new Set([...planned.keys(), ...real.keys()])];
  const rows = ids.map(id => ({ areaId: id, planned: planned.get(id) ?? 0, real: real.get(id) ?? 0 }))
    .sort((a, b) => Math.max(b.planned, b.real) - Math.max(a.planned, a.real));
  const sumP = rows.reduce((s, r) => s + r.planned, 0), sumR = rows.reduce((s, r) => s + r.real, 0);
  return { rows, planned: sumP, real: sumR, days: tracked.size };
}

/** How much each day changed: revisions per day and how many days were started/closed. */
export function dayDiscipline(days: { id: string; status?: string; deleted?: boolean }[], revisions: Revision[], p: Period) {
  const list = days.filter(d => !d.deleted && inP(p, d.id));
  const revs = revisions.filter(r => !r.deleted && inP(p, r.dayId));
  return {
    days: list.length,
    started: list.filter(d => d.status === 'active' || d.status === 'closed').length,
    closed: list.filter(d => d.status === 'closed').length,
    revisions: revs.length,
    reasons: countBy(revs.filter(r => r.reason).map(r => r.reason!)),
  };
}

function countBy(xs: string[]) {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Tracked focus minutes per task (sum of sessions). */
function trackedPerTask(sessions: FocusSession[]) {
  const m = new Map<string, number>();
  for (const s of sessions) if (!s.deleted && s.taskId && s.actualMin != null) m.set(s.taskId, (m.get(s.taskId) ?? 0) + s.actualMin);
  return m;
}

/**
 * Estimation accuracy (spec §57): for tasks done in the period with an estimate and tracked
 * focus time, actual/estimate per task, grouped by area. ratio > 1 = took longer than estimated.
 */
export function estimationAccuracy(tasks: Task[], sessions: FocusSession[], p: Period) {
  const tracked = trackedPerTask(sessions);
  const samples = tasks
    .filter(t => !t.deleted && t.status === 'done' && t.estimate && t.doneAt && inP(p, t.doneAt.slice(0, 10)) && (tracked.get(t.id) ?? 0) > 0)
    .map(t => ({ task: t, estimate: t.estimate!, actual: tracked.get(t.id)!, ratio: tracked.get(t.id)! / t.estimate! }));
  const byArea = new Map<string, number[]>();
  for (const s of samples) {
    const k = s.task.areaId ?? '';
    byArea.set(k, [...(byArea.get(k) ?? []), s.ratio]);
  }
  const groups = [...byArea.entries()].map(([areaId, ratios]) => ({ areaId, n: ratios.length, median: median(ratios) }))
    .sort((a, b) => b.n - a.n);
  return { samples, groups, median: samples.length ? median(samples.map(s => s.ratio)) : null };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Focus statistics (spec §58). */
export function focusStats(sessions: FocusSession[], p: Period) {
  const list = sessions.filter(s => !s.deleted && inP(p, s.dayId) && s.actualMin != null);
  const done = list.filter(s => s.state === 'done');
  const byHour = new Array(24).fill(0) as number[];
  for (const s of list) byHour[new Date(s.startedAt).getHours()] += s.actualMin!;
  const byPreset = countBy(list.map(s => s.preset));
  const total = list.reduce((x, s) => x + s.actualMin!, 0);
  return {
    sessions: list.length,
    minutes: total,
    completion: list.length ? done.length / list.length : 0,
    avg: list.length ? total / list.length : 0,
    byHour,
    byPreset,
    days: new Set(list.map(s => s.dayId)).size,
  };
}

/** Change vs the previous period, per area (minutes and %). */
export function compareAreas(cur: Map<string, number>, prev: Map<string, number>) {
  const ids = [...new Set([...cur.keys(), ...prev.keys()])];
  return ids.map(id => {
    const a = cur.get(id) ?? 0, b = prev.get(id) ?? 0;
    return { areaId: id, cur: a, prev: b, delta: a - b, pct: b ? (a - b) / b : null };
  }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

/** Weekly goals (CAP-I6): minutes per area per week, scaled to the period length. */
export function goalProgress(goals: Record<string, number> | undefined, total: Map<string, number>, p: Period) {
  if (!goals) return [];
  const weeks = daysIn(p).length / 7;
  return Object.entries(goals).filter(([, v]) => v > 0).map(([areaId, perWeek]) => {
    const target = Math.round(perWeek * weeks);
    const done = total.get(areaId) ?? 0;
    return { areaId, target, done, ratio: target ? done / target : 0 };
  });
}
