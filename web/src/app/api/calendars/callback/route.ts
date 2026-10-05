import { NextResponse } from 'next/server';
import { accessToken, exchangeCode, listCalendars, upsertCalendars } from '@/lib/calendar/server';
import { requireDevice, unauthorized } from '@/lib/server';
import { verifySession } from '@/lib/session';

/** OAuth redirect target for both providers: stores tokens, lists calendars, back to Settings. */
export async function GET(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/settings/calendars?${q}`, req.url));
  if (url.searchParams.get('error')) return back(`error=${encodeURIComponent(url.searchParams.get('error')!)}`);
  const id = await verifySession(url.searchParams.get('state') ?? undefined, process.env.SESSION_SECRET);
  const m = id && /^cal-(google|microsoft)-/.exec(id);
  if (!m) return back('error=state');
  const provider = m[1] as 'google' | 'microsoft';
  const code = url.searchParams.get('code');
  if (!code) return back('error=code');
  try {
    const account = await exchangeCode(provider, code);
    const token = await accessToken(account);
    await upsertCalendars(account, await listCalendars(account, token));
    return back(`connected=${encodeURIComponent(account.id)}`);
  } catch (e) {
    return back(`error=${encodeURIComponent(String((e as Error).message).slice(0, 120))}`);
  }
}
