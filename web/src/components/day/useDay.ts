'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { getDB } from '@/lib/db';
import { liveBlocks } from '@/lib/repo';
import { logicalDay } from '@/lib/time';
import type { Area, Day, DayBlock, DayStatus, FocusSession, Revision, Task, TimeRecord } from '@/lib/types';

export interface DayData {
  day: Day | undefined;
  status: DayStatus;
  blocks: DayBlock[];
  records: TimeRecord[];
  tasks: Task[];
  revisions: Revision[];
  sessions: FocusSession[];
  areas: Area[];
  areaMap: Map<string, Area>;
  ready: boolean;
}

/** Everything a day screen needs, live from IndexedDB. */
export function useDay(dayId: string): DayData {
  const db = getDB();
  const day = useLiveQuery(() => db.days.get(dayId), [dayId]);
  const blockRows = useLiveQuery(() => db.dayBlocks.where('dayId').equals(dayId).toArray(), [dayId]);
  const recRows = useLiveQuery(() => db.timeRecords.where('dayId').equals(dayId).toArray(), [dayId]);
  const taskRows = useLiveQuery(() => db.tasks.where('dayId').equals(dayId).toArray(), [dayId]);
  const revRows = useLiveQuery(() => db.revisions.where('dayId').equals(dayId).toArray(), [dayId]);
  const sesRows = useLiveQuery(() => db.focusSessions.where('dayId').equals(dayId).toArray(), [dayId]);
  const areas = useLiveQuery(() => db.areas.toArray(), []);

  return useMemo(() => {
    // Sleep is not a block (note #29): old Sleep blocks stay in the data but never show up in the day.
    const blocks = liveBlocks(blockRows ?? []).filter(b => b.areaId !== 'area-sleep');
    const records = (recRows ?? []).filter(r => !r.deleted).sort((a, b) => a.start - b.start);
    const tasks = (taskRows ?? []).filter(t => !t.deleted).sort((a, b) => a.sort - b.sort);
    const revisions = (revRows ?? []).filter(r => !r.deleted).sort((a, b) => a.ts.localeCompare(b.ts));
    const sessions = (sesRows ?? []).filter(s => !s.deleted).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const status: DayStatus = day?.status ?? 'unplanned';
    const list = areas ?? [];
    return {
      day, status, blocks, records, tasks, revisions, sessions, areas: list, areaMap: new Map(list.map(a => [a.id, a])),
      ready: !!(blockRows && recRows && taskRows && areas),
    };
  }, [day, blockRows, recRows, taskRows, revRows, sesRows, areas]);
}

/** Backlog/Inbox tasks not scheduled on any day, for the tray and planning. */
export function useOpenTasks(forDay?: string) {
  const rows = useLiveQuery(() => getDB().tasks.where('status').anyOf('inbox', 'backlog').toArray(), []);
  // Snoozed tasks stay out of sight until their day.
  // Planning another day (tomorrow) sees what was snoozed until that day (note #30).
  const today = forDay ?? logicalDay();
  return useMemo(() => (rows ?? []).filter(t => !t.deleted && !(t.deferUntil && t.deferUntil > today)).sort((a, b) => prioRank(a) - prioRank(b) || a.sort - b.sort), [rows, today]);
}

export function useAllSessions() {
  return useLiveQuery(() => getDB().focusSessions.toArray(), []) ?? [];
}

export const prioRank = (t: Task) => (t.priority === 'high' ? 0 : t.priority === 'med' ? 1 : t.priority === 'low' ? 2 : 1.5);

/** The global running activity and focus session (any day). */
export function useLive() {
  const open = useLiveQuery(async () => (await getDB().timeRecords.toArray()).filter(r => r.end == null && !r.deleted), []);
  const rec = open?.find(r => !r.alongside);
  const alongside = useMemo(() => (open ?? []).filter(r => r.alongside).sort((a, b) => a.start - b.start), [open]);
  const focus = useLiveQuery(async () => (await getDB().focusSessions.toArray())
    .filter(f => !f.deleted && (f.state === 'running' || f.state === 'paused' || (f.breakStartedAt && !f.breakEndedAt)))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0], []);
  return { running: rec, alongside, focus };
}
