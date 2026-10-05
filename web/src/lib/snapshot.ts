import { recEnd } from './actual';
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
  running: { title: string; area: string; color: string; sinceLabel: string; elapsedMin: number } | null;
  focus: { title: string; leftSec: number | null; elapsedSec: number; paused: boolean; endsAt: string | null } | null;
  tasks: { inProgress: string[]; high: string[]; today: string[]; next: string[] };
  /** Today's open to-dos with ids (widget check-off): the current block's first, then high priority, then the rest. */
  todos: { id: string; title: string; estimate: number | null; high: boolean; inNow: boolean; color: string }[];
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
  const blocks = input.blocks.filter(b => !b.deleted && b.dayId === day).sort((a, b) => a.start - b.start);
  const covering = blocks.filter(b => b.start <= minute && minute < b.end);
  const nowB = covering[covering.length - 1] ?? null;
  const nextB = blocks.find(b => b.start > minute && b.id !== nowB?.id) ?? null;

  const running = input.records.find(r => !r.deleted && r.end == null);
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
  const inNow = nowB ? todayTasks.filter(t => t.blockId === nowB.id) : [];
  const blockArea = new Map(blocks.map(b => [b.id, b.areaId]));
  const todos = [...inNow, ...todayTasks.filter(t => !inNow.includes(t) && t.priority === 'high'), ...todayTasks.filter(t => !inNow.includes(t) && t.priority !== 'high')]
    .slice(0, 8).map(t => ({ id: t.id, title: t.title, estimate: t.estimate ?? null, high: t.priority === 'high', inNow: inNow.includes(t), color: AREA_HEX[areaMap.get(t.areaId ?? (t.blockId ? blockArea.get(t.blockId) ?? '' : ''))?.color ?? 'gray'] }));
  const recs = input.records.filter(r => !r.deleted && r.dayId === day);

  return {
    generatedAt: at.toISOString(), day, minute: Math.floor(minute), clock: hhmm(minute),
    now: nowB ? { ...item(nowB), remainingMin: Math.max(0, Math.round(nowB.end - minute)), progress: (minute - nowB.start) / (nowB.end - nowB.start) } : null,
    next: nextB ? { ...item(nextB), inMin: Math.max(0, Math.round(nextB.start - minute)) } : null,
    timeline: blocks.map(item),
    running: running ? (() => {
      const a = areaMap.get(running.areaId);
      return { title: running.title || a?.name || '', area: a?.name ?? '', color: AREA_HEX[a?.color ?? 'gray'], sinceLabel: hhmm(running.start), elapsedMin: Math.max(0, Math.round(running.startedAt ? (at.getTime() - Date.parse(running.startedAt)) / 60000 : minute - running.start)) };
    })() : null,
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
      trackedMin: Math.round(recs.reduce((s, r) => s + (Math.min(recEnd(r, minute), minute) - r.start), 0)),
      plannedMin: blocks.reduce((s, b) => s + b.end - b.start, 0),
      plannedSoFarMin: Math.round(blocks.reduce((s, b) => s + Math.max(0, Math.min(b.end, minute) - b.start), 0)),
    },
  };
}
