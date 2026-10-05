import type { DayBlock, TimeRecord } from './types';
import { logicalAt } from './zone';

/**
 * Quick actions for surfaces that cannot run the full app (Wear OS, widget buttons): start the
 * current block or stop the running activity, as sync ops (pure; the route writes them).
 */
export interface QuickOp { entity: 'time_record'; id: string; updatedAt: string; deleted: boolean; data: Record<string, unknown> }

export function quickOps(action: 'start' | 'stop', rows: { blocks: DayBlock[]; records: TimeRecord[] }, at: Date, tz: string, cutoff: number, newId: () => string): { ops: QuickOp[]; message: string } {
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
  const blocks = rows.blocks.filter(b => !b.deleted && b.dayId === day && b.start <= min && min < b.end).sort((a, b) => a.start - b.start);
  const block = blocks[blocks.length - 1];
  if (!block) return { ops, message: 'Nothing planned now' };
  if (running?.blockId === block.id) return { ops, message: `Already on ${block.title}` };
  if (running) stop(running);
  ops.push({ entity: 'time_record', id: newId(), updatedAt: new Date(at.getTime() + 1).toISOString(), deleted: false, data: {
    dayId: day, start: min, end: null, startedAt: ts, areaId: block.areaId, title: block.title, blockId: block.id, source: 'live', createdAt: ts,
  } });
  return { ops, message: `Started ${block.title}` };
}
