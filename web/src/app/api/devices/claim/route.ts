import { z } from 'zod';
import { codeHash, normalizeCode } from '@/lib/pairing';
import { sql } from '@/lib/server';
import { signSession } from '@/lib/session';

const Body = z.object({ code: z.string().min(6).max(20), label: z.string().max(120).optional(), kind: z.enum(['android', 'wear']).default('android') });
const tries = new Map<string, { n: number; at: number }>();

/** A native device trades a pairing code for a long-lived device token (sent as Bearer). No login screen. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const t = tries.get(ip);
  if (t && t.n >= 10 && Date.now() - t.at < 10 * 60_000) return Response.json({ error: 'too_many' }, { status: 429 });
  const secret = process.env.SESSION_SECRET;
  if (!secret) return Response.json({ error: 'not_configured' }, { status: 500 });
  const rows = (await sql().query(
    `delete from pair_codes where code_hash = $1 and expires_at > now() returning created_by`,
    [await codeHash(normalizeCode(parsed.data.code))],
  )) as { created_by: string }[];
  if (!rows.length) {
    tries.set(ip, { n: (t?.n ?? 0) + 1, at: Date.now() });
    return Response.json({ error: 'invalid_code' }, { status: 401 });
  }
  const deviceId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const token = await signSession(deviceId, secret);
  await sql().query(`insert into devices (id, label, user_agent, kind, last_seen_at) values ($1, $2, $3, $4, now())`, [
    deviceId, parsed.data.label ?? parsed.data.kind, req.headers.get('user-agent')?.slice(0, 300) ?? null, parsed.data.kind,
  ]).catch(() => {});
  return Response.json({ token, deviceId });
}
