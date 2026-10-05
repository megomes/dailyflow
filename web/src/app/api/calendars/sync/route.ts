import { z } from 'zod';
import { accessToken, accounts, enabledCalendarIds, listCalendars, listEvents, setAccountStatus, upsertCalendars, writeEvents } from '@/lib/calendar/server';
import { requireDevice, unauthorized } from '@/lib/server';

const Body = z.object({
  tz: z.string().min(1).max(64),
  cutoff: z.number().int().min(0).max(8),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  refreshCalendars: z.boolean().optional(),
});

export const maxDuration = 60;

/**
 * Pulls events for every connected account into sync_records for [from, to] (logical days).
 * Devices then receive them through /api/sync. Returns per-account stats for the status UI.
 */
export async function POST(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { tz, cutoff, from, to, refreshCalendars } = parsed.data;
  try { Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return Response.json({ error: 'tz' }, { status: 400 }); }
  // Window in absolute time, padded a day on each side; rows outside [from, to] are dropped after placing.
  const start = new Date(`${from}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);

  let list;
  try { list = await accounts(); } catch { return Response.json({ results: [], tableMissing: true }); }
  const results = [];
  for (const a of list) {
    const t0 = Date.now();
    try {
      const token = await accessToken(a);
      if (refreshCalendars) await upsertCalendars(a, await listCalendars(a, token));
      let events = 0, removed = 0;
      for (const c of await enabledCalendarIds(a.id)) {
        const raw = await listEvents(a, token, c.calendarId, start, end);
        const w = await writeEvents(a.id, a.provider, c.calendarId, raw, tz, cutoff, from, to);
        events += w.upserted; removed += w.removed;
      }
      await setAccountStatus(a.id, 'ok', null);
      results.push({ account: a.id, provider: a.provider, events, removed, ms: Date.now() - t0 });
    } catch (e) {
      const reauth = !!(e as { reauth?: boolean }).reauth;
      const message = String((e as Error).message).slice(0, 300);
      await setAccountStatus(a.id, reauth ? 'reauth' : 'error', message).catch(() => {});
      results.push({ account: a.id, provider: a.provider, error: reauth ? 'reauth' : message, ms: Date.now() - t0 });
    }
  }
  return Response.json({ results });
}
