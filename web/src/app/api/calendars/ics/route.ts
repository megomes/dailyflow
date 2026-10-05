import { addIcsAccount, icsUrl, providerConfigured } from '@/lib/calendar/server';
import { requireDevice, unauthorized } from '@/lib/server';

/** Adds a calendar by its ICS link (e.g. Outlook › Publish a calendar). The link is stored sealed and never sent back. */
export async function POST(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  if (!providerConfigured('ics')) return Response.json({ error: 'not_configured' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { url?: string; label?: string };
  const url = icsUrl(body.url ?? '');
  if (!url) return Response.json({ error: 'invalid_url' }, { status: 400 });
  try {
    const a = await addIcsAccount(url, body.label ?? '');
    return Response.json({ id: a.id });
  } catch (e) {
    return Response.json({ error: String((e as Error).message).slice(0, 200) }, { status: 400 });
  }
}
