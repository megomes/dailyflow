import { activeSec, coverage, isPaused, leftInBlock, recEnd } from './actual';
import { logicalAt } from './zone';
import type { Area, ColorKey, DayBlock, FocusSession, Task, TimeRecord } from './types';

/**
 * “Now” snapshot for glanceable surfaces (EH): Android widgets, lock screen notification,
 * Wear OS tile and complication. Pure: built from synced rows, a moment, a zone and the cutoff.
 */

/** Dark-theme area colors as hex, for native renderers that cannot read CSS tokens. */
export const AREA_HEX: Record<ColorKey, string> = {
  blue: '#248CF2', purple: '#7557E8', pink: '#DC3D92', orange: '#EF6B2E', green: '#19B66A', cyan: '#27A7DC',
  yellow: '#E5BA43', red: '#E5484D', indigo: '#5B6CF0', teal: '#14B8A6', gray: '#8E8E93',
};

export interface SnapItem { title: string; area: string; color: string; start: number; end: number; startLabel: string; endLabel: string }
export interface Snapshot {
  generatedAt: string;
  day: string;
  minute: number;
  clock: string;
  now: (SnapItem & { remainingMin: number; progress: number }) | null;
  next: (SnapItem & { inMin: number }) | null;
  timeline: SnapItem[];
  running: {
    title: string; area: string; color: string; sinceLabel: string;
    /** Minutes actually spent (paused time not counted). */
    elapsedMin: number;
    paused: boolean;
    /** Minutes left in its block (negative once past the planned end); null without a block. The same two facts on every surface (note #34). */
    leftMin: number | null;
    /** Ready-made line: “14:00 · 8m left” / “22:00 · +3m over” / “Paused”. */
    line: string;
  } | null;
  /** Activities running alongside the main one (two things at once). */
  alsoRunning: { title: string; color: string; sinceLabel: string }[];
  /** Every block on now (more than one when blocks overlap on purpose, e.g. a meeting + guitar). */
  nowAll: SnapItem[];
  focus: { title: string; leftSec: number | null; elapsedSec: number; paused: boolean; endsAt: string | null } | null;
  tasks: { inProgress: string[]; high: string[]; today: string[]; next: string[] };
  /** Today's open to-dos with ids (widget check-off): the current block's first, then high priority, then the rest. */
  todos: { id: string; title: string; estimate: number | null; high: boolean; inNow: boolean; color: string; blockId: string | null; blockTitle: string | null; blockStart: string | null }[];
  /** Today's to-dos: done and still open. */
  todayCount: { done: number; open: number };
  progress: { trackedMin: number; plannedMin: number; plannedSoFarMin: number };
}

const hhmm = (min: number) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

