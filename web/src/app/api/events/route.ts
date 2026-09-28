import { z } from 'zod';
import { requireDevice, sql, unauthorized } from '@/lib/server';

const Event = z.object({
  id: z.string().uuid(),
  ts: z.string().datetime(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stage: z.string().max(10),
  sessionId: z.string().max(64),
  deviceId: z.string().max(64),
  device: z.string().max(16),
  screen: z.string().max(64),
  event: z.string().max(64),
  props: z.record(z.string(), z.unknown()),
});
const Body = z.object({ events: z.array(Event).max(500) });

/** Stores product events (append-only, idempotent by id). */
export async function POST(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { events } = parsed.data;
  if (events.length) {
    await sql().query(
      `insert into product_events (id, ts, day, stage, session_id, device_id, device, screen, event, props)
       select x.id, x.ts, x.day, x.stage, x.session_id, x.device_id, x.device, x.screen, x.event, x.props
       from jsonb_to_recordset($1::jsonb) as x(id uuid, ts timestamptz, day date, stage text, session_id text, device_id text, device text, screen text, event text, props jsonb)
       on conflict (id) do nothing`,
      [JSON.stringify(events.map(e => ({ id: e.id, ts: e.ts, day: e.day, stage: e.stage, session_id: e.sessionId, device_id: e.deviceId, device: e.device, screen: e.screen, event: e.event, props: e.props })))],
    );
  }
  return Response.json({ stored: events.length });
}

/** Lists events from every device, newest first. ?stage=E1&day=YYYY-MM-DD&limit=1000 */
export async function GET(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const url = new URL(req.url);
  const stage = url.searchParams.get('stage');
  const day = url.searchParams.get('day');
  const limit = Math.min(Number(url.searchParams.get('limit') || 2000), 20000);
  const rows = await sql().query(
    `select id, ts, day::text as day, stage, session_id as "sessionId", device_id as "deviceId", device, screen, event, props
     from product_events
     where ($1::text is null or stage = $1) and ($2::date is null or day = $2::date)
     order by ts desc limit $3`,
    [stage, day, limit],
  );
  return Response.json({ events: rows });
}
