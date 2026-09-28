import { cookies } from 'next/headers';
import { z } from 'zod';
import { DEVICE_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_S } from '@/lib/config';
import { verifyCode } from '@/lib/password';
import { sql } from '@/lib/server';
import { signSession } from '@/lib/session';

const Body = z.object({ code: z.string().min(1).max(200), label: z.string().max(120).optional() });

/** Small in-memory backoff against guessing. Serverless instances reset it; the delay still slows scripts. */
const failures = new Map<string, { n: number; at: number }>();

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const f = failures.get(ip);
  if (f && f.n >= 5 && Date.now() - f.at < 60_000) return Response.json({ error: 'too_many' }, { status: 429 });

  const secret = process.env.SESSION_SECRET;
  if (!secret || !process.env.ACCESS_CODE_HASH) return Response.json({ error: 'not_configured' }, { status: 500 });

  if (!verifyCode(parsed.data.code, process.env.ACCESS_CODE_HASH)) {
    failures.set(ip, { n: (f?.n ?? 0) + 1, at: Date.now() });
    await new Promise(r => setTimeout(r, 700));
    return Response.json({ error: 'wrong_code' }, { status: 401 });
  }
  failures.delete(ip);

  const deviceId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const token = await signSession(deviceId, secret);
  const secure = process.env.NODE_ENV === 'production';
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: SESSION_MAX_AGE_S });
  store.set(DEVICE_COOKIE, deviceId, { httpOnly: false, sameSite: 'lax', secure, path: '/', maxAge: SESSION_MAX_AGE_S });

  try {
    await sql().query(`insert into devices (id, label, user_agent, last_seen_at) values ($1, $2, $3, now())`, [
      deviceId, parsed.data.label ?? null, req.headers.get('user-agent')?.slice(0, 300) ?? null,
    ]);
  } catch { /* device registry is informative only */ }

  return Response.json({ ok: true, deviceId });
}
