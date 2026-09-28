import type { TimelineBlock } from './types';

export interface NowNext<T extends TimelineBlock> {
  now: T | null;
  next: T | null;
  /** Minutes left in the current block. */
  remaining: number;
  /** 0–1 progress through the current block. */
  progress: number;
  /** Minutes until the next block starts. */
  untilNext: number;
}

/**
 * The block happening now (latest start among the ones covering `at`) and the next block
 * to start after it.
 */
export function nowNext<T extends TimelineBlock>(blocks: T[], at: number): NowNext<T> {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end);
  const covering = sorted.filter(b => b.start <= at && at < b.end);
  const now = covering.length ? covering[covering.length - 1] : null;
  const next = sorted.find(b => b.start > at && (!now || b.id !== now.id)) ?? null;
  return {
    now,
    next,
    remaining: now ? now.end - at : 0,
    progress: now ? (at - now.start) / (now.end - now.start) : 0,
    untilNext: next ? next.start - at : 0,
  };
}

export interface Placed<T> { block: T; lane: number; lanes: number }

/**
 * Side-by-side layout for overlapping blocks: each cluster of overlapping blocks is split
 * into lanes, first-fit by start time.
 */
export function layoutLanes<T extends TimelineBlock>(blocks: T[]): Placed<T>[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    cluster.forEach(p => { p.lanes = lanes; });
    out.push(...cluster);
    cluster = []; laneEnds = [];
  };
  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex(end => end <= b.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(b.end); } else laneEnds[lane] = b.end;
    cluster.push({ block: b, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd === -Infinity ? b.end : clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}

/** Visible hour range: at least the default, grown to fit every block. */
export function visibleRange(blocks: TimelineBlock[], defStart: number, defEnd: number): [number, number] {
  let lo = defStart, hi = defEnd;
  for (const b of blocks) { lo = Math.min(lo, b.start); hi = Math.max(hi, b.end); }
  return [Math.floor(lo / 60) * 60, Math.ceil(hi / 60) * 60];
}
