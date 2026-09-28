import 'server-only';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
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
  return verifySession(store.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
}

export const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401 });
