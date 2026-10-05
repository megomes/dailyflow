import { codeHash, newCode, pairUrl } from '@/lib/pairing';
import { requireDevice, sql, unauthorized } from '@/lib/server';

/** A signed-in web session creates a one-time code (10 min) to pair a phone or watch. */
export async function POST(req: Request) {
  const deviceId = await requireDevice();
  if (!deviceId) return unauthorized();
  const code = newCode();
  const expires = new Date(Date.now() + 10 * 60_000);
  await sql().query(`delete from pair_codes where expires_at < now()`);
  await sql().query(`insert into pair_codes (code_hash, created_by, expires_at) values ($1, $2, $3)`, [await codeHash(code), deviceId, expires.toISOString()]);
  const host = new URL(req.url).origin;
  return Response.json({ code, expiresAt: expires.toISOString(), url: pairUrl(host, code) });
}
