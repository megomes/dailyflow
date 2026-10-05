'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Check, Loader, Shield } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { update } from '@/lib/repo';
import type { DayBlock, PublishTarget } from '@/lib/types';

/** Protect time (E10): publish the block to writable calendars as Busy or Free. */
export function PublishControls({ block }: { block: DayBlock }) {
  const cals = (useLiveQuery(() => getDB().calendars.toArray(), []) ?? []).filter(c => !c.deleted && c.canWrite);
  if (!cals.length) return null;
  const targets = block.published ?? [];
  const active = (key: string) => targets.find(t => t.calendarKey === key && t.state !== 'removed' && t.state !== 'remove');
  const availability = targets.find(t => t.state !== 'removed')?.availability ?? 'busy';

  async function save(list: PublishTarget[]) { await update<DayBlock>('day_block', block.id, { published: list }); }

  async function toggle(key: string) {
    const c = cals.find(x => x.id === key)!;
    const cur = active(key);
    if (cur) {
      await save(targets.map(t => (t === cur ? { ...t, state: t.eventId ? 'remove' : 'removed' } : t)));
      track('block_unpublished', { target: c.provider });
      return;
    }
    const old = targets.find(t => t.calendarKey === key);
    const next: PublishTarget = { ...(old ?? {}), calendarKey: key, provider: c.provider, accountId: c.accountId, calendarId: c.calendarId, availability, state: 'pending', error: undefined, lock: undefined };
    await save(old ? targets.map(t => (t === old ? next : t)) : [...targets, next]);
  }

  async function setAvailability(a: 'busy' | 'free') {
    await save(targets.map(t => (t.state === 'removed' ? t : { ...t, availability: a })));
  }

  async function retry() {
    await save(targets.map(t => (t.state === 'error' ? { ...t, state: 'pending', error: undefined } : t)));
    track('publish_retried', {});
  }

  const shown = targets.filter(t => t.state !== 'removed');
  const err = shown.find(t => t.state === 'error');
  return (
    <div className="field publish">
      <span className="row"><Shield size={12} />{m.protect.title}</span>
      <div className="row wrap">
        {cals.map(c => (
          <button key={c.id} type="button" className="chip" aria-pressed={!!active(c.id)} onClick={() => void toggle(c.id)}>
            {c.provider === 'google' ? 'Google' : 'Microsoft'} · {c.name}
          </button>
        ))}
      </div>
      {shown.length > 0 && (
        <div className="row wrap">
          <div className="seg">{(['busy', 'free'] as const).map(a => <button key={a} type="button" aria-pressed={availability === a} onClick={() => void setAvailability(a)}>{m.protect.availability[a]}</button>)}</div>
          {err ? (
            <span className="row error"><AlertTriangle size={13} />{m.protect.failed(err.error ?? '')}<button type="button" className="btn sm" onClick={() => void retry()}>{m.protect.retry}</button></span>
          ) : shown.every(t => t.state === 'ok') ? (
            <span className="row ok-line"><Check size={13} />{m.protect.published}</span>
          ) : (
            <span className="row hint"><Loader size={13} />{m.protect.publishing}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Is any external copy live (needs the “delete where?” question)? */
export const hasLiveCopies = (b: DayBlock) => !!b.published?.some(t => t.eventId && (t.state === 'ok' || t.state === 'pending' || t.state === 'error'));
