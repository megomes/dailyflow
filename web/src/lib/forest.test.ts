import { describe, expect, it } from 'vitest';
import { collection, forestStats, grow, maturity, season, speciesFor } from './forest';
import { addDays } from './time';
import type { Area, TimeRecord } from './types';

const areas = [{ id: 'work', sort: 0 }, { id: 'music', sort: 1 }, { id: 'family', sort: 2 }] as Area[];
const rec = (dayId: string, areaId: string, min: number): TimeRecord => ({ id: dayId + areaId, dayId, start: 600, end: 600 + min, areaId, title: '', source: 'live', createdAt: '', updatedAt: '' });

describe('forest', () => {
  it('gives each area a stable species', () => {
    expect(speciesFor(areas[1], areas)).toBe('pine');
    expect(speciesFor(areas[1], [...areas, { id: 'zzz', sort: 9 } as Area])).toBe('pine');
  });
  it('grows one tree per 45 min, at least one from 15 min, capped', () => {
    const p = grow([rec('2026-10-05', 'work', 300), rec('2026-10-05', 'music', 20), rec('2026-10-05', 'family', 10)], areas).get('2026-10-05')!;
    expect(p.trees.filter(t => t.areaId === 'work')).toHaveLength(6);
    const busy = grow([rec('2026-10-06', 'work', 600), rec('2026-10-06', 'music', 600), rec('2026-10-06', 'family', 60)], areas).get('2026-10-06')!;
    expect(busy.trees).toHaveLength(8);
    expect(busy.trees.filter(t => t.areaId === 'family')).toHaveLength(1);
    expect(p.trees.filter(t => t.areaId === 'music')).toHaveLength(1);
    expect(p.trees.filter(t => t.areaId === 'family')).toHaveLength(0);
  });
  it('matures with consistency and never shrinks past trees', () => {
    const recs = Array.from({ length: 20 }, (_, i) => rec(addDays('2026-09-16', i), 'music', 30));
    const plots = grow(recs, areas);
    expect(plots.get('2026-09-16')!.trees[0].size).toBe(0);
    expect(plots.get('2026-10-05')!.trees[0].size).toBe(3);
    expect(maturity(new Set(['2026-10-01', '2026-10-02', '2026-10-03']), '2026-10-05')).toBe(1);
    const c = collection(plots);
    expect(c[0]).toMatchObject({ species: 'pine', day: '2026-09-16', mature: '2026-09-30' });
    expect(forestStats(plots)).toMatchObject({ trees: 20, days: 20 });
  });
  it('knows southern seasons', () => {
    expect(season('2026-10-05')).toBe('spring');
    expect(season('2026-01-10')).toBe('summer');
    expect(season('2026-10-05', false)).toBe('autumn');
  });
});
