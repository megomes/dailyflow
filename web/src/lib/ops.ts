import { planAsReal, recEnd, type RecordDraft, type ReplanResult, type Span } from './actual';
import { track } from './analytics';
import { getDB } from './db';
import { liveBlocks, nowIso, remove, save, saveMany, uid, update } from './repo';
import { minuteOfDay } from './time';
import { nextDate } from './recurrence';
import type { Day, DayBlock, DayKey, FocusSession, PlanBlock, Priority, Reflection, Revision, Task, TemplateBlock, TimeRecord } from './types';

/**
 * Domain operations for E2–E8. Pages call these; each one writes through repo (local first,
 * queued for sync) and logs the product event the review doc asks for.
 */

export const nowMinute = (dayId: string) => Math.round(minuteOfDay(dayId, new Date()));
const snapshot = (b: DayBlock): PlanBlock => ({ id: b.id, start: b.start, end: b.end, title: b.title, areaId: b.areaId, ...(b.fixed ? { fixed: true } : {}) });

export async function dayBlocks(dayId: string) {
  return liveBlocks(await getDB().dayBlocks.where('dayId').equals(dayId).toArray());
}
export async function dayRecords(dayId: string) {
  return (await getDB().timeRecords.where('dayId').equals(dayId).toArray()).filter(r => !r.deleted);
}

// ── Day lifecycle ──────────────────────────────────────────────────────────

/** Start day: freezes the current plan as the Baseline (spec §6.1). */
export async function startDay(dayId: string, mode: NonNullable<Day['startMode']>, extra: Record<string, unknown> = {}) {
  const day = await getDB().days.get(dayId);
  if (!day || day.status === 'active' || day.status === 'closed') return;
  const blocks = await dayBlocks(dayId);
  await update<Day>('day', dayId, { status: 'active', startedAt: new Date().toISOString(), startMode: mode, baseline: blocks.map(snapshot) });
  track('day_started', { implicit: mode === 'implicit', mode, blocks: blocks.length, ...extra });
}

/** Starting anything on an unplanned day starts it implicitly (no extra click). */
async function ensureStarted(dayId: string) {
  const day = await getDB().days.get(dayId);
  if (day && (!day.status || day.status === 'unplanned')) await startDay(dayId, 'implicit');
}

export async function closeDay(dayId: string, reflection: Reflection | undefined, startedMs: number) {
  const db = getDB();
  const running = (await db.timeRecords.where('dayId').equals(dayId).toArray()).find(r => r.end == null && !r.deleted);
  if (running) await stopActivity(running.id);
  // Unfinished tasks scheduled on this day go back to the Backlog (spec §16–17).
  const tasks = (await db.tasks.where('dayId').equals(dayId).toArray()).filter(t => !t.deleted && t.status === 'today');
  for (const t of tasks) {
    await update<Task>('task', t.id, { status: 'backlog', blockId: undefined, dayId: undefined, carried: [...(t.carried ?? []), dayId] });
  }
  const recs = await dayRecords(dayId);
  const tracked = recs.reduce((s, r) => s + (recEnd(r, r.start) - r.start), 0);
  await update<Day>('day', dayId, { status: 'closed', closedAt: new Date().toISOString(), ...(reflection ? { reflection } : {}) });
  track('day_closed', {
    duration_s: Math.round((Date.now() - startedMs) / 1000), tracked_min: Math.round(tracked), tasks_returned: tasks.length,
    reflection_filled: !!(reflection?.wentWell || reflection?.change), energy: reflection?.energy ?? null,
  });
}

export async function reopenDay(dayId: string) {
  const day = await getDB().days.get(dayId);
  if (!day || day.status !== 'closed') return;
  await update<Day>('day', dayId, { status: 'active', reopenedAt: new Date().toISOString() });
  track('day_reopened', { hours_after_close: day.closedAt ? Math.round((Date.now() - Date.parse(day.closedAt)) / 36e5) : null });
}

// ── Actual time ───────────────────────────────────────────────────────────

export async function runningRecord(): Promise<TimeRecord | undefined> {
  return (await getDB().timeRecords.toArray()).find(r => r.end == null && !r.deleted);
}

