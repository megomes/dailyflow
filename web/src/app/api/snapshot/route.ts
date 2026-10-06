import { after } from 'next/server';
import { maybeSyncCalendars } from '@/lib/calendar/server';
import { DAY_CUTOFF_HOUR } from '@/lib/config';
import { requireDevice, sql, unauthorized } from '@/lib/server';
import { buildSnapshot } from '@/lib/snapshot';
import type { Area, DayBlock, FocusSession, Task, TimeRecord, Sleep } from '@/lib/types';
import { logicalAt } from '@/lib/zone';

/**
 * GET /api/snapshot?tz=America/Sao_Paulo — the present moment for widgets, the lock-screen
 * notification and Wear OS (EH). Read-only, small, cache-free. Bearer or cookie auth.
 */
export async function GET(req: Request) {
  // Calendars stay fresh as long as any device talks to us (no cron on the Hobby plan).
  after(() => maybeSyncCalendars());
  if (!(await requireDevice())) return unauthorized();
  const url = new URL(req.url);
  const tz = url.searchParams.get('tz') || 'America/Sao_Paulo';
  try { Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return Response.json({ error: 'tz' }, { status: 400 }); }
  const db = sql();
  type Row = { entity: string; id: string; data: Record<string, unknown> };
  const prefs = (await db.query(`select data from sync_records where entity = 'pref' and id = 'prefs' and not deleted`)) as { data: { dayCutoffHour?: number } }[];
  const cutoff = prefs[0]?.data.dayCutoffHour ?? DAY_CUTOFF_HOUR;
  const now = new Date();
  const { day } = logicalAt(now, tz, cutoff);
  const rows = (await db.query(
    `select entity, id, data from sync_records where not deleted and (
       (entity = 'day_block' and data->>'dayId' = $1)
       or entity = 'area'
       or (entity = 'sleep' and data->>'end' is null)
       or (entity = 'time_record' and (data->>'dayId' = $1 or data->'end' = 'null'::jsonb))
       or (entity = 'task' and (data->>'status' not in ('done', 'archived') or data->>'dayId' = $1))
       or (entity = 'focus_session' and (data->>'state' in ('running', 'paused') or data->>'taskId' is not null))
     )`,
    [day],
  )) as Row[];
  const pick = <T,>(e: string) => rows.filter(r => r.entity === e).map(r => ({ ...r.data, id: r.id }) as unknown as T);
  // Areas never edited exist only as client seeds: fill names/colors from the seed list.
  const { SEED_AREAS } = await import('@/lib/seed');
  const areas = new Map(SEED_AREAS.map(a => [a.id, a]));
  for (const a of pick<Area>('area')) areas.set(a.id, a);
  const snap = buildSnapshot({ blocks: pick<DayBlock>('day_block'), records: pick<TimeRecord>('time_record'), tasks: pick<Task>('task'), sessions: pick<FocusSession>('focus_session'), sleeps: pick<Sleep>('sleep'), areas: [...areas.values()] }, now, tz, cutoff);
  return Response.json(snap, { headers: { 'cache-control': 'no-store' } });
}
