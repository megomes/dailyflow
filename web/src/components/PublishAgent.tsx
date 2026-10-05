'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { deviceId, track } from '@/lib/analytics';
import { needsWork } from '@/lib/calendar/publish';
import { getDB } from '@/lib/db';
import { update } from '@/lib/repo';
import { useSyncState } from '@/lib/hooks';
import { dateAtMinute } from '@/lib/time';
import type { DayBlock, PublishTarget } from '@/lib/types';

/**
 * E10 publish agent: keeps the external copies of published blocks in step with the plan.
 * Runs 2 s after the last change, one call at a time, only online. Errors stay visible on the
 * block until Retry (CAP-J5, F-07).
 */
export function PublishAgent() {
  const blocks = useLiveQuery(async () => (await getDB().dayBlocks.toArray()).filter(b => b.published?.length), []);
  const sync = useSyncState();
  const busy = useRef(false);

  useEffect(() => {
    if (!blocks?.length || sync.status === 'offline') return;
    const me = deviceId();
    const work = blocks.flatMap(b => (b.published ?? []).map((t, i) => ({ b, t, i, w: needsWork(b, t, me) }))).filter(x => x.w);
    if (!work.length) return;
    const timer = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      try { for (const x of work) await run(x.b, x.i, x.w!, me); } finally { busy.current = false; }
    }, 2000);
    return () => clearTimeout(timer);
  }, [blocks, sync.status]);
  return null;
}

async function patchTarget(blockId: string, i: number, patch: Partial<PublishTarget> | ((t: PublishTarget) => PublishTarget)) {
  const cur = await getDB().dayBlocks.get(blockId);
  if (!cur?.published?.[i]) return;
  const list = [...cur.published];
  list[i] = typeof patch === 'function' ? patch(list[i]) : { ...list[i], ...patch };
  // Tombstones keep their data; update() would still write, which is what we want for the agent.
  await update<DayBlock>('day_block', blockId, { published: list });
}

async function run(b: DayBlock, i: number, w: 'create' | 'update' | 'delete', me: string) {
  const t = b.published![i];
  await patchTarget(b.id, i, { lock: { device: me, at: new Date().toISOString() } });
  try {
    const res = await fetch('/api/calendars/publish', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        op: w === 'delete' ? 'delete' : 'upsert', accountId: t.accountId, calendarId: t.calendarId, blockId: b.id, eventId: t.eventId,
        title: b.title, availability: t.availability,
        start: dateAtMinute(b.dayId, b.start).toISOString(), end: dateAtMinute(b.dayId, b.end).toISOString(),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { eventId?: string; error?: string };
    if (!res.ok) throw new Error(body.error ?? `publish ${res.status}`);
    if (w === 'delete') {
      await patchTarget(b.id, i, x => ({ ...x, state: 'removed', lock: undefined, error: undefined }));
      track('published_block_deleted', { scope: 'calendar', provider: t.provider });
    } else {
      await patchTarget(b.id, i, x => ({
        ...x, eventId: body.eventId ?? x.eventId, state: 'ok', error: undefined, lock: undefined,
        synced: { start: b.start, end: b.end, title: b.title, availability: x.availability },
      }));
      track(w === 'create' ? 'block_published' : 'published_block_moved', { target: t.provider, availability: t.availability });
    }
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 200);
    await patchTarget(b.id, i, x => ({ ...x, state: 'error', error: msg, lock: undefined }));
    track('publish_failed', { provider: t.provider, error: msg, op: w });
  }
}
