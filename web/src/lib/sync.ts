import { track } from './analytics';
import { ENTITY_TABLE, getDB, getMeta, setMeta, tableFor } from './db';
import { onLocalWrite } from './repo';
import type { Entity, SyncFields } from './types';

/**
 * Offline-first sync (spec §75): the outbox is pushed, then everything newer than our
 * cursor is pulled. Conflicts resolve last-writer-wins by `updatedAt` (single user).
 */
export interface RemoteChange { entity: Entity; id: string; data: Record<string, unknown>; updatedAt: string; deleted: boolean; seq: number }

export type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; lastSyncedAt: string | null; pending: number };
let state: SyncState = { status: 'idle', lastSyncedAt: null, pending: 0 };
const subs = new Set<(s: SyncState) => void>();
function set(patch: Partial<SyncState>) { state = { ...state, ...patch }; subs.forEach(fn => fn(state)); }
export function subscribeSync(fn: (s: SyncState) => void) { subs.add(fn); fn(state); return () => { subs.delete(fn); }; }
export function getSyncState() { return state; }

/** Applies remote changes that are newer than what this device has. Pure w.r.t. network, tested. */
export async function applyRemote(changes: RemoteChange[]): Promise<number> {
  const db = getDB();
  let applied = 0;
  for (const c of changes) {
    // A newer build may sync entities this one does not know yet: skip them instead of failing the sync.
    if (!(c.entity in ENTITY_TABLE)) continue;
    const table = tableFor(db, c.entity);
    const local = await table.get(c.id);
    if (local && local.updatedAt >= c.updatedAt) continue;
    if (local && (await db.outbox.where('[entity+id]').equals([c.entity, c.id]).count()) > 0) {
      track('sync_conflict', { entity: c.entity, resolution: 'remote_newer_wins' });
    }
    await table.put({ ...(c.data as object), id: c.id, updatedAt: c.updatedAt, deleted: c.deleted } as SyncFields);
    applied++;
  }
  return applied;
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(reason = 'manual'): Promise<void> {
  if (running) { again = true; return running; }
  running = run(reason).finally(() => {
    running = null;
    if (again) { again = false; void syncNow('queued'); }
  });
  return running;
}

async function run(reason: string) {
  const db = getDB();
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    set({ status: 'offline', pending: await db.outbox.count() });
    return;
  }
  set({ status: 'syncing' });
  const started = performance.now();
  try {
    const queued = await db.outbox.toArray();
    const maxSeq = queued.reduce((m, q) => Math.max(m, q.seq ?? 0), 0);
    const seen = new Set<string>();
    const ops = [];
    for (const q of queued) {
      const key = `${q.entity}:${q.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rec = await tableFor(db, q.entity).get(q.id);
      if (!rec) continue;
      const { id, updatedAt, deleted, ...data } = rec as SyncFields & Record<string, unknown>;
      ops.push({ entity: q.entity, id, updatedAt, deleted: !!deleted, data });
    }
    const since = await getMeta<number>('syncCursor', 0);
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ops, since }),
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const body = (await res.json()) as { changes: RemoteChange[]; cursor: number };
    const applied = await applyRemote(body.changes);
    await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
    await setMeta('syncCursor', body.cursor);
    await pushEvents();
    const pending = await db.outbox.count();
    set({ status: 'idle', lastSyncedAt: new Date().toISOString(), pending });
    if (ops.length || applied) track(ops.length ? 'sync_queue_flushed' : 'sync_completed', { reason, pushed: ops.length, pulled: applied, ms: Math.round(performance.now() - started) });
  } catch (err) {
    set({ status: navigator.onLine ? 'error' : 'offline', pending: await db.outbox.count() });
    if (navigator.onLine) track('sync_failed', { reason, message: String((err as Error).message).slice(0, 200) });
  }
}

/** Uploads product events in batches; they stay locally, flagged as synced. */
export async function pushEvents(keepalive = false) {
  const db = getDB();
  for (let i = 0; i < 20; i++) {
    const batch = await db.events.where('synced').equals(0).limit(200).toArray();
    if (!batch.length) return;
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: batch.map(e => { const r: Partial<typeof e> = { ...e }; delete r.synced; return r; }) }),
      keepalive,
    });
    if (!res.ok) throw new Error(`events ${res.status}`);
    await db.events.bulkPut(batch.map(e => ({ ...e, synced: 1 as const })));
  }
}

let debounce: ReturnType<typeof setTimeout> | undefined;
export function startSyncLoop(intervalMs: number) {
  const unsub = onLocalWrite(() => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow('write'), 1200);
  });
  let offlineSince = 0;
  const onOnline = async () => {
    if (offlineSince) track('offline_ended', { duration_s: Math.round((Date.now() - offlineSince) / 1000), ops_queued: await getDB().outbox.count() });
    offlineSince = 0;
    void syncNow('online');
  };
  const onOffline = () => { offlineSince = Date.now(); track('offline_started', {}); set({ status: 'offline' }); };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const timer = setInterval(() => { if (document.visibilityState === 'visible') void syncNow('interval'); }, intervalMs);
  return () => { unsub(); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); clearInterval(timer); };
}
