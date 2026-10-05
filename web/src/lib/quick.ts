import { nextDate } from './recurrence';
import type { DayBlock, Task, TimeRecord } from './types';
import { logicalAt } from './zone';

/**
 * Quick actions for surfaces that cannot run the full app (Wear OS, widget buttons): start the
 * current block or stop the running activity, as sync ops (pure; the route writes them).
 */
export interface QuickOp { entity: 'time_record'; id: string; updatedAt: string; deleted: boolean; data: Record<string, unknown> }

export function quickOps(action: 'start' | 'stop' | 'next', rows: { blocks: DayBlock[]; records: TimeRecord[] }, at: Date, tz: string, cutoff: number, newId: () => string): { ops: QuickOp[]; message: string } {
  const { day, min } = logicalAt(at, tz, cutoff);
  const ts = at.toISOString();
  const ops: QuickOp[] = [];
  const running = rows.records.find(r => !r.deleted && r.end == null);
  const minuteFor = (r: TimeRecord) => (r.dayId === day ? min : min + (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${r.dayId}T00:00:00Z`)) / 60000);
  const stop = (r: TimeRecord) => {
    const end = Math.round(minuteFor(r));
    const { id, updatedAt: _u, deleted: _d, ...rest } = r;
    ops.push(end - r.start < 1
      ? { entity: 'time_record', id, updatedAt: ts, deleted: true, data: rest }
      : { entity: 'time_record', id, updatedAt: ts, deleted: false, data: { ...rest, end } });
  };
  if (action === 'stop') {
    if (!running) return { ops, message: 'Nothing running' };
    stop(running);
    return { ops, message: `Stopped ${running.title}` };
  }
  const live = rows.blocks.filter(b => !b.deleted && b.dayId === day).sort((a, b) => a.start - b.start);
  const covering = live.filter(b => b.start <= min && min < b.end);
  const current = covering[covering.length - 1];
  // 'next': start the next block early (the plan is not moved; the real timeline shows it started now).
  const block = action === 'next' ? live.find(b => b.start > min && b.id !== current?.id) : current;
  if (!block) return { ops, message: action === 'next' ? 'Nothing next' : 'Nothing planned now' };
  if (running?.blockId === block.id) return { ops, message: `Already on ${block.title}` };
  if (running) stop(running);
  ops.push({ entity: 'time_record', id: newId(), updatedAt: new Date(at.getTime() + 1).toISOString(), deleted: false, data: {
    dayId: day, start: min, end: null, startedAt: ts, areaId: block.areaId, title: block.title, blockId: block.id, source: 'live', createdAt: ts,
  } });
  return { ops, message: `Started ${block.title}` };
}

/** Check off a to-do from a widget: done now; a recurring one also gets its next copy in the Backlog (same rule as the app). */
export function doneOps(task: Task & { updatedAt: string }, at: Date, newId: () => string): { ops: { entity: 'task'; id: string; updatedAt: string; deleted: boolean; data: Record<string, unknown> }[]; message: string } {
  if (task.status === 'done') return { ops: [], message: 'Already done' };
  const ts = at.toISOString();
  const { id, updatedAt: _u, deleted: _d, ...rest } = task;
  const ops = [{ entity: 'task' as const, id, updatedAt: ts, deleted: false, data: { ...rest, status: 'done', doneAt: ts } as Record<string, unknown> }];
  if (task.recurrence) {
    const next = {
      title: task.title, status: 'backlog', createdAt: ts, sort: at.getTime(), areaId: task.areaId, priority: task.priority, estimate: task.estimate, notes: task.notes,
      category: task.category, project: task.project, tags: task.tags, subtasks: task.subtasks?.map(x => ({ ...x, done: false })), recurrence: task.recurrence,
      seriesId: task.seriesId ?? task.id, due: nextDate(task.recurrence, task.due ?? ts.slice(0, 10)),
    };
    ops.push({ entity: 'task', id: newId(), updatedAt: new Date(at.getTime() + 1).toISOString(), deleted: false, data: JSON.parse(JSON.stringify(next)) });
  }
  return { ops, message: `Done: ${task.title}` };
}
