import { z } from 'zod';
import { tokenId } from '@/lib/push';
import { requireDevice, sql, unauthorized } from '@/lib/server';

const Body = z.object({ token: z.string().min(20).max(4096), platform: z.enum(['android', 'wear']) });

/** POST /api/push/register {token, platform} — the Android app or the watch hands over its FCM token. */
export async function POST(req: Request) {
  const deviceId = await requireDevice();
  if (!deviceId) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { token, platform } = parsed.data;
  await sql().query(
    `insert into push_targets (id, device_id, platform, token) values ($1, $2, $3, $4)
     on conflict (id) do update set device_id = excluded.device_id, platform = excluded.platform, token = excluded.token`,
    [tokenId(token), deviceId, platform, token],
  );
  return Response.json({ ok: true });
}

/** DELETE /api/push/register?token=… — stop pushing to this token. */
export async function DELETE(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const token = new URL(req.url).searchParams.get('token');
  if (token) await sql().query(`delete from push_targets where id = $1`, [tokenId(token)]);
  return Response.json({ ok: true });
}
