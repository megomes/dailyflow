import type { PlanBlock, Task, TimelineBlock, TimeRecord } from './types';
import { dateAtMinute } from './time';

/**
 * Pure logic for Plan × Real (E2), replanning (E3), tasks capacity (E4) and the day summary (E7).
 * Minutes are relative to the logical day's date (01:30 after midnight = 1530), like blocks.
 */

export interface Span { start: number; end: number }

/**
 * When a record really started (ms). startedAt is exact to the second, but an edited start (e.g. moved
 * to 13:31) only changes start; when they disagree the edited minute wins, so timers follow the fix.
 */
export function startedMs(r: Pick<TimeRecord, 'dayId' | 'start' | 'startedAt'>): number {
  const fromStart = dateAtMinute(r.dayId, r.start).getTime();
  const exact = r.startedAt ? Date.parse(r.startedAt) : NaN;
  return Number.isFinite(exact) && Math.abs(exact - fromStart) < 60_000 ? exact : fromStart;
}

export const recEnd = (r: Pick<TimeRecord, 'end'>, nowMin: number) => (r.end == null ? nowMin : r.end);

type Pausable = Pick<TimeRecord, 'dayId' | 'pauses'>;
export const isPaused = (r: Pick<TimeRecord, 'pauses'>) => { const p = r.pauses?.[r.pauses.length - 1]; return !!p && p.to == null; };

/** Milliseconds spent paused (an open pause counts until `nowMs`). */
export function pausedMs(r: Pick<TimeRecord, 'pauses'>, nowMs = Date.now()): number {
  return (r.pauses ?? []).reduce((s, p) => { const d = (p.to ?? nowMs) - p.from; return s + (d >= MIN_PAUSE_MS ? d : 0); }, 0);
}

/** A pause shorter than this never happened: it is not counted and not drawn (note #33). */
export const MIN_PAUSE_MS = 10 * 60_000;
export const countedPauses = (r: Pick<TimeRecord, 'pauses'>, nowMs = Date.now()) => (r.pauses ?? []).filter(p => (p.to ?? nowMs) - p.from >= MIN_PAUSE_MS);

/** Paused minutes that fall inside [win.start, win.end] (minutes of the record's day); the whole record when no window. */
export function pausedWithin(r: Pausable, win?: Span, nowMs = Date.now()): number {
  if (!r.pauses?.length) return 0;
  const base = dateAtMinute(r.dayId, 0).getTime();
  return countedPauses(r, nowMs).reduce((s, p) => {
    const a = (p.from - base) / 60000, b = ((p.to ?? nowMs) - base) / 60000;
    return s + (win ? Math.max(0, Math.min(b, win.end) - Math.max(a, win.start)) : Math.max(0, b - a));
  }, 0);
}

/** Merges overlapping spans into a sorted, disjoint list. */
/**
 * Time actually covered vs. time spent on two things at once. Per-area totals count each activity
 * fully (a meeting + guitar is 1h of each); the day total counts the clock once.
 */
export function coverage(spans: Span[]): { total: number; parallel: number } {
  const sum = spans.reduce((s, x) => s + Math.max(0, x.end - x.start), 0);
  const total = mergeSpans(spans).reduce((s, x) => s + x.end - x.start, 0);
  return { total, parallel: sum - total };
}

export function mergeSpans(spans: Span[]): Span[] {
  const s = spans.filter(x => x.end > x.start).sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x.start <= last.end) last.end = Math.max(last.end, x.end);
    else out.push({ start: x.start, end: x.end });
  }
  return out;
}

/** Parts of [from, to) not covered by any span, at least `min` minutes long. */
export function uncovered(spans: Span[], from: number, to: number, min = 1): Span[] {
  const out: Span[] = [];
  let cur = from;
  for (const s of mergeSpans(spans)) {
    if (s.end <= cur) continue;
    if (s.start >= to) break;
    if (s.start > cur) out.push({ start: cur, end: Math.min(s.start, to) });
    cur = Math.max(cur, s.end);
    if (cur >= to) break;
  }
  if (cur < to) out.push({ start: cur, end: to });
  return out.filter(g => g.end - g.start >= min);
}

