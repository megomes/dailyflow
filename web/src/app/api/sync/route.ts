import { z } from 'zod';
import { requireDevice, sql, unauthorized } from '@/lib/server';

const Op = z.object({
  entity: z.enum(['area', 'template_block', 'day', 'day_block', 'checkin', 'time_record', 'task', 'revision', 'focus_session', 'pref']),
  id: z.string().min(1).max(200),
  updatedAt: z.string().datetime(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown()),
});
const Body = z.object({ ops: z.array(Op).max(2000), since: z.number().int().min(0) });

/**
 * Push: upsert every op whose updatedAt is newer than the stored one (last writer wins).
 * Pull: return every record with seq > since. The cursor is the highest seq returned.
 */
export async function POST(req: Request) {
  const deviceId = await requireDevice();
  if (!deviceId) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { ops, since } = parsed.data;
  const db = sql();

  if (ops.length) {
    await db.query(
      `insert into sync_records (entity, id, data, deleted, updated_at, device_id)
       select x.entity, x.id, x.data, x.deleted, x.updated_at, $2
       from jsonb_to_recordset($1::jsonb) as x(entity text, id text, data jsonb, deleted boolean, updated_at timestamptz)
       on conflict (entity, id) do update
         set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at,
             device_id = excluded.device_id, seq = nextval('sync_seq')
         where sync_records.updated_at < excluded.updated_at`,
      [JSON.stringify(ops.map(o => ({ entity: o.entity, id: o.id, data: o.data, deleted: o.deleted, updated_at: o.updatedAt }))), deviceId],
    );
  }

  const rows = (await db.query(
    `select entity, id, data, deleted, updated_at, seq from sync_records where seq > $1 order by seq asc limit 5000`,
    [since],
  )) as { entity: string; id: string; data: Record<string, unknown>; deleted: boolean; updated_at: string | Date; seq: string | number }[];

  const changes = rows.map(r => ({
    entity: r.entity, id: r.id, data: r.data, deleted: r.deleted,
    updatedAt: new Date(r.updated_at).toISOString(), seq: Number(r.seq),
  }));
  const cursor = changes.length ? changes[changes.length - 1].seq : since;
  await db.query(`update devices set last_seen_at = now() where id = $1`, [deviceId]);
  return Response.json({ changes, cursor });
}