/** One activity at a time (US-SYS-002): starting one stops the previous at the same minute. */
export async function startActivity(dayId: string, a: { areaId: string; title: string; blockId?: string; taskId?: string; source: TimeRecord['source'] }, from?: Date) {
  await ensureStarted(dayId);
  // `from` backdates the start (e.g. “since 09:00”): the previous activity ends there.
  const now = from && from.getTime() < Date.now() ? from : new Date();
  const running = await runningRecord();
  if (running) await stopActivity(running.id, now);
  const start = Math.round(minuteOfDay(dayId, now));
  const rec: TimeRecord = {
    id: uid(), dayId, start, end: null, startedAt: now.toISOString(), areaId: a.areaId, title: a.title,
    ...(a.blockId ? { blockId: a.blockId } : {}), ...(a.taskId ? { taskId: a.taskId } : {}),
    source: a.source, createdAt: now.toISOString(), updatedAt: '',
  };
  await save('time_record', rec);
  const block = a.blockId ? await getDB().dayBlocks.get(a.blockId) : undefined;
  track(a.source === 'switch' ? 'activity_switched' : 'block_started', {
    source: a.source, area: a.areaId, delay_min: block ? start - block.start : null, from_plan: !!a.blockId, had_running: !!running,
  });
  return rec;
}

export async function stopActivity(id: string, at = new Date()) {
  const r = await getDB().timeRecords.get(id);
  if (!r || r.end != null) return;
  const end = Math.round(minuteOfDay(r.dayId, at));
  if (end - r.start < 1) { await remove('time_record', id); track('block_finished', { discarded: true }); return; }
  await update<TimeRecord>('time_record', id, { end });
  const block = r.blockId ? await getDB().dayBlocks.get(r.blockId) : undefined;
  track('block_finished', { source: 'live', duration_min: end - r.start, area: r.areaId, delay_min: block ? end - block.end : null });
}

async function markHistorical(dayId: string): Promise<Partial<TimeRecord>> {
  const day = await getDB().days.get(dayId);
  return day?.status === 'closed' ? { editedAfterClose: nowIso() } : {};
}

export async function addRecord(dayId: string, d: RecordDraft, source: TimeRecord['source']) {
  const rec: TimeRecord = {
    id: uid(), dayId, start: d.start, end: d.end, areaId: d.areaId, title: d.title, ...(d.blockId ? { blockId: d.blockId } : {}),
    source, createdAt: new Date().toISOString(), updatedAt: '', ...(await markHistorical(dayId)),
  };
  await save('time_record', rec);
  track('time_record_created', { source, duration_min: d.end - d.start, from_plan: !!d.blockId, area: d.areaId, days_ago: daysAgo(dayId) });
  return rec;
}

export async function updateRecord(id: string, patch: Partial<TimeRecord>, field: string) {
  const r = await getDB().timeRecords.get(id);
  if (!r) return;
  await update<TimeRecord>('time_record', id, { ...patch, ...(await markHistorical(r.dayId)) });
  track('time_record_edited', { field, source: r.source, days_ago: daysAgo(r.dayId) });
}

export async function deleteRecord(id: string) {
  const r = await getDB().timeRecords.get(id);
  await remove('time_record', id);
  if (r) track('time_record_deleted', { source: r.source, duration_min: r.end == null ? null : r.end - r.start, days_ago: daysAgo(r.dayId) });
}

const daysAgo = (dayId: string) => Math.round((Date.now() - new Date(`${dayId}T12:00:00`).getTime()) / 864e5);

/** “Accept plan as real” for the uncovered parts of the plan up to `until` (or within one gap). */
export async function acceptPlanAsReal(dayId: string, until: number, within?: Span, surface = 'close') {
  const [blocks, recs] = await Promise.all([dayBlocks(dayId), dayRecords(dayId)]);
  const drafts = planAsReal(blocks, recs, until, within);
  const extra = await markHistorical(dayId);
  const now = new Date().toISOString();
  await saveMany<TimeRecord>('time_record', drafts.map(d => ({
    id: uid(), dayId, start: d.start, end: d.end, areaId: d.areaId, title: d.title, blockId: d.blockId,
    source: 'plan' as const, createdAt: now, updatedAt: '', ...extra,
  })));
  if (within) track('gap_filled', { method: 'plan', gap_min: within.end - within.start, records: drafts.length, surface });
  else track('plan_accepted_as_real', { blocks: drafts.length, minutes: drafts.reduce((s, d) => s + d.end - d.start, 0), surface });
  return drafts.length;
}

// ── Plan edits and revisions (E3) ─────────────────────────────────────────

async function isStarted(dayId: string) {
  const d = await getDB().days.get(dayId);
  return d?.status === 'active' || d?.status === 'closed';
}

