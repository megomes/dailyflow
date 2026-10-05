import { SEED_AREAS, SEED_TEMPLATE_BLOCKS } from '@shared/seed';
import { logicalDay, minuteOfDay, setCutoffHour, templateIdForDate } from '@shared/time';
import type { Area, Day, DayBlock, FocusSession, Prefs, Task, TemplateBlock, TimeRecord } from '@shared/types';
import { get, patch, put, rows, rowsAll, uid } from './store';

/**
 * Phone versions of the web domain operations (web/src/lib/ops.ts). Same records, same rules,
 * so a day can be lived on the phone and closed on the desktop.
 */

export function applyPrefs() {
  const p = get<Prefs>('pref', 'prefs');
  if (p?.dayCutoffHour != null) setCutoffHour(p.dayCutoffHour);
}

/** Seeds every device has, overridden by any synced edit with the same id. */
export function areas(): Area[] {
  const synced = new Map(rows<Area>('area').map(a => [a.id, a]));
  const all = new Map(SEED_AREAS.map(a => [a.id, a]));
  for (const [id, a] of synced) all.set(id, a);
  for (const a of rowsAll<Area>('area')) if (a.deleted) all.delete(a.id);
  return [...all.values()].filter(a => !a.archived).sort((a, b) => a.sort - b.sort);
}

/** Template of a weekday: seeds overridden by synced edits (tombstones remove seeds). */
function templateBlocks(templateId: string): TemplateBlock[] {
  const all = new Map(SEED_TEMPLATE_BLOCKS.map(b => [b.id, b]));
  for (const b of rowsAll<TemplateBlock>('template_block')) all.set(b.id, b);
  return [...all.values()].filter(b => !b.deleted && b.templateId === templateId);
}

export const today = () => logicalDay();
export const nowMinute = (dayId: string) => Math.round(minuteOfDay(dayId, new Date()));

/** Same deterministic ids as the web, so phone and desktop create the very same day. */
export function ensureDay(dayId: string) {
  if (get<Day>('day', dayId)) return;
  const templateId = templateIdForDate(dayId);
  put<Day>('day', { id: dayId, templateId, createdAt: new Date().toISOString(), updatedAt: '' });
  for (const b of templateBlocks(templateId)) {
    put<DayBlock>('day_block', { id: `${dayId}:${b.id}`, dayId, start: b.start, end: b.end, title: b.title, areaId: b.areaId, fromTemplate: b.id, ...(b.fixed ? { fixed: true } : {}), updatedAt: '' });
  }
}

export function dayBlocks(dayId: string) {
  return rows<DayBlock>('day_block').filter(b => b.dayId === dayId).sort((a, b) => a.start - b.start);
}
export function dayRecords(dayId: string) {
  return rows<TimeRecord>('time_record').filter(r => r.dayId === dayId).sort((a, b) => a.start - b.start);
}
export const runningRecord = () => rows<TimeRecord>('time_record').find(r => r.end == null);
export const activeFocus = () => rows<FocusSession>('focus_session').find(f => f.state === 'running' || f.state === 'paused');

export function startDay(dayId: string, mode: Day['startMode'] = 'quick') {
  const d = get<Day>('day', dayId);
  if (!d || d.status === 'active' || d.status === 'closed') return;
  patch<Day>('day', dayId, {
    status: 'active', startedAt: new Date().toISOString(), startMode: mode,
    baseline: dayBlocks(dayId).map(b => ({ id: b.id, start: b.start, end: b.end, title: b.title, areaId: b.areaId, ...(b.fixed ? { fixed: true } : {}) })),
  });
}

export function stopActivity(id: string, at = new Date()) {
  const r = get<TimeRecord>('time_record', id);
  if (!r || r.end != null) return;
  const end = Math.round(minuteOfDay(r.dayId, at));
  if (end - r.start < 1) patch<TimeRecord>('time_record', id, { deleted: true });
  else patch<TimeRecord>('time_record', id, { end });
}

