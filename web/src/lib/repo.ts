import { getDB, tableFor } from './db';
import { SEED_AREAS, SEED_TEMPLATE_BLOCKS } from './seed';
import { templateIdForDate } from './time';
import type { Area, Day, DayBlock, Entity, SyncFields, TemplateBlock } from './types';

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
    if ((await db.templateBlocks.count()) === 0) await db.templateBlocks.bulkPut(SEED_TEMPLATE_BLOCKS);
  });
}

/**
 * Creates the day from its template the first time it is opened. Block ids are derived from
 * the date and the template block, so two devices creating the same day produce the same ids.
 * Returns true when the day was created now.
 */
export async function ensureDay(dayId: string): Promise<boolean> {
  const db = getDB();
  const existing = await db.days.get(dayId);
  if (existing && !existing.deleted) return false;
  const templateId = templateIdForDate(dayId);
  const tBlocks = (await db.templateBlocks.where('templateId').equals(templateId).toArray()).filter(b => !b.deleted);
  const day: Day = { id: dayId, templateId, createdAt: new Date().toISOString(), updatedAt: '' };
  const blocks: DayBlock[] = tBlocks.map(b => ({
    id: `${dayId}:${b.id}`, dayId, start: b.start, end: b.end, title: b.title, areaId: b.areaId, fromTemplate: b.id, updatedAt: '',
  }));
  await save('day', day);
  await saveMany('day_block', blocks);
  return true;
}

export function liveBlocks<T extends { deleted?: boolean; start: number }>(rows: T[]): T[] {
  return rows.filter(r => !r.deleted).sort((a, b) => a.start - b.start);
}

export function activeAreas(rows: Area[]): Area[] {
  return rows.filter(a => !a.deleted && !a.archived).sort((a, b) => a.sort - b.sort);
}

export type { Area, DayBlock, TemplateBlock };