const overlap = (a: Span, b: Span) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

export function recordSpans(records: TimeRecord[], nowMin: number): Span[] {
  return records.map(r => ({ start: r.start, end: recEnd(r, nowMin) }));
}

/** Gaps in the actual timeline between the start and end of the planned/tracked day, up to `until`. */
export function dayGaps(plan: TimelineBlock[], records: TimeRecord[], until: number, min = 10, covered: Span[] = []): Span[] {
  const all = [...plan.map(b => b.start), ...records.map(r => r.start)];
  if (!all.length) return [];
  const from = Math.min(...all);
  const lastPlan = plan.length ? Math.max(...plan.map(b => b.end)) : from;
  const lastRec = records.length ? Math.max(...records.map(r => recEnd(r, until))) : from;
  const to = Math.min(until, Math.max(lastPlan, lastRec));
  // Sleeping is not an unrecorded gap (note #38): the nights count as covered.
  return uncovered([...recordSpans(records, until), ...covered], from, to, min);
}

export interface RecordDraft { start: number; end: number; areaId: string; title: string; blockId?: string }

/**
 * “Accept plan as real”: for each plan block, the parts of its window (up to `until`)
 * that no record covers become records with the block's area and title.
 */
export function planAsReal(plan: TimelineBlock[], records: TimeRecord[], until: number, within?: Span): RecordDraft[] {
  const covered = recordSpans(records, until);
  const out: RecordDraft[] = [];
  const sorted = [...plan].sort((a, b) => a.start - b.start);
  for (const b of sorted) {
    const lo = Math.max(b.start, within?.start ?? -Infinity);
    const hi = Math.min(b.end, until, within?.end ?? Infinity);
    if (hi <= lo) continue;
    for (const g of uncovered([...covered, ...out], lo, hi, 1)) {
      out.push({ start: g.start, end: g.end, areaId: b.areaId, title: b.title, blockId: b.id });
    }
  }
  return out;
}

/** Minutes per area. A running item (end null) counts up to `nowMin`. */
export function areaTotals(items: { start: number; end: number | null; areaId: string; paused?: number }[], nowMin = 0): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const d = (it.end == null ? nowMin : it.end) - it.start - (it.paused ?? 0);
    if (d > 0) m.set(it.areaId, (m.get(it.areaId) ?? 0) + d);
  }
  return m;
}

/** Real minutes inside a block's window, total and in the block's own area. */
export function blockActual(b: TimelineBlock, records: TimeRecord[], nowMin: number) {
  let any = 0, same = 0;
  for (const r of records) {
    const win = { start: r.start, end: recEnd(r, nowMin) };
    const o = Math.max(0, overlap(b, win) - pausedWithin(r, { start: Math.max(b.start, win.start), end: Math.min(b.end, win.end) }));
    any += o;
    if (r.areaId === b.areaId || r.blockId === b.id) same += o;
  }
  return { any, same };
}

export type ChangeLine =
  | { kind: 'area'; areaId: string; planned: number; actual: number; delta: number }
  | { kind: 'moved'; title: string; areaId: string; from: number; to: number; delta: number }
  | { kind: 'added'; title: string; areaId: string; start: number; minutes: number }
  | { kind: 'removed'; title: string; areaId: string; start: number; minutes: number }
  | { kind: 'resized'; title: string; areaId: string; from: number; to: number; delta: number };

/** Plan changes from Baseline to the current plan, in plain terms. Matched by block id. */
export function planChanges(baseline: PlanBlock[], current: TimelineBlock[]): ChangeLine[] {
  const out: ChangeLine[] = [];
  const cur = new Map(current.map(b => [b.id, b]));
  const base = new Map(baseline.map(b => [b.id, b]));
  for (const b of baseline) {
    const c = cur.get(b.id);
    if (!c) { out.push({ kind: 'removed', title: b.title, areaId: b.areaId, start: b.start, minutes: b.end - b.start }); continue; }
    if (c.start !== b.start) out.push({ kind: 'moved', title: c.title, areaId: c.areaId, from: b.start, to: c.start, delta: Math.abs(c.start - b.start) });
    const l0 = b.end - b.start, l1 = c.end - c.start;
    if (l0 !== l1) out.push({ kind: 'resized', title: c.title, areaId: c.areaId, from: l0, to: l1, delta: Math.abs(l1 - l0) });
  }
  for (const c of current) if (!base.has(c.id)) out.push({ kind: 'added', title: c.title, areaId: c.areaId, start: c.start, minutes: c.end - c.start });
  return out;
}