export function startActivity(dayId: string, a: { areaId: string; title: string; blockId?: string; taskId?: string; source: TimeRecord['source'] }) {
  const d = get<Day>('day', dayId);
  if (d && (!d.status || d.status === 'unplanned')) startDay(dayId, 'implicit');
  const now = new Date();
  const run = runningRecord();
  if (run) stopActivity(run.id, now);
  return put<TimeRecord>('time_record', {
    id: uid(), dayId, start: Math.round(minuteOfDay(dayId, now)), end: null, startedAt: now.toISOString(), areaId: a.areaId, title: a.title,
    ...(a.blockId ? { blockId: a.blockId } : {}), ...(a.taskId ? { taskId: a.taskId } : {}), source: a.source, createdAt: now.toISOString(), updatedAt: '',
  });
}

export function createTask(title: string, dayId?: string) {
  return put<Task>('task', { id: uid(), title: title.trim(), status: dayId ? 'today' : 'inbox', ...(dayId ? { dayId } : {}), createdAt: new Date().toISOString(), sort: Date.now(), updatedAt: '' });
}
export function toggleTask(id: string) {
  const t = get<Task>('task', id);
  if (!t) return;
  if (t.status === 'done') patch<Task>('task', id, { status: t.dayId ? 'today' : 'backlog', doneAt: undefined });
  else patch<Task>('task', id, { status: 'done', doneAt: new Date().toISOString() });
}

export const PRESETS = [
  { id: '25/5', focus: 25, brk: 5 }, { id: '50/10', focus: 50, brk: 10 }, { id: '90/15', focus: 90, brk: 15 }, { id: 'stopwatch', focus: 0, brk: 0 },
];

export function startFocus(dayId: string, p: { id: string; focus: number; brk: number }, ctx: { areaId: string; title: string; blockId?: string; taskId?: string }) {
  const prev = activeFocus();
  if (prev) endFocus(prev.id, 'interrupted');
  const now = new Date().toISOString();
  const run = runningRecord();
  if (!run || run.areaId !== ctx.areaId) startActivity(dayId, { ...ctx, source: 'focus' });
  return put<FocusSession>('focus_session', {
    id: uid(), dayId, ...(ctx.taskId ? { taskId: ctx.taskId } : {}), ...(ctx.blockId ? { blockId: ctx.blockId } : {}), areaId: ctx.areaId, title: ctx.title,
    preset: p.id, focusMin: p.focus, breakMin: p.brk, startedAt: now, pausedMs: 0, state: 'running', updatedAt: '',
  });
}

export function focusElapsedSec(f: FocusSession, at = Date.now()) {
  const end = f.endedAt ? Date.parse(f.endedAt) : f.pausedAt ? Date.parse(f.pausedAt) : at;
  return Math.max(0, (end - Date.parse(f.startedAt) - f.pausedMs) / 1000);
}

export function pauseFocus(id: string) { patch<FocusSession>('focus_session', id, { state: 'paused', pausedAt: new Date().toISOString() }); }
export function resumeFocus(id: string) {
  const f = get<FocusSession>('focus_session', id);
  if (f?.pausedAt) patch<FocusSession>('focus_session', id, { state: 'running', pausedMs: f.pausedMs + (Date.now() - Date.parse(f.pausedAt)), pausedAt: undefined });
}
export function endFocus(id: string, state: 'done' | 'interrupted') {
  const f = get<FocusSession>('focus_session', id);
  if (!f) return;
  let pausedMs = f.pausedMs;
  if (f.pausedAt) pausedMs += Date.now() - Date.parse(f.pausedAt);
  const actualMin = Math.max(0, Math.round((Date.now() - Date.parse(f.startedAt) - pausedMs) / 60000));
  patch<FocusSession>('focus_session', id, { state, endedAt: new Date().toISOString(), pausedAt: undefined, pausedMs, actualMin });
}

export function todayTasks(dayId: string) {
  return rows<Task>('task').filter(t => (t.status === 'today' && t.dayId === dayId) || (t.status === 'done' && t.dayId === dayId)).sort((a, b) => a.sort - b.sort);
}
export function inboxTasks() {
  return rows<Task>('task').filter(t => t.status === 'inbox' || t.status === 'backlog').sort((a, b) => (a.priority === 'high' ? -1 : 0) - (b.priority === 'high' ? -1 : 0) || b.sort - a.sort);
}
