import { z } from 'zod';
import { STAGE } from '@/lib/config';
import { requireDevice, sql, unauthorized } from '@/lib/server';

const KINDS = ['bug', 'idea', 'ux', 'question'] as const;

/** Every note with its full history, newest first. */
export async function GET() {
  if (!(await requireDevice())) return unauthorized();
  const rows = await sql().query(
    `select n.id, n.body, n.kind, n.status, n.stage, n.app_version as "appVersion", n.screen, n.resolution,
            n.created_at as "createdAt", n.updated_at as "updatedAt",
            coalesce((select json_agg(json_build_object('ts', l.ts, 'actor', l.actor, 'action', l.action, 'message', l.message, 'detail', l.detail) order by l.ts)
                      from note_log l where l.note_id = n.id), '[]'::json) as log
       from notes n where not n.deleted order by n.id desc`,
  );
  return Response.json({ notes: rows });
}

const Body = z.object({
  body: z.string().trim().min(1).max(5000),
  kind: z.enum(KINDS).default('idea'),
  screen: z.string().max(64).optional(),
  clientId: z.string().max(64).optional(),
});

/** Creates a note and logs it. */
export async function POST(req: Request) {
  const deviceId = await requireDevice();
  if (!deviceId) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { body, kind, screen, clientId } = parsed.data;
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local';
  const [note] = (await sql().query(
    `with n as (
       insert into notes (body, kind, stage, app_version, screen, device_id)
       values ($1, $2, $3, $4, $5, $6) returning id, body, kind, status
     ), l as (
       insert into note_log (note_id, actor, action, detail)
       select id, 'user', 'created', jsonb_build_object('kind', kind, 'client_id', $7::text) from n
     )
     select id from n`,
    [body, kind, STAGE, version, screen ?? null, deviceId, clientId ?? null],
  )) as { id: number }[];
  return Response.json({ id: note.id });
}
