import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Entity, SyncFields } from '@shared/types';
import { api, getCredential } from './auth';

/**
 * Local-first store for the phone, same contract as the web (/api/sync, last writer wins by
 * updatedAt). Everything lives in memory and is persisted to AsyncStorage as one document.
 */
type Table = Record<string, SyncFields & Record<string, unknown>>;
interface Persisted { cursor: number; tables: Partial<Record<Entity, Table>>; outbox: { entity: Entity; id: string }[] }

const KEY = 'df.store.v1';
let data: Persisted = { cursor: 0, tables: {}, outbox: [] };
let loaded = false;
let version = 0;
const subs = new Set<() => void>();

export type SyncStatus = { state: 'idle' | 'syncing' | 'offline' | 'error'; at: number | null; pending: number; error?: string };
let status: SyncStatus = { state: 'idle', at: null, pending: 0 };

function emit() { version++; subs.forEach(f => f()); }
export function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }
export const getVersion = () => version;
export const getStatus = () => status;

export async function load() {
  if (loaded) return;
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) data = JSON.parse(raw) as Persisted;
  loaded = true;
  emit();
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void AsyncStorage.setItem(KEY, JSON.stringify(data)); }, 300);
}

export function rows<T>(entity: Entity): T[] {
  return Object.values(data.tables[entity] ?? {}).filter(r => !r.deleted) as unknown as T[];
}
/** Including tombstones (a deleted template block must hide its seed). */
export function rowsAll<T>(entity: Entity): T[] {
  return Object.values(data.tables[entity] ?? {}) as unknown as T[];
}
export function get<T>(entity: Entity, id: string): T | undefined {
  return data.tables[entity]?.[id] as unknown as T | undefined;
}

let lastTs = 0;
export function nowIso() { const t = Math.max(Date.now(), lastTs + 1); lastTs = t; return new Date(t).toISOString(); }
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

/** Every local write: store, queue, notify, sync soon. */
export function put<T extends SyncFields>(entity: Entity, rec: T): T {
  const next = { ...rec, updatedAt: nowIso() };
  data.tables[entity] = { ...(data.tables[entity] ?? {}), [next.id]: next as unknown as Table[string] };
  data.outbox.push({ entity, id: next.id });
  persist();
  emit();
  scheduleSync();
  return next;
}
export function patch<T extends SyncFields>(entity: Entity, id: string, p: Partial<T>): T | undefined {
  const cur = get<T>(entity, id);
  if (!cur) return undefined;
  return put(entity, { ...cur, ...p, id });
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => void syncNow('write'), 1200); }

let running: Promise<void> | null = null;
export function syncNow(reason = 'manual'): Promise<void> {
  if (running) return running;
  running = run(reason).finally(() => { running = null; });
  return running;
}

async function run(_reason: string) {
  const cred = await getCredential();
  if (!cred) return;
  status = { ...status, state: 'syncing' }; emit();
  try {
    const queued = [...data.outbox];
    const seen = new Set<string>();
    const ops = [];
    for (const q of queued) {
      const k = `${q.entity}:${q.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const rec = data.tables[q.entity]?.[q.id];
      if (!rec) continue;
      const { id, updatedAt, deleted, ...rest } = rec;
      ops.push({ entity: q.entity, id, updatedAt, deleted: !!deleted, data: rest });
    }
    const res = await api(cred, '/api/sync', { method: 'POST', body: JSON.stringify({ ops, since: data.cursor }) });
    if (res.status === 401) throw new Error('This device is no longer paired.');
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const body = (await res.json()) as { changes: { entity: Entity; id: string; data: Record<string, unknown>; updatedAt: string; deleted: boolean }[]; cursor: number };
    for (const c of body.changes) {
      const t = (data.tables[c.entity] ??= {});
      const local = t[c.id];
      if (local && local.updatedAt >= c.updatedAt) continue;
      t[c.id] = { ...c.data, id: c.id, updatedAt: c.updatedAt, deleted: c.deleted } as Table[string];
    }
    data.outbox = data.outbox.slice(queued.length);
    data.cursor = body.cursor;
    persist();
    status = { state: 'idle', at: Date.now(), pending: data.outbox.length };
  } catch (e) {
    const msg = String((e as Error).message);
    status = { state: /Network request failed/.test(msg) ? 'offline' : 'error', at: status.at, pending: data.outbox.length, error: msg };
  }
  emit();
}

export async function resetStore() {
  data = { cursor: 0, tables: {}, outbox: [] };
  await AsyncStorage.removeItem(KEY);
  emit();
}
