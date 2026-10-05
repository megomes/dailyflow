import type { Snapshot } from '@shared/snapshot';

/**
 * When the widgets should redraw next (note #25): at the next moment the day changes (the block
 * ends, the next starts, focus ends), never later than a few minutes while something is on, and
 * every half hour when the day is quiet. Pure, so it is easy to reason about.
 */
export function nextRefreshAt(snap: Snapshot | null, nowMs: number): number {
  if (!snap) return nowMs + 15 * 60_000;
  const live = !!snap.running || !!snap.focus;
  const events: number[] = [];
  if (snap.now) events.push(snap.now.remainingMin);
  if (snap.next) events.push(snap.next.inMin);
  if (snap.focus?.leftSec && !snap.focus.paused) events.push(snap.focus.leftSec / 60);
  const cap = live ? 5 : snap.now || (snap.next && snap.next.inMin < 180) ? 10 : 30;
  const soonest = events.filter(m => m > 0).reduce((a, b) => Math.min(a, b), Infinity);
  // A few seconds after the boundary, so the server already sees the new block.
  const wait = Math.max(1, Math.min(cap, soonest + 0.25));
  return nowMs + Math.round(wait * 60_000);
}