/**
 * “What changed today”: per-area plan vs real plus plan changes, biggest first.
 * Plan and real are compared only over time that has a record: untracked time is not
 * “skipped”, it is just not recorded yet (see dayGaps). Only time before `until` counts.
 */
export function whatChanged(baselineAll: PlanBlock[] | undefined, currentAll: TimelineBlock[], recordsAll: TimeRecord[], until: number, minDelta = 10): ChangeLine[] {
  // Sleep is read against the plan on its own (sleepVsPlan), never as a block.
  const baseline = baselineAll?.filter(b => b.areaId !== 'area-sleep');
  const current = currentAll.filter(b => b.areaId !== 'area-sleep');
  const records = recordsAll.filter(r => r.areaId !== 'area-sleep');
  const covered = mergeSpans(records.map(r => ({ start: r.start, end: Math.min(recEnd(r, until), until) })));
  const planned = new Map<string, number>();
  for (const b of current) {
    const o = covered.reduce((s, c) => s + overlap(b, c), 0);
    if (o > 0) planned.set(b.areaId, (planned.get(b.areaId) ?? 0) + o);
  }
  const actual = areaTotals(records.filter(r => r.start < until).map(r => ({ start: r.start, end: Math.min(recEnd(r, until), until), areaId: r.areaId, paused: pausedWithin(r, { start: r.start, end: until }) })), until);
  const lines: ChangeLine[] = [];
  // An area with a block still under way is not “skipped” yet: that only holds once the block is over.
  const ongoing = new Set(current.filter(b => b.start < until && until < b.end).map(b => b.areaId));
  for (const id of new Set([...planned.keys(), ...actual.keys()])) {
    const p = Math.round(planned.get(id) ?? 0), a = Math.round(actual.get(id) ?? 0);
    if (a === 0 && ongoing.has(id)) continue;
    if (Math.abs(a - p) >= minDelta) lines.push({ kind: 'area', areaId: id, planned: p, actual: a, delta: a - p });
  }
  const changes = baseline ? planChanges(baseline, current).filter(c => ('delta' in c ? c.delta : c.minutes) >= 5) : [];
  const size = (c: ChangeLine) => Math.abs('delta' in c ? c.delta : c.minutes);
  return [...lines, ...changes].sort((a, b) => size(b) - size(a));
}

/** Real minutes recorded (any area) inside a window. */
export function coveredIn(span: Span, records: TimeRecord[], nowMin: number): number {
  return mergeSpans(recordSpans(records, nowMin)).reduce((s, c) => s + overlap(span, c), 0);
}

export interface Conflict { a: TimelineBlock; b: TimelineBlock; minutes: number }

/** Pairs of plan blocks that overlap (E3). */
export function overlaps(blocks: TimelineBlock[]): Conflict[] {
  const s = [...blocks].sort((x, y) => x.start - y.start);
  const out: Conflict[] = [];
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length && s[j].start < s[i].end; j++) {
      const o = overlap(s[i], s[j]);
      if (o > 0) out.push({ a: s[i], b: s[j], minutes: o });
    }
  }
  return out;
}

/** Key of an overlapping pair, independent of order. */
export const overlapKey = (a: { id: string }, b: { id: string }) => [a.id, b.id].sort().join('|');

/** Overlaps still to decide: the ones kept on purpose (two things at once) are left alone. */
export function openOverlaps(blocks: TimelineBlock[], kept: string[] = []): Conflict[] {
  // A calendar event inside a block of the same area (a meeting in Work) is normal, not a conflict.
  const isCal = (b: TimelineBlock) => !!(b as TimelineBlock & { calendar?: unknown }).calendar;
  const inside = (e: TimelineBlock, b: TimelineBlock) => isCal(e) && !isCal(b) && e.areaId === b.areaId && e.start >= b.start && e.end <= b.end;
  return overlaps(blocks).filter(c => !kept.includes(overlapKey(c.a, c.b)) && !inside(c.a, c.b) && !inside(c.b, c.a));
}