/** A revision is kept for every plan change after Start day; returns its id so a reason can be added. */
export async function recordRevision(dayId: string, kind: Revision['kind'], before: PlanBlock | null, after: PlanBlock | null, extra: Partial<Revision> = {}) {
  if (!(await isStarted(dayId))) return null;
  const db = getDB();
  const day = await db.days.get(dayId);
  const startedAt = day?.startedAt ? Date.parse(day.startedAt) : Date.now();
  const rev: Revision = {
    id: uid(), dayId, ts: new Date().toISOString(), kind, blockId: (after ?? before)?.id, title: (after ?? before)?.title ?? '',
    before, after, updatedAt: '', ...extra,
  };
  await save('revision', rev);
  track('plan_revision_created', { change_type: kind, minutes_since_start: Math.round((Date.now() - startedAt) / 60000), count: extra.count ?? 1 });
  return rev.id;
}

export async function setRevisionReason(id: string, reason: string) {
  await update<Revision>('revision', id, { reason });
  track('revision_reason_set', { reason });
}

export async function addBlock(dayId: string, b: Omit<DayBlock, 'id' | 'dayId' | 'updatedAt'>) {
  const block: DayBlock = { ...b, id: uid(), dayId, updatedAt: '' };
  await save('day_block', block);
  const revId = await recordRevision(dayId, 'add', null, snapshot(block));
  return { id: block.id, revId };
}

export async function patchBlock(id: string, patch: Partial<DayBlock>, kind: Revision['kind']) {
  const before = await getDB().dayBlocks.get(id);
  if (!before) return null;
  const after = await update<DayBlock>('day_block', id, patch);
  if (!after) return null;
  return recordRevision(before.dayId, kind, snapshot(before), snapshot(after));
}

export async function deleteBlock(id: string) {
  const before = await getDB().dayBlocks.get(id);
  if (!before) return null;
  await remove('day_block', id);
  // Tasks in a removed block stay on the day, unassigned.
  const tasks = (await getDB().tasks.where('dayId').equals(before.dayId).toArray()).filter(t => t.blockId === id && !t.deleted);
  for (const t of tasks) await update<Task>('task', t.id, { blockId: undefined });
  return recordRevision(before.dayId, 'remove', snapshot(before), null);
}

export async function applyReplan(dayId: string, r: ReplanResult, removeDropped: boolean) {
  for (const mv of r.moves) await update<DayBlock>('day_block', mv.id, { start: mv.start, end: mv.end });
  if (removeDropped) for (const id of r.dropped) await remove('day_block', id);
  const revId = await recordRevision(dayId, 'replan', null, null, { title: 'Replanned the rest of the day', count: r.moves.length + (removeDropped ? r.dropped.length : 0) });
  track('replan_remaining_used', { accepted: true, moved: r.moves.length, dropped: r.dropped.length, removed: removeDropped });
  return revId;
}

/** Late start (E5): blocks that already ended are removed, the current one starts now. */
export async function lateStart(dayId: string) {
  const now = nowMinute(dayId);
  const blocks = await dayBlocks(dayId);
  let removed = 0;
  for (const b of blocks) {
    if (b.fixed) continue;
    if (b.end <= now) { await remove('day_block', b.id); removed++; }
    else if (b.start < now) await update<DayBlock>('day_block', b.id, { start: Math.ceil(now / 5) * 5 });
  }
  await startDay(dayId, 'late', { skipped_blocks: removed });
}

// ── Tasks (E4) ────────────────────────────────────────────────────────────

export async function createTask(title: string, opts: Partial<Task> = {}, surface = 'palette', startedMs?: number) {
  const t: Task = {
    id: uid(), title: title.trim(), status: 'inbox', createdAt: new Date().toISOString(), sort: Date.now(), updatedAt: '', ...opts,
  };
  await save('task', t);
  track('task_quick_captured', { surface, chars: t.title.length, ms_to_submit: startedMs ? Math.round(performance.now() - startedMs) : null, status: t.status });
  return t;
}

export async function updateTask(id: string, patch: Partial<Task>, fields?: string[]) {
  const t = await update<Task>('task', id, patch);
  if (fields?.length) track('task_triaged', { fields_set: fields });
  return t;
}

/** Schedule a task into a day (and optionally a block). Leaving the Inbox/Backlog. */
export async function scheduleTask(id: string, dayId: string, blockId?: string, surface = 'drag') {
  const t = await getDB().tasks.get(id);
  if (!t) return;
  let areaPatch: Partial<Task> = {};
  if (blockId && !t.areaId) {
    const b = await getDB().dayBlocks.get(blockId);
    if (b) areaPatch = { areaId: b.areaId };
  }
  await update<Task>('task', id, { status: t.status === 'done' ? 'done' : 'today', dayId, blockId, ...areaPatch });
  track('task_scheduled', { target: blockId ? 'block' : 'day', surface, carried: (t.carried ?? []).length });
}

