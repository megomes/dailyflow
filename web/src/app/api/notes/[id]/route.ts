import { z } from 'zod';
import { requireDevice, sql, unauthorized } from '@/lib/server';

const Patch = z.union([
  z.object({ action: z.literal('reopen') }),
  z.object({ body: z.string().trim().min(1).max(5000), kind: z.enum(['bug', 'idea', 'ux', 'question']) }),
]);

const noteId = async (ctx: RouteContext<'/api/notes/[id]'>) => {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Edit text/kind (only while the note is open, previous values are logged) or reopen a
 * done/ignored note. Returns 409 when the note is not in a state that allows the change.
 */
export async function PATCH(req: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  if (!(await requireDevice())) return unauthorized();
  const id = await noteId(ctx);
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!id || !parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const p = parsed.data;

  const rows: unknown[] = 'action' in p
    ? await sql().query(
      `with old as (select id, status from notes where id = $1 and not deleted and status in ('done', 'ignored')),
            upd as (update notes n set status = 'open', updated_at = now() from old where n.id = old.id returning n.id, old.status as prev)
       insert into note_log (note_id, actor, action, detail)
       select id, 'user', 'reopened', jsonb_build_object('from', prev) from upd returning note_id`,
      [id],
    ) as unknown[]
    : await sql().query(
      `with old as (select id, body, kind from notes where id = $1 and not deleted and status = 'open'),
            upd as (update notes n set body = $2, kind = $3, updated_at = now() from old where n.id = old.id
                    returning n.id, old.body as old_body, old.kind as old_kind, n.body, n.kind)
       insert into note_log (note_id, actor, action, detail)
       select id, 'user', 'edited', jsonb_build_object('from', old_body, 'to', body, 'kind_from', old_kind, 'kind_to', kind) from upd
       returning note_id`,
      [id, p.body, p.kind],
    ) as unknown[];
  if (!rows.length) return Response.json({ error: 'locked' }, { status: 409 });
  return Response.json({ ok: true });
}

/** Soft-deletes an open note (the id is never reused). */
export async function DELETE(_req: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  if (!(await requireDevice())) return unauthorized();
  const id = await noteId(ctx);
  if (!id) return Response.json({ error: 'invalid' }, { status: 400 });
  const rows = (await sql().query(
    `with upd as (update notes set deleted = true, updated_at = now() where id = $1 and not deleted and status = 'open' returning id, body)
     insert into note_log (note_id, actor, action, detail)
     select id, 'user', 'deleted', jsonb_build_object('body', body) from upd returning note_id`,
    [id],
  )) as unknown[];
  if (!rows.length) return Response.json({ error: 'locked' }, { status: 409 });
  return Response.json({ ok: true });
}
