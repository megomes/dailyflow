import { describe, expect, it } from 'vitest';
import { diffEvents, externalConflicts, splitAround } from './conflicts';

describe('external conflicts', () => {
  const blocks = [{ id: 'w', start: 840, end: 1050, title: 'Work', areaId: 'work' }, { id: 'm', start: 660, end: 720, title: 'Music', areaId: 'music' }];
  it('finds commitments over blocks', () => {
    const c = externalConflicts([{ id: 'e1', title: 'Design review', start: 900, end: 960 }], blocks);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ eventId: 'e1', minutes: 60, block: { id: 'w' } });
    expect(externalConflicts([{ id: 'e1', title: 'x', start: 900, end: 960 }], [{ ...blocks[0], fromEvent: 'e1' }])).toHaveLength(0);
  });
  it('splits a block around an event', () => {
    expect(splitAround({ start: 840, end: 1050 }, { start: 900, end: 960 })).toEqual([{ start: 840, end: 900 }, { start: 960, end: 1050 }]);
    expect(splitAround({ start: 840, end: 900 }, { start: 835, end: 895 })).toEqual([]);
  });
  it('diffs event snapshots', () => {
    const d = diffEvents({ a: { title: 'A', start: 1, end: 2 }, b: { title: 'B', start: 3, end: 4 } }, { a: { title: 'A', start: 1, end: 3 }, c: { title: 'C', start: 5, end: 6 } });
    expect(d).toEqual({ added: ['c'], changed: ['a'], removed: ['b'] });
  });
});