export async function unscheduleTask(id: string) {
  await update<Task>('task', id, { status: 'backlog', dayId: undefined, blockId: undefined });
  track('task_unscheduled', { target: 'backlog' });
}

export async function toggleTaskDone(id: string) {
  const t = await getDB().tasks.get(id);
  if (!t) return;
  if (t.status === 'done') {
    await update<Task>('task', id, { status: t.dayId ? 'today' : 'backlog', doneAt: undefined });
    track('task_reopened', {});
    return;
  }
  await update<Task>('task', id, { status: 'done', doneAt: new Date().toISOString() });
  if (t.recurrence) await createNextOccurrence(t);
  const days = Math.round((Date.now() - Date.parse(t.createdAt)) / 864e5);
  track('task_completed', { had_estimate: !!t.estimate, in_block: !!t.blockId, days_open: days, carried: (t.carried ?? []).length });
}

/** Recurring task completed: the next copy goes to the Backlog with the next due date (E12). */
async function createNextOccurrence(t: Task) {
  const base = t.due ?? new Date().toISOString().slice(0, 10);
  const next: Task = {
    id: uid(), title: t.title, status: 'backlog', createdAt: new Date().toISOString(), sort: Date.now(), updatedAt: '',
    areaId: t.areaId, priority: t.priority, estimate: t.estimate, notes: t.notes, category: t.category, project: t.project, tags: t.tags,
    subtasks: t.subtasks?.map(x => ({ ...x, done: false })), recurrence: t.recurrence, seriesId: t.seriesId ?? t.id, due: nextDate(t.recurrence!, base),
  };
  await save('task', next);
  track('recurrence_next_created', { freq: t.recurrence!.freq });
}

/** Schedule for any day (today or later): the task appears in that day's plan (E12, Q-17). */
export async function scheduleTaskOn(id: string, dayId: string) {
  await update<Task>('task', id, { status: 'today', dayId, blockId: undefined });
  track('task_scheduled', { target: 'future_day', surface: 'detail' });
}

/** Replaces a weekday template with this day's blocks (E12, Q-23). */
export async function saveDayAsTemplate(dayId: string, templateId: DayKey) {
  const db = getDB();
  const [blocks, current] = await Promise.all([dayBlocks(dayId), db.templateBlocks.where('templateId').equals(templateId).toArray()]);
  await saveMany<TemplateBlock>('template_block', current.filter(b => !b.deleted).map(b => ({ ...b, deleted: true })));
  await saveMany<TemplateBlock>('template_block', blocks.map(b => ({
    id: uid(), templateId, start: b.start, end: b.end, title: b.title, areaId: b.areaId, ...(b.fixed ? { fixed: true } : {}), updatedAt: '',
  })));
  track('template_edited', { template: templateId, change: 'saved_from_day', blocks: blocks.length });
  return blocks.length;
}

export async function deleteTask(id: string) {
  await remove('task', id);
  track('task_deleted', {});
}

export const PRIORITIES: Priority[] = ['high', 'med', 'low'];

// ── Focus (E6) ────────────────────────────────────────────────────────────

export interface Preset { id: string; label: string; focus: number; brk: number }
export const PRESETS: Preset[] = [
  { id: '25/5', label: '25 / 5', focus: 25, brk: 5 },
  { id: '30/5', label: '30 / 5', focus: 30, brk: 5 },
  { id: '45/10', label: '45 / 10', focus: 45, brk: 10 },
  { id: '50/10', label: '50 / 10', focus: 50, brk: 10 },
  { id: '60/10', label: '60 / 10', focus: 60, brk: 10 },
  { id: 'stopwatch', label: 'Stopwatch', focus: 0, brk: 0 },
];

export async function activeFocus(): Promise<FocusSession | undefined> {
  return (await getDB().focusSessions.toArray()).find(f => !f.deleted && (f.state === 'running' || f.state === 'paused'));
}

/** Focus seconds elapsed (pauses excluded). */
export function focusElapsedSec(f: FocusSession, at = Date.now()): number {
  const end = f.endedAt ? Date.parse(f.endedAt) : f.pausedAt ? Date.parse(f.pausedAt) : at;
  return Math.max(0, (end - Date.parse(f.startedAt) - f.pausedMs) / 1000);
}

