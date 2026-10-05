import { z } from 'zod';
import { accessToken, accounts, publishEvent, setAccountStatus, unpublishEvent } from '@/lib/calendar/server';
import { requireDevice, unauthorized } from '@/lib/server';

const Body = z.object({
  op: z.enum(['upsert', 'delete']),
  accountId: z.string().min(1),
  calendarId: z.string().min(1),
  blockId: z.string().min(1),
  eventId: z.string().optional(),
  title: z.string().max(500).default(''),
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  availability: z.enum(['busy', 'free']).default('busy'),
});

/** E10: create/update/delete the external copy of a block. The client publish agent calls this. */
export async function POST(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const b = parsed.data;
  const account = (await accounts()).find(a => a.id === b.accountId);
  if (!account) return Response.json({ error: 'account not connected' }, { status: 404 });
  try {
    const token = await accessToken(account);
    if (b.op === 'delete') {
      if (b.eventId) await unpublishEvent(account, token, b.calendarId, b.eventId);
      return Response.json({ ok: true });
    }
    if (!b.start || !b.end) return Response.json({ error: 'start/end' }, { status: 400 });
    const eventId = await publishEvent(account, token, { blockId: b.blockId, calendarId: b.calendarId, eventId: b.eventId, title: b.title, start: b.start, end: b.end, availability: b.availability });
    return Response.json({ ok: true, eventId });
  } catch (e) {
    const reauth = !!(e as { reauth?: boolean }).reauth;
    if (reauth) await setAccountStatus(account.id, 'reauth', 'reauth').catch(() => {});
    return Response.json({ error: reauth ? 'reauth' : String((e as Error).message).slice(0, 300) }, { status: 502 });
  }
}
