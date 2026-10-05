import 'server-only';
import { neon } from '@neondatabase/serverless';
import { cookies, headers } from 'next/headers';
import { SESSION_COOKIE } from './config';
import { verifySession } from './session';

let client: ReturnType<typeof neon> | null = null;
export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    client = neon(url);
  }
  return client;
}

/** Device id of the authenticated request, or null. Route handlers re-check (the proxy is only a first gate). */
export async function requireDevice(): Promise<string | null> {
  const store = await cookies();
  const fromCookie = await verifySession(store.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
  if (fromCookie) return fromCookie;
  // Paired native devices (Android app, widgets, Wear OS) send the same token as a Bearer header.
  const auth = (await headers()).get('authorization');
  return auth?.startsWith('Bearer ') ? verifySession(auth.slice(7).trim(), process.env.SESSION_SECRET) : null;
}

export const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401 });

/** What only the server knows about the request (Vercel geolocation headers, UA, build). */
export function serverContext(req: Request) {
  const h = req.headers;
  const dec = (v: string | null) => (v ? decodeURIComponent(v) : undefined);
  return {
    userAgent: h.get('user-agent') ?? undefined,
    country: h.get('x-vercel-ip-country') ?? undefined,
    region: dec(h.get('x-vercel-ip-country-region')),
    city: dec(h.get('x-vercel-ip-city')),
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    env: process.env.VERCEL_ENV ?? 'development',
    receivedAt: new Date().toISOString(),
  };
}
