import type { DayBlock, PublishTarget } from '../types';

export type PublishWork = 'create' | 'update' | 'delete' | null;

const LOCK_MS = 60_000;

/** What the agent must do for one target of one block (pure, tested). */
export function needsWork(b: DayBlock, t: PublishTarget, device: string, now = Date.now()): PublishWork {
  if (t.lock && t.lock.device !== device && now - Date.parse(t.lock.at) < LOCK_MS) return null;
  if (t.state === 'removed') return null;
  if (t.state === 'remove' || (b.deleted && t.state !== 'error')) return t.eventId ? 'delete' : null;
  if (b.deleted) return null;
  if (t.state === 'error') return null; // waits for Retry
  if (!t.eventId || t.state === 'pending') return t.eventId ? 'update' : 'create';
  const s = t.synced;
  if (!s || s.start !== b.start || s.end !== b.end || s.title !== b.title || s.availability !== t.availability) return 'update';
  return null;
}

/** A block deleted “only in DailyFlow” keeps its external events: targets are marked removed without a call. */
export function detach(targets: PublishTarget[]): PublishTarget[] {
  return targets.map(t => ({ ...t, state: 'removed' as const }));
}
