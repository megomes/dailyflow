import { cookies, headers } from 'next/headers';
import { DEVICE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_S } from '@/lib/config';
import { verifySession } from '@/lib/session';

/**
 * GET /api/devices/web?next=/tasks — the Android app opens the web app in its WebView with the
 * paired device token as Bearer; this turns it into the same session cookie a browser login gets.
 * One code base, so the app always has every feature the web has.
 */
export async function GET(req: Request) {
  const auth = (await headers()).get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const deviceId = await verifySession(token, process.env.SESSION_SECRET);
  if (!deviceId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const secure = process.env.NODE_ENV === 'production';
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: SESSION_MAX_AGE_S });
  store.set(DEVICE_COOKIE, deviceId, { httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: SESSION_MAX_AGE_S });
  const next = new URL(req.url).searchParams.get('next') ?? '/';
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return new Response(null, { status: 302, headers: { location: safe } });
}
