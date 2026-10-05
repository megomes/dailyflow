import { toCsv } from './csv';
import { ENTITY_TABLE, getDB } from './db';
import type { Entity } from './types';

/** Full export (E12, CAP-K7): every synced table, tombstones excluded. */
export async function exportAll() {
  const db = getDB();
  const out: Record<string, unknown[]> = {};
  for (const [entity, table] of Object.entries(ENTITY_TABLE) as [Entity, string][]) {
    const rows = await (db as unknown as Record<string, { toArray(): Promise<{ deleted?: boolean }[]> }>)[table].toArray();
    out[entity] = rows.filter(r => !r.deleted);
  }
  return { app: 'DailyFlow', version: 1, exportedAt: new Date().toISOString(), data: out };
}

/** One CSV per entity, flattened (objects/arrays become JSON strings). */
export function entityCsv(rows: Record<string, unknown>[]): string {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  return toCsv(rows, cols);
}

export { download } from './csv';
