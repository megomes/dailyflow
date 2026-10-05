import { z } from 'zod';
import { syncAll } from '@/lib/calendar/server';
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
 * “Sync now” (and the web app every 15 min): every connected account's events for [from, to]
 * become day blocks; devices receive them through /api/sync. Returns per-account stats.
 */
export async function POST(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  try { Intl.DateTimeFormat('en-US', { timeZone: parsed.data.tz }); } catch { return Response.json({ error: 'tz' }, { status: 400 }); }
  try {
    return Response.json({ results: await syncAll(parsed.data) });
  } catch {
    return Response.json({ results: [], tableMissing: true });
  }
}
