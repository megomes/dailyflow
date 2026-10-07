import { getDB, getMeta, setMeta, tableFor } from './db';
import { dayBlockId, SEED_AREAS, SEED_TEMPLATE_BLOCKS } from './seed';
import { DAY_KEYS, templateIdForDate } from './time';
import type { Area, Day, DayBlock, DayKey, Entity, SyncFields, Task, TemplateBlock } from './types';

type Listener = () => void;
const listeners = new Set<Listener>();
/** sync.ts subscribes to push soon after local writes. */
export function onLocalWrite(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

/** Strictly increasing ISO timestamps, so two writes in the same millisecond still order correctly. */
let lastTs = 0;
export function nowIso(): string {
  const t = Math.max(Date.now(), lastTs + 1);
  lastTs = t;
  return new Date(t).toISOString();
}

export function uid(): string {
  return crypto.randomUUID();
}

/** Every mutation goes through here: write locally, queue for the server, notify sync. */
export async function save<T extends SyncFields>(entity: Entity, record: T): Promise<T> {
  const db = getDB();
  const next = { ...record, updatedAt: nowIso() };
  await db.transaction('rw', [tableFor(db, entity), db.outbox], async () => {
    await tableFor(db, entity).put(next);
    await db.outbox.add({ entity, id: next.id });
  });
  listeners.forEach(fn => fn());
  return next;
}

export async function saveMany<T extends SyncFields>(entity: Entity, records: T[]): Promise<void> {
  if (!records.length) return;
  const db = getDB();
  await db.transaction('rw', [tableFor(db, entity), db.outbox], async () => {
    for (const r of records) {
      const next = { ...r, updatedAt: nowIso() };
      await tableFor(db, entity).put(next);
      await db.outbox.add({ entity, id: next.id });
    }
  });
  listeners.forEach(fn => fn());
}

/**
 * Merges a patch into the latest stored record (read inside the transaction), so rapid
 * successive edits never overwrite each other with a stale copy.
 */
export async function update<T extends SyncFields>(entity: Entity, id: string, patch: Partial<T>): Promise<T | null> {
  const db = getDB();
  const table = tableFor(db, entity);
  let next: T | null = null;
  await db.transaction('rw', [table, db.outbox], async () => {
    const current = await table.get(id);
    if (!current) return;
    next = { ...(current as T), ...patch, id, updatedAt: nowIso() };
    await table.put(next);
    await db.outbox.add({ entity, id });
  });
  if (next) listeners.forEach(fn => fn());
  return next;
}

/** Soft delete: the tombstone syncs so other devices remove it too. */
export async function remove(entity: Entity, id: string): Promise<void> {
  await update(entity, id, { deleted: true });
}

/** Seeds areas and templates on a fresh device. Seeds are not queued: every device has them. */
export async function seedIfEmpty(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.areas, db.templateBlocks, async () => {
    if ((await db.areas.count()) === 0) await db.areas.bulkPut(SEED_AREAS);
    // Seed areas added later (Wasted time, note #48) reach existing devices too; an edit or delete synced from elsewhere is newer and wins.
    else {
      const have = new Set((await db.areas.toArray()).map(a => a.id));
      const missing = SEED_AREAS.filter(a => !have.has(a.id));
      if (missing.length) await db.areas.bulkPut(missing);
    }
    if ((await db.templateBlocks.count()) === 0) await db.templateBlocks.bulkPut(SEED_TEMPLATE_BLOCKS);
  });
}

/**
 * One-time move from Weekday/Weekend to one template per weekday (note #2): Monday–Friday get
 * copies of the (possibly edited) Weekday blocks, Saturday/Sunday of the Weekend ones, and the
 * old blocks are tombstoned. Ids are deterministic so two devices migrating agree. Only runs
 * after a successful sync in this session, so it starts from the latest server state.
 * Returns the number of blocks created.
 */
export async function migrateToDayTemplates(syncedThisSession: boolean): Promise<number> {
  if (await getMeta<boolean>('tplPerWeekday', false)) return 0;
  const db = getDB();
  const all = await db.templateBlocks.toArray();
  const legacy = all.filter(b => b.templateId === 'weekday' || b.templateId === 'weekend');
  const hasDays = all.some(b => (DAY_KEYS as readonly string[]).includes(b.templateId) && !b.deleted);
  if (!legacy.length || hasDays) { await setMeta('tplPerWeekday', true); return 0; }
  if (!syncedThisSession) return 0;
  const live = legacy.filter(b => !b.deleted);
  const copies: TemplateBlock[] = DAY_KEYS.flatMap(d => {
    const source = d === 'sat' || d === 'sun' ? 'weekend' : 'weekday';
    return live.filter(b => b.templateId === source).map(b => ({ ...b, id: dayBlockId(d, b.id), templateId: d }));
  });
  await saveMany('template_block', copies);
  await saveMany('template_block', live.map(b => ({ ...b, deleted: true })));
  await setMeta('tplPerWeekday', true);
  return copies.length;
}

/** Replaces a day's template with a copy of another day's blocks. Returns how many were copied. */
export async function copyTemplate(from: DayKey, to: DayKey): Promise<number> {
  if (from === to) return 0;
  const db = getDB();
  const [src, dst] = await Promise.all([
    db.templateBlocks.where('templateId').equals(from).toArray(),
    db.templateBlocks.where('templateId').equals(to).toArray(),
  ]);
  await saveMany('template_block', dst.filter(b => !b.deleted).map(b => ({ ...b, deleted: true })));
  const copies = src.filter(b => !b.deleted).map(b => ({ ...b, id: uid(), templateId: to }));
  await saveMany('template_block', copies);
  return copies.length;
}