export async function startFocus(dayId: string, o: { preset: Preset; taskId?: string; blockId?: string; areaId: string; title: string; focusMin?: number }) {
  const prev = await activeFocus();
  if (prev) await endFocus(prev.id, 'interrupted');
  const now = new Date().toISOString();
  const f: FocusSession = {
    id: uid(), dayId, ...(o.taskId ? { taskId: o.taskId } : {}), ...(o.blockId ? { blockId: o.blockId } : {}), areaId: o.areaId, title: o.title,
    preset: o.preset.id, focusMin: o.focusMin ?? o.preset.focus, breakMin: o.preset.brk, startedAt: now, pausedMs: 0, state: 'running', updatedAt: '',
  };
  await save('focus_session', f);
  // Focus is also real time: keep (or start) the matching activity.
  const running = await runningRecord();
  if (!running || running.areaId !== o.areaId || (o.taskId && running.taskId !== o.taskId)) {
    await startActivity(dayId, { areaId: o.areaId, title: o.title, blockId: o.blockId, taskId: o.taskId, source: 'focus' });
  }
  if (o.taskId) {
    const t = await getDB().tasks.get(o.taskId);
    if (t && t.status !== 'done' && t.status !== 'today') await scheduleTask(t.id, dayId, o.blockId, 'focus');
  }
  track('focus_session_started', { preset: f.preset, task: !!o.taskId, block: !!o.blockId });
  return f;
}

export async function pauseFocus(id: string) {
  const f = await getDB().focusSessions.get(id);
  if (!f || f.state !== 'running') return;
  await update<FocusSession>('focus_session', id, { state: 'paused', pausedAt: new Date().toISOString() });
  track('focus_paused', {});
}

export async function resumeFocus(id: string) {
  const f = await getDB().focusSessions.get(id);
  if (!f || f.state !== 'paused' || !f.pausedAt) return;
  await update<FocusSession>('focus_session', id, { state: 'running', pausedMs: f.pausedMs + (Date.now() - Date.parse(f.pausedAt)), pausedAt: undefined });
  track('focus_resumed', {});
}

export async function extendFocus(id: string, min = 5) {
  const f = await getDB().focusSessions.get(id);
  if (!f) return;
  await update<FocusSession>('focus_session', id, { focusMin: f.focusMin + min });
  track('focus_extended', { min });
}

/** Ends a session. `at` lets the “forgot the timer” flow end it in the past. */
export async function endFocus(id: string, state: 'done' | 'interrupted', at?: Date, opts: { stopActivity?: boolean; startBreak?: boolean } = {}) {
  const f = await getDB().focusSessions.get(id);
  if (!f || (f.state !== 'running' && f.state !== 'paused')) return;
  let pausedMs = f.pausedMs;
  const endAt = at ?? new Date();
  if (f.pausedAt) pausedMs += Math.max(0, endAt.getTime() - Date.parse(f.pausedAt));
  const actualMin = Math.max(0, Math.round((endAt.getTime() - Date.parse(f.startedAt) - pausedMs) / 60000));
  await update<FocusSession>('focus_session', id, {
    state, endedAt: endAt.toISOString(), pausedAt: undefined, pausedMs, actualMin,
    ...(opts.startBreak && f.breakMin ? { breakStartedAt: endAt.toISOString() } : {}),
  });
  track('focus_session_finished', { planned_min: f.focusMin, actual_min: actualMin, interrupted: state === 'interrupted', preset: f.preset, forgotten: !!at });
  if (opts.stopActivity) {
    const r = await runningRecord();
    if (r) await stopActivity(r.id, endAt);
  }
}

export async function endBreak(id: string, skipped: boolean) {
  await update<FocusSession>('focus_session', id, { breakEndedAt: new Date().toISOString() });
  track(skipped ? 'focus_break_skipped' : 'focus_break_finished', {});
}

export async function editFocusMinutes(id: string, actualMin: number) {
  await update<FocusSession>('focus_session', id, { actualMin });
  track('session_edited', { reason: 'minutes', actual_min: actualMin });
}

export async function deleteFocus(id: string) {
  await remove('focus_session', id);
  track('session_deleted', {});
}

/** Tracked focus minutes per task. */
export function trackedByTask(sessions: FocusSession[]): Map<string, { min: number; count: number }> {
  const m = new Map<string, { min: number; count: number }>();
  for (const s of sessions) {
    if (s.deleted || !s.taskId) continue;
    const min = s.actualMin ?? Math.round(focusElapsedSec(s) / 60);
    const cur = m.get(s.taskId) ?? { min: 0, count: 0 };
    m.set(s.taskId, { min: cur.min + min, count: cur.count + 1 });
  }
  return m;
}

