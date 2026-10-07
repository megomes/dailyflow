import { describe, expect, it } from 'vitest';
import { freeSlot, wakeImpact } from './wake';
import type { DayBlock } from './types';

const blk = (id: string, start: number, end: number) => ({ id, dayId: 'd', start, end, title: id, areaId: 'a', updatedAt: '' }) as DayBlock;
const plan = [blk('gym', 360, 420), blk('read', 420, 510), blk('work', 540, 720), blk('lunch', 720, 780)];

describe('waking later than the plan', () => {
  it('reports the lost time and the blocks before waking, without moving anything', () => {
    const r = wakeImpact(plan, 480);
    expect(r.lost).toBe(120);
    expect(r.hits.map(h => [h.block.id, h.cut])).toEqual([['gym', false], ['read', true]]);
  });
  it('nothing is lost when waking before the plan starts', () => {
    expect(wakeImpact(plan, 300)).toMatchObject({ lost: 0, hits: [] });
  });
  it('moves a block to the first gap that fits after waking', () => {
    expect(freeSlot(plan, 480, 30, 'gym')).toBe(510);
    expect(freeSlot(plan, 480, 60, 'gym')).toBe(780);
  });
});
