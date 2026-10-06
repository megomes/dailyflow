import { z } from 'zod';
import { fromHealth, supersededManual } from '@/lib/sleepImport';
import { requireDevice, sql, unauthorized } from '@/lib/server';

const Body = z.object({
  tz: z.string().max(64).default('America/Sao_Paulo'),
  sessions: z.array(z.object({
    id: z.string().min(1).max(200),
    start: z.string().datetime(),
    end: z.string().datetime(),
    stages: z.array(z.object({ stage: z.number().int(), start: z.string().datetime(), end: z.string().datetime() })).max(400).optional(),
  })).max(60),
});

/**
 * POST /api/sleep/import — the Android app sends the sleep sessions it read from Health Connect
 * (Samsung Health). Upserts them as sleep records (a night you fixed by hand on a device is left as
 * you left it) and retires manual nights the watch now covers. Devices get them through /api/sync.
 */
export async function POST(req: Request) {
  const deviceId = await requireDevice();
  if (!deviceId) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { tz, sessions } = parsed.data;
  try { Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return Response.json({ error: 'tz' }, { status: 400 }); }
  const rows = sessions.filter(s => Date.parse(s.end) > Date.parse(s.start)).map(s => fromHealth(s, tz));
  if (!rows.length) return Response.json({ ok: true, imported: 0, replaced: 0 });
  const db = sql();
  await db.query(
    `insert into sync_records (entity, id, data, deleted, updated_at, device_id)
     select 'sleep', x.id, x.data, false, now(), 'server' from jsonb_to_recordset($1::jsonb) as x(id text, data jsonb)
     on conflict (entity, id) do update set data = excluded.data, deleted = false, updated_at = now(), seq = nextval('sync_seq'), device_id = 'server'
     where sync_records.device_id = 'server' and (sync_records.data is distinct from excluded.data or sync_records.deleted)`,
    [JSON.stringify(rows.map(({ id, ...data }) => ({ id, data })))],
  );
  const nights = [...new Set(rows.map(r => r.night))];
  const manual = (await db.query(
    `select id, data->>'start' as start, data->>'end' as "end" from sync_records where entity = 'sleep' and not deleted and data->>'source' = 'manual' and data->>'night' = any($1::text[])`,
    [nights],
  )) as { id: string; start: string; end: string | null }[];
  const gone = supersededManual(manual.map(r => ({ id: r.id, start: r.start, end: r.end ?? undefined })), rows);
  if (gone.length) {
    await db.query(`update sync_records set deleted = true, updated_at = now(), seq = nextval('sync_seq'), device_id = 'server' where entity = 'sleep' and id = any($1::text[])`, [gone]);
  }
  return Response.json({ ok: true, imported: rows.length, replaced: gone.length });
}
