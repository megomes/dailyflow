import { nextDate, revealOn } from './recurrence';
import type { DayBlock, Sleep, Task, TimeRecord } from './types';
import { logicalAt } from './zone';

/**
 * Quick actions for surfaces that cannot run the full app (Wear OS, widget buttons): start the
 * current block or stop the running activity, as sync ops (pure; the route writes them).
 */
export interface QuickOp { entity: 'time_record' | 'sleep'; id: string; updatedAt: string; deleted: boolean; data: Record<string, unknown> }

export function quickOps(action: 'start' | 'stop' | 'next' | 'pause' | 'resume' | 'sleep' | 'wake', rows: { blocks: DayBlock[]; records: TimeRecord[]; sleeps?: Sleep[] }, at: Date, tz: string, cutoff: number, newId: () => string): { ops: QuickOp[]; message: string } {
  const { day, min } = logicalAt(at, tz, cutoff);
  const ts = at.toISOString();
  const ops: QuickOp[] = [];
  const open = rows.records.filter(r => !r.deleted && r.end == null);
  const running = open.find(r => !r.alongside) ?? open[0];
  const minuteFor = (r: TimeRecord) => (r.dayId === day ? min : min + (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${r.dayId}T00:00:00Z`)) / 60000);
  const stop = (r: TimeRecord) => {
    const end = Math.round(minuteFor(r));
    const { id, updatedAt: _u, deleted: _d, ...rest } = r;
    ops.push(end - r.start < 1
      ? { entity: 'time_record', id, updatedAt: ts, deleted: true, data: rest }
      : { entity: 'time_record', id, updatedAt: ts, deleted: false, data: { ...rest, end, ...(r.pauses?.length && r.pauses[r.pauses.length - 1].to == null ? { pauses: r.pauses.map((p, i) => (i === r.pauses!.length - 1 ? { ...p, to: at.getTime() } : p)) } : {}) } });
  };
  /** Something running alongside becomes the main activity (note #23: never two timers for one thing). */
  const promote = (r: TimeRecord) => {
    const { id, updatedAt: _u, deleted: _d, ...rest } = r;
    ops.push({ entity: 'time_record', id, updatedAt: new Date(at.getTime() + 1).toISOString(), deleted: false, data: { ...rest, alongside: false } });
  };
  if (action === 'sleep' || action === 'wake') {
    const openSleep = (rows.sleeps ?? []).find(s => !s.deleted && !s.end);
    if (action === 'wake') {
      if (!openSleep) return { ops, message: 'Not asleep' };
      const { id, updatedAt: _u, deleted: _d, ...rest } = openSleep;
      ops.push({ entity: 'sleep', id, updatedAt: ts, deleted: false, data: { ...rest, end: ts } } as unknown as QuickOp);
      return { ops, message: 'Good morning ☀️' };
    }
    if (openSleep) return { ops, message: 'Already asleep' };
    // Going to sleep stops whatever is running, at the same moment.
    for (const r of open) stop(r);
    // The night is named after the evening it belongs to: the calendar day twelve hours earlier, in the user's zone.
    const night = logicalAt(new Date(at.getTime() - 12 * 3600_000), tz, 0).day;
    ops.push({ entity: 'sleep', id: newId(), updatedAt: new Date(at.getTime() + 1).toISOString(), deleted: false, data: { night, start: ts, source: 'manual', createdAt: ts } } as unknown as QuickOp);
    return { ops, message: 'Good night 🌙' };
  }
  if (action === 'pause' || action === 'resume') {
    if (!running) return { ops, message: 'Nothing running' };
    const ps = running.pauses ?? [];
    const paused = ps.length > 0 && ps[ps.length - 1].to == null;
    if (action === 'pause' && paused) return { ops, message: 'Already paused' };
    if (action === 'resume' && !paused) return { ops, message: 'Not paused' };
    const pauses = action === 'pause' ? [...ps, { from: at.getTime() }] : ps.map((p, i) => (i === ps.length - 1 ? { ...p, to: at.getTime() } : p));
    const { id, updatedAt: _u, deleted: _d, ...rest } = running;
    ops.push({ entity: 'time_record', id, updatedAt: ts, deleted: false, data: { ...rest, pauses } });
    return { ops, message: `${action === 'pause' ? 'Paused' : 'Resumed'} ${running.title}` };
  }
  if (action === 'stop') {
    if (!running) return { ops, message: 'Nothing running' };
    stop(running);
    const next = open.filter(r => r.id !== running.id && r.alongside).sort((x, y) => x.start - y.start)[0];
    if (!running.alongside && next) promote(next);
    return { ops, message: `Stopped ${running.title}` };
  }
  const live = rows.blocks.filter(b => !b.deleted && b.dayId === day).sort((a, b) => a.start - b.start);
  const covering = live.filter(b => b.start <= min && min < b.end);
  const current = covering[covering.length - 1];
  // 'next': start the next block early (the plan is not moved; the real timeline shows it started now).
  const block = action === 'next' ? live.find(b => b.start > min && b.id !== current?.id) : current;
  if (!block) return { ops, message: action === 'next' ? 'Nothing next' : 'Nothing planned now' };
  if (running?.blockId === block.id) return { ops, message: `Already on ${block.title}` };
  const same = open.find(r => r.blockId === block.id && r.id !== running?.id);
  if (running) stop(running);
  if (same) { promote(same); return { ops, message: `Now on ${block.title}` }; }
  ops.push({ entity: 'time_record', id: newId(), updatedAt: new Date(at.getTime() + 1).toISOString(), deleted: false, data: {
    dayId: day, start: min, end: null, startedAt: ts, areaId: block.areaId, title: block.title, blockId: block.id, source: 'live', createdAt: ts,
  } });
  return { ops, message: `Started ${block.title}` };
}

/** Check off a to-do from a widget: done now; a recurring one also gets its next copy in the Backlog (same rule as the app). */
export function doneOps(task: Task & { updatedAt: string }, at: Date, newId: () => string, lead = 1): { ops: { entity: 'task'; id: string; updatedAt: string; deleted: boolean; data: Record<string, unknown> }[]; message: string } {
  if (task.status === 'done') return { ops: [], message: 'Already done' };
  const ts = at.toISOString();
  const { id, updatedAt: _u, deleted: _d, ...rest } = task;
  const ops = [{ entity: 'task' as const, id, updatedAt: ts, deleted: false, data: { ...rest, status: 'done', doneAt: ts } as Record<string, unknown> }];
  if (task.recurrence) {
    const next = {
      title: task.title, status: 'backlog', createdAt: ts, sort: at.getTime(), areaId: task.areaId, priority: task.priority, estimate: task.estimate, notes: task.notes,
      category: task.category, project: task.project, tags: task.tags, subtasks: task.subtasks?.map(x => ({ ...x, done: false })), recurrence: task.recurrence,
      seriesId: task.seriesId ?? task.id, due: nextDate(task.recurrence, task.due ?? ts.slice(0, 10)),
    } as Record<string, unknown>;
    const until = revealOn(next.due as string, lead, ts.slice(0, 10));
    if (until) next.deferUntil = until;
    ops.push({ entity: 'task', id: newId(), updatedAt: new Date(at.getTime() + 1).toISOString(), deleted: false, data: JSON.parse(JSON.stringify(next)) });
  }
  return { ops, message: `Done: ${task.title}` };
}