export function buildSnapshot(input: { blocks: DayBlock[]; records: TimeRecord[]; tasks: Task[]; sessions: FocusSession[]; areas: Area[] }, at: Date, tz: string, cutoff: number): Snapshot {
  const { day, min } = logicalAt(at, tz, cutoff);
  const minute = min + at.getUTCSeconds() / 60;
  const areaMap = new Map(input.areas.map(a => [a.id, a]));
  const item = (b: { title: string; areaId: string; start: number; end: number }): SnapItem => {
    const a = areaMap.get(b.areaId);
    return { title: b.title || a?.name || '', area: a?.name ?? '', color: AREA_HEX[a?.color ?? 'gray'], start: b.start, end: b.end, startLabel: hhmm(b.start), endLabel: hhmm(b.end) };
  };
  const blocks = input.blocks.filter(b => !b.deleted && b.dayId === day && b.areaId !== 'area-sleep').sort((a, b) => a.start - b.start);
  const covering = blocks.filter(b => b.start <= minute && minute < b.end);
  const nowB = covering[covering.length - 1] ?? null;
  const nextB = blocks.find(b => b.start > minute && b.id !== nowB?.id) ?? null;

  const openRecs = input.records.filter(r => !r.deleted && r.end == null);
  const running = openRecs.find(r => !r.alongside) ?? openRecs[0];
  const also = openRecs.filter(r => r !== running);
  // Minutes actually spent: since the start, minus pauses of 10 minutes or more (note #33).
  const elapsed = (r: TimeRecord) => Math.max(0, Math.round(activeSec(r, at.getTime()) / 60));
  const dur = (min: number) => { const m = Math.max(1, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`; };
  const focus = input.sessions.filter(f => !f.deleted && (f.state === 'running' || f.state === 'paused')).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  let focusOut: Snapshot['focus'] = null;
  if (focus) {
    const end = focus.pausedAt ? Date.parse(focus.pausedAt) : at.getTime();
    const elapsedSec = Math.max(0, (end - Date.parse(focus.startedAt) - focus.pausedMs) / 1000);
    const left = focus.focusMin ? focus.focusMin * 60 - elapsedSec : null;
    focusOut = {
      title: focus.title, elapsedSec: Math.round(elapsedSec), leftSec: left == null ? null : Math.round(left), paused: focus.state === 'paused',
      endsAt: left != null && focus.state === 'running' ? new Date(at.getTime() + left * 1000).toISOString() : null,
    };
  }

  const tasks = input.tasks.filter(t => !t.deleted);
  const open = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  const tracked = new Set(input.sessions.filter(s => !s.deleted && s.taskId).map(s => s.taskId!));
  const todayTasks = open.filter(t => t.status === 'today' && t.dayId === day);
  // To-dos of every block on now (parallel blocks included).
  const coveringIds = new Set(covering.map(b => b.id));
  const inNow = todayTasks.filter(t => !!t.blockId && coveringIds.has(t.blockId));
  const blockById = new Map(blocks.map(b => [b.id, b]));
  // Now first, then by the block they are planned in (upcoming), then loose, then blocks already over; high priority first inside each.
  const rank = (t: Task) => {
    const b = t.blockId ? blockById.get(t.blockId) : undefined;
    if (b && coveringIds.has(b.id)) return 0;
    if (b && b.start > minute) return 1 + b.start / 1e4;
    return b ? 3 : 2;
  };
  const todos = [...todayTasks].sort((a, b) => rank(a) - rank(b) || Number(b.priority === 'high') - Number(a.priority === 'high') || a.sort - b.sort)
    .slice(0, 16).map(t => {
      const b = t.blockId ? blockById.get(t.blockId) : undefined;
      return {
        id: t.id, title: t.title, estimate: t.estimate ?? null, high: t.priority === 'high', inNow: !!b && coveringIds.has(b.id),
        color: AREA_HEX[areaMap.get(t.areaId ?? b?.areaId ?? '')?.color ?? 'gray'],
        blockId: b?.id ?? null, blockTitle: b ? b.title || areaMap.get(b.areaId)?.name || '' : null, blockStart: b ? hhmm(b.start) : null,
      };
    });
  const recs = input.records.filter(r => !r.deleted && r.dayId === day);

  return {
    generatedAt: at.toISOString(), day, minute: Math.floor(minute), clock: hhmm(minute),
    now: nowB ? { ...item(nowB), remainingMin: Math.max(0, Math.round(nowB.end - minute)), progress: (minute - nowB.start) / (nowB.end - nowB.start) } : null,
    next: nextB ? { ...item(nextB), inMin: Math.max(0, Math.round(nextB.start - minute)) } : null,
    timeline: blocks.map(item),
    running: running ? (() => {
      const a = areaMap.get(running.areaId);
      const el = elapsed(running);
      const left = leftInBlock(running, blocks, minute, nowB);
      const paused = isPaused(running);
      return {
        title: running.title || a?.name || '', area: a?.name ?? '', color: AREA_HEX[a?.color ?? 'gray'], sinceLabel: hhmm(running.start), elapsedMin: el,
        paused, leftMin: left == null ? null : Math.round(left),
        line: paused ? `Paused · ${dur(el)} so far` : `${dur(el)}${left == null ? '' : left < 0 ? ` · +${dur(-left)} over` : ` · ${dur(left)} left`}`,
      };
    })() : null,
    alsoRunning: also.map(r => ({ title: r.title || areaMap.get(r.areaId)?.name || '', color: AREA_HEX[areaMap.get(r.areaId)?.color ?? 'gray'], sinceLabel: hhmm(r.start) })),
    nowAll: covering.map(item),
    focus: focusOut,
    tasks: {
      inProgress: open.filter(t => tracked.has(t.id)).map(t => t.title).slice(0, 8),
      high: open.filter(t => t.priority === 'high').map(t => t.title).slice(0, 8),
      today: todayTasks.map(t => t.title).slice(0, 12),
      next: [...inNow, ...todayTasks.filter(t => !inNow.includes(t))].map(t => t.title).slice(0, 5),
    },
    todos,
    todayCount: { done: tasks.filter(t => t.status === 'done' && t.dayId === day).length, open: todayTasks.length },
    progress: {
      trackedMin: Math.round(coverage(recs.map(r => ({ start: r.start, end: Math.min(recEnd(r, minute), minute) }))).total),
      plannedMin: blocks.reduce((s, b) => s + b.end - b.start, 0),
      plannedSoFarMin: Math.round(blocks.reduce((s, b) => s + Math.max(0, Math.min(b.end, minute) - b.start), 0)),
    },
  };
}
