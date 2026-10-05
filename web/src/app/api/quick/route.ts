import { z } from 'zod';
import { DAY_CUTOFF_HOUR } from '@/lib/config';
import { quickOps } from '@/lib/quick';
import { requireDevice, sql, unauthorized } from '@/lib/server';
import type { DayBlock, TimeRecord } from '@/lib/types';
import { logicalAt } from '@/lib/zone';

const Body = z.object({ action: z.enum(['start', 'stop']), tz: z.string().max(64).default('America/Sao_Paulo') });

/** POST /api/quick {action:'start'|'stop'} — Wear OS and widget buttons (EH). Same LWW write as /api/sync. */
export async function POST(req: Request) {
  const deviceId = await requireDevice();
  if (!deviceId) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { action, tz } = parsed.data;
  try { Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return Response.json({ error: 'tz' }, { status: 400 }); }
  const db = sql();
  const prefs = (await db.query(`select data from sync_records where entity = 'pref' and id = 'prefs' and not deleted`)) as { data: { dayCutoffHour?: number } }[];
  const cutoff = prefs[0]?.data.dayCutoffHour ?? DAY_CUTOFF_HOUR;
  const now = new Date();
  const { day } = logicalAt(now, tz, cutoff);
  type Row = { entity: string; id: string; data: Record<string, unknown>; updated_at: string };
  const rows = (await db.query(
    `select entity, id, data, updated_at from sync_records where not deleted and (
       (entity = 'day_block' and data->>'dayId' = $1) or (entity = 'time_record' and data->'end' = 'null'::jsonb))`,
    [day],
  )) as Row[];
  const as = <T,>(e: string) => rows.filter(r => r.entity === e).map(r => ({ ...r.data, id: r.id, updatedAt: new Date(r.updated_at).toISOString() }) as unknown as T);
  const { ops, message } = quickOps(action, { blocks: as<DayBlock>('day_block'), records: as<TimeRecord>('time_record') }, now, tz, cutoff, () => crypto.randomUUID());
  if (ops.length) {
    await db.query(
      `insert into sync_records (entity, id, data, deleted, updated_at, device_id)
       select x.entity, x.id, x.data, x.deleted, x.updated_at, $2
       from jsonb_to_recordset($1::jsonb) as x(entity text, id text, data jsonb, deleted boolean, updated_at timestamptz)
       on conflict (entity, id) do update
         set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at, device_id = excluded.device_id, seq = nextval('sync_seq')
         where sync_records.updated_at < excluded.updated_at`,
      [JSON.stringify(ops.map(o => ({ entity: o.entity, id: o.id, data: o.data, deleted: o.deleted, updated_at: o.updatedAt }))), deviceId],
    );
  }
  return Response.json({ ok: true, message, changed: ops.length });
}