/**
 * Creates the day from its template the first time it is opened. Block ids are derived from
 * the date and the template block, so two devices creating the same day produce the same ids.
 * Also repairs a day that a stale pre-per-weekday build created from the (now tombstoned)
 * Weekday/Weekend template: legacy template id and no blocks at all, not even deleted ones,
 * so it was never touched.
 * An unplanned day you have not edited yet follows later edits to its template (note #55).
 * Returns true when the day was created (or refilled) now.
 */
export async function ensureDay(dayId: string): Promise<boolean> {
  const db = getDB();
  const existing = await db.days.get(dayId);
  if (existing && !existing.deleted) {
    const legacy = existing.templateId === 'weekday' || existing.templateId === 'weekend';
    if (!legacy || (await db.dayBlocks.where('dayId').equals(dayId).count()) > 0) {
      if (!legacy && (await staleTemplateCopy(existing))) await copyTemplateToDay(existing);
      return false;
    }
  }
  const templateId = templateIdForDate(dayId);
  const tBlocks = (await db.templateBlocks.where('templateId').equals(templateId).toArray()).filter(b => !b.deleted);
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const blocks: DayBlock[] = tBlocks.map(b => ({
    id: `${dayId}:${b.id}`, dayId, start: b.start, end: b.end, title: b.title, areaId: b.areaId, fromTemplate: b.id, updatedAt: '',
    ...(b.fixed ? { fixed: true } : {}),
  }));
  await saveMany('day_block', blocks);
  // Stamped after the blocks: a block written later than this was edited (note #55).
  await save<Day>('day', { id: dayId, templateId, createdAt, templateAt: nowIso(), updatedAt: '' });
  return true;
}

/** Days created before `templateAt` existed: their blocks were written right after `createdAt`. */
const LEGACY_SLACK_MS = 10_000;

/**
 * The day is still the untouched copy of its template (not started; no block added, moved, renamed
 * or removed since; calendar events don't count) but no longer matches it: the template was edited
 * after the copy, or the copy was made from a template that had not synced yet.
 */
async function staleTemplateCopy(day: Day): Promise<boolean> {
  if (day.status && day.status !== 'unplanned') return false;
  const db = getDB();
  const copiedAt = Date.parse(day.templateAt ?? day.createdAt);
  if (!copiedAt) return false;
  const untilAt = day.templateAt ? copiedAt : copiedAt + LEGACY_SLACK_MS;
  const [tBlocks, all] = await Promise.all([
    db.templateBlocks.where('templateId').equals(day.templateId).toArray(),
    db.dayBlocks.where('dayId').equals(day.id).toArray(),
  ]);
  const blocks = all.filter(b => !b.calendar);
  if (!blocks.every(b => b.fromTemplate && Date.parse(b.updatedAt) <= untilAt)) return false;
  const key = (id: string, x: { start: number; end: number; title: string; areaId: string; fixed?: boolean }) => [id, x.start, x.end, x.title, x.areaId, !!x.fixed].join('|');
  const want = tBlocks.filter(t => !t.deleted).map(t => key(t.id, t)).sort().join('\n');
  const have = blocks.filter(b => !b.deleted).map(b => key(b.fromTemplate!, b)).sort().join('\n');
  return want !== have;
}

/**
 * Makes the day's plan its template again: template blocks get the template's times, names and
 * areas (same ids, so their tasks stay), blocks not in the template are removed (their tasks stay on
 * the day, unassigned) and calendar events are left alone. Returns how many blocks it wrote.
 */
export async function copyTemplateToDay(day: Day): Promise<number> {
  const db = getDB();
  const templateId = day.templateId === 'weekday' || day.templateId === 'weekend' ? templateIdForDate(day.id) : day.templateId;
  const [tBlocks, current] = await Promise.all([
    db.templateBlocks.where('templateId').equals(templateId).toArray(),
    db.dayBlocks.where('dayId').equals(day.id).toArray(),
  ]);
  const live = tBlocks.filter(t => !t.deleted);
  const ids = new Set(live.map(t => `${day.id}:${t.id}`));
  const gone = current.filter(b => !b.deleted && !b.calendar && !ids.has(b.id));
  await saveMany<DayBlock>('day_block', gone.map(b => ({ ...b, deleted: true })));
  const orphaned = (await db.tasks.where('dayId').equals(day.id).toArray()).filter(t => !t.deleted && t.blockId && gone.some(b => b.id === t.blockId));
  await saveMany<Task>('task', orphaned.map(t => ({ ...t, blockId: undefined })));
  const blocks: DayBlock[] = live.map(t => ({
    id: `${day.id}:${t.id}`, dayId: day.id, start: t.start, end: t.end, title: t.title, areaId: t.areaId, fromTemplate: t.id, updatedAt: '',
    ...(t.fixed ? { fixed: true } : {}),
  }));
  await saveMany('day_block', blocks);
  await update<Day>('day', day.id, { templateId, templateAt: nowIso() });
  return blocks.length + gone.length;
}

export function liveBlocks<T extends { deleted?: boolean; start: number }>(rows: T[]): T[] {
  return rows.filter(r => !r.deleted).sort((a, b) => a.start - b.start);
}

export function activeAreas(rows: Area[]): Area[] {
  return rows.filter(a => !a.deleted && !a.archived).sort((a, b) => a.sort - b.sort);
}

export type { Area, DayBlock, TemplateBlock };
