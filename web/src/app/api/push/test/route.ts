import { z } from 'zod';
import { previewOnWatch } from '@/lib/push';
import { requireDevice, unauthorized } from '@/lib/server';

const Body = z.object({ kind: z.enum(['move', 'block']) });

/** POST /api/push/test {kind:'move'|'block'} — Settings › Device “preview on the watch” (note #19). */
export async function POST(req: Request) {
  if (!(await requireDevice())) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  return Response.json({ ok: true, reached: await previewOnWatch(parsed.data.kind) });
}
