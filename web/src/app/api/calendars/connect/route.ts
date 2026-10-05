import { NextResponse } from 'next/server';
import { authUrl, providerConfigured } from '@/lib/calendar/server';
import { requireDevice, unauthorized } from '@/lib/server';
import { signSession } from '@/lib/session';

/** Starts OAuth: /api/calendars/connect?provider=google|microsoft → provider consent screen. */
export async function GET(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const provider = new URL(req.url).searchParams.get('provider');
  if (provider !== 'google' && provider !== 'microsoft') return Response.json({ error: 'provider' }, { status: 400 });
  if (!providerConfigured(provider)) return NextResponse.redirect(new URL(`/settings/calendars?error=not_configured_${provider}`, req.url));
  // State = signed token whose id carries the provider and a nonce (verified in the callback).
  const state = await signSession(`cal-${provider}-${crypto.randomUUID().slice(0, 8)}`, process.env.SESSION_SECRET!);
  return NextResponse.redirect(authUrl(provider, state));
}
