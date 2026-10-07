import type { DayBlock } from './types';

export type WakeHit = { block: DayBlock; cut: boolean };

/**
 * Waking later than the plan starts: the plan stays where it is; the time before
 * waking is lost and the blocks in it are listed so each one can be moved or removed.
 * `cut` = the block straddles the wake time (it can just start later).
 */
export function wakeImpact(blocks: DayBlock[], wake: number) {
  const live = blocks.filter(b => !b.deleted);
  const first = live.length ? Math.min(...live.map(b => b.start)) : wake;
  const hits: WakeHit[] = live.filter(b => b.start < wake).sort((a, b) => a.start - b.start).map(b => ({ block: b, cut: b.end > wake }));
  return { lost: Math.max(0, wake - first), from: first, hits };
}

/** First free slot of `len` minutes at or after `from`, ignoring `skipId` (the block being moved). */
export function freeSlot(blocks: DayBlock[], from: number, len: number, skipId?: string) {
  const busy = blocks.filter(b => !b.deleted && b.id !== skipId && b.end > from).sort((a, b) => a.start - b.start);
  let t = from;
  for (const b of busy) {
    if (b.start - t >= len) break;
    t = Math.max(t, b.end);
  }
  return t + len <= 1440 ? t : from;
}
