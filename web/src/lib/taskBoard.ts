import type { DayBlock, Task } from './types';

/** Columns of the Tasks board. Tasks planned for a later day live in the Backlog (with an “on <day>” pill). */
export type Column = 'inbox' | 'backlog' | 'today' | 'done';
export const COLUMNS: Column[] = ['inbox', 'backlog', 'today', 'done'];

/** Snoozed until a later day (it comes back by itself on that day). */
export const isSnoozed = (t: Task, day: string) => !!t.deferUntil && t.deferUntil > day && (t.status === 'inbox' || t.status === 'backlog');

/** Where “Later” sends a task: tomorrow, next Monday or the 1st of next month. */
export function deferDate(when: 'tomorrow' | 'week' | 'month', day: string): string {
  const d = new Date(`${day}T12:00:00`);
  if (when === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (when === 'week') d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  else { d.setMonth(d.getMonth() + 1, 1); }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function columnOf(t: Task, day: string): Column | null {
  if (t.deleted || t.status === 'archived') return null;
  if (t.status === 'done') return 'done';
  if (t.status === 'inbox') return 'inbox';
  if (t.status === 'today' && (!t.dayId || t.dayId <= day)) return 'today';
  return 'backlog';
}

export interface FitBlock {
  block: DayBlock;
  /** Minutes of the block still ahead, minus the estimates of its open to-dos (other than this one). */
  free: number;
  sameArea: boolean;
  now: boolean;
}

export interface Fit {
  /** Blocks still ahead today: same area as the task first, then by time. */
  blocks: FitBlock[];
  /** Estimated minutes of today's open to-dos (this one included). */
  estimated: number;
  /** Minutes of plan left from now. */
  left: number;
  /** Next free gap from now that fits the task (a new block for it). */
  slot: { start: number; end: number } | null;
}

const ahead = (b: { start: number; end: number }, now: number) => Math.max(0, b.end - Math.max(b.start, now));

/** Where a task that just landed on Today can go (US-PLAN-006, DIA-04). */
export function fitToday(task: Task, blocks: DayBlock[], dayTasks: Task[], now: number): Fit {
  const open = dayTasks.filter(t => t.status !== 'done' && !t.deleted && t.id !== task.id);
  const rows = blocks.filter(b => !b.deleted && b.end > now).map(b => {
    const load = open.filter(t => t.blockId === b.id).reduce((s, t) => s + (t.estimate ?? 0), 0);
    return { block: b, free: ahead(b, now) - load, sameArea: !!task.areaId && b.areaId === task.areaId, now: b.start <= now && now < b.end };
  });
  rows.sort((a, b) => Number(b.sameArea) - Number(a.sameArea) || a.block.start - b.block.start);
  const estimated = open.reduce((s, t) => s + (t.estimate ?? 0), 0) + (task.estimate ?? 0);
  const left = blocks.filter(b => !b.deleted).reduce((s, b) => s + ahead(b, now), 0);
  return { blocks: rows, estimated, left, slot: nextSlot(blocks, now, Math.min(120, Math.max(15, task.estimate ?? 30))) };
}

/** First gap of `len` minutes after `now` (rounded up to 15) that no block covers, before midnight. */
export function nextSlot(blocks: { start: number; end: number; deleted?: boolean }[], now: number, len: number, dayEnd = 24 * 60) {
  const live = blocks.filter(b => !b.deleted).sort((a, b) => a.start - b.start);
  let start = Math.ceil(now / 15) * 15;
  for (let moved = true; moved;) {
    moved = false;
    for (const b of live) {
      if (b.start < start + len && b.end > start) { start = Math.ceil(b.end / 15) * 15; moved = true; }
    }
  }
  return start + len <= dayEnd ? { start, end: start + len } : null;
}