export interface ReplanResult {
  moves: { id: string; start: number; end: number }[];
  /** Flexible blocks that no longer fit before the end of the day. */
  dropped: string[];
}

/**
 * Replan remaining day (E5, Q-19), deterministic: flexible blocks that have not happened yet are
 * laid out from now, in their original order and keeping their length; fixed blocks stay put and
 * flexible ones flow around them. Blocks already under way (current, with real time) are kept.
 */
export function replanRemaining(blocks: (TimelineBlock & { fixed?: boolean })[], records: TimeRecord[], nowMin: number, dayEnd: number): ReplanResult {
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const busy: Span[] = [];
  const pending: TimelineBlock[] = [];
  for (const b of sorted) {
    const happened = blockActual(b, records, nowMin).same > 0;
    if (b.fixed) { if (b.end > nowMin) busy.push(b); continue; }
    if (b.end <= nowMin) { if (!happened && nowMin - b.end <= 180) pending.push(b); continue; }
    if (b.start <= nowMin && happened) { busy.push(b); continue; }
    pending.push(b);
  }
  const moves: ReplanResult['moves'] = [];
  const dropped: string[] = [];
  let cursor = Math.ceil(nowMin / 5) * 5;
  for (const b of pending) {
    const len = b.end - b.start;
    let start = Math.max(cursor, b.start);
    for (let guard = 0; guard < 100; guard++) {
      const hit = busy.find(f => start < f.end && start + len > f.start);
      if (!hit) break;
      start = hit.end;
    }
    if (start + len > dayEnd) { dropped.push(b.id); continue; }
    if (start !== b.start) moves.push({ id: b.id, start, end: start + len });
    busy.push({ start, end: start + len });
    cursor = start + len;
  }
  return { moves, dropped };
}

/** Estimated load of a block's tasks vs its length (E4, advisory only). */
export function capacity(block: TimelineBlock, tasks: Task[]) {
  const open = tasks.filter(t => t.blockId === block.id && t.status !== 'done' && !t.deleted);
  const estimated = open.reduce((s, t) => s + (t.estimate ?? 0), 0);
  const available = block.end - block.start;
  return { estimated, available, over: estimated > available, count: open.length };
}

/** Day "shape" for history: real minutes per area, sorted by size. */
export function dayShape(records: TimeRecord[], nowMin = Infinity) {
  const t = areaTotals(records.map(r => ({ start: r.start, end: r.end ?? (Number.isFinite(nowMin) ? nowMin : r.start), areaId: r.areaId, paused: pausedWithin(r) })));
  return [...t.entries()].sort((a, b) => b[1] - a[1]);
}

/** Seconds of real activity: elapsed since the start minus paused time (note #33). */
export function activeSec(r: Pick<TimeRecord, 'dayId' | 'start' | 'startedAt' | 'pauses'>, nowMs: number): number {
  // While paused the clock stands still at the moment of the pause.
  const last = r.pauses?.[r.pauses.length - 1];
  const at = last && last.to == null ? last.from : nowMs;
  return Math.max(0, (at - startedMs(r) - pausedMs(r, at)) / 1000);
}

/**
 * The same two facts everywhere (pill, tray, watch, widgets, Now card — note #34): how long you have
 * been at it, and how long is left in the block the activity belongs to (or +over once it ran past).
 * `leftMin` is positive while time remains, negative past the planned end, null when there is no block.
 */
export function leftInBlock(r: Pick<TimeRecord, 'blockId'>, blocks: { id: string; start: number; end: number }[], nowMin: number, current?: { start: number; end: number } | null): number | null {
  const b = (r.blockId ? blocks.find(x => x.id === r.blockId) : undefined) ?? current ?? null;
  return b ? b.end - nowMin : null;
}
