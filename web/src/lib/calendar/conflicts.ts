import type { TimelineBlock } from '../types';

export interface ExternalConflict { eventId: string; title: string; start: number; end: number; block: TimelineBlock; minutes: number }

/** Commitments overlapping plan blocks (CAP-D2). Blocks created from the same event are not conflicts. */
export function externalConflicts(events: { id: string; title: string; start: number; end: number }[], blocks: (TimelineBlock & { fromEvent?: string })[]): ExternalConflict[] {
  const out: ExternalConflict[] = [];
  for (const e of events) {
    for (const b of blocks) {
      if (b.fromEvent === e.id) continue;
      const o = Math.min(e.end, b.end) - Math.max(e.start, b.start);
      if (o > 0) out.push({ eventId: e.id, title: e.title, start: e.start, end: e.end, block: b, minutes: o });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Splitting a block around an event: the parts before and after it (each at least 10 minutes). */
export function splitAround(b: { start: number; end: number }, e: { start: number; end: number }) {
  const parts: { start: number; end: number }[] = [];
  if (e.start - b.start >= 10) parts.push({ start: b.start, end: e.start });
  if (b.end - e.end >= 10) parts.push({ start: e.end, end: b.end });
  return parts;
}

export interface SeenEvent { title: string; start: number; end: number }

/** What changed in a day's commitments since the last snapshot (new, moved, cancelled). */
export function diffEvents(prev: Record<string, SeenEvent>, cur: Record<string, SeenEvent>) {
  const added: string[] = [], changed: string[] = [], removed: string[] = [];
  for (const id of Object.keys(cur)) {
    if (!prev[id]) added.push(id);
    else if (prev[id].start !== cur[id].start || prev[id].end !== cur[id].end) changed.push(id);
  }
  for (const id of Object.keys(prev)) if (!cur[id]) removed.push(id);
  return { added, changed, removed };
}
