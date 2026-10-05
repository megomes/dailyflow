import { accounts, providerConfigured, removeAccount } from '@/lib/calendar/server';
import { requireDevice, unauthorized } from '@/lib/server';

/** Connected accounts and their sync status (tokens never leave the server). */
export async function GET() {
  if (!(await requireDevice())) return unauthorized();
  let list: Awaited<ReturnType<typeof accounts>> = [];
  let tableMissing = false;
  try { list = await accounts(); } catch (e) { tableMissing = /calendar_accounts/.test(String(e)); if (!tableMissing) throw e; }
  return Response.json({
    configured: { google: providerConfigured('google'), microsoft: providerConfigured('microsoft'), ics: providerConfigured('ics') },
    tableMissing,
    accounts: list.map(a => {
      const r = a as typeof a & { last_error: string | null; last_sync_at: string | null };
      return { id: a.id, provider: a.provider, email: a.email, status: a.status, lastError: r.last_error, lastSyncAt: r.last_sync_at };
    }),
  });
}

export async function DELETE(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id' }, { status: 400 });
  await removeAccount(id);
  return Response.json({ ok: true });
}
