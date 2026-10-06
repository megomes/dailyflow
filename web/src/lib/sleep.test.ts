import { describe, expect, it } from 'vitest';
import { clockOf, nightOf, sleepBands, sleepStats, targetMinutes, targetSpan } from './sleep';
import type { Sleep } from './types';

const at = (s: string) => new Date(s); // local time
const sleep = (id: string, start: string, end?: string, extra: Partial<Sleep> = {}): Sleep => ({
  id, night: nightOf(at(start)), start: at(start).toISOString(), ...(end ? { end: at(end).toISOString() } : {}), source: 'manual', updatedAt: '', ...extra,
});

describe('sleep', () => {
  it('belongs to the night of the bedtime, even after midnight', () => {
    expect(nightOf(at('2026-10-05T23:40:00'))).toBe('2026-10-05');
    expect(nightOf(at('2026-10-06T03:10:00'))).toBe('2026-10-05');
    expect(nightOf(at('2026-10-06T05:30:00'))).toBe('2026-10-05');
  });

  it('target length and span wrap past midnight', () => {
    expect(targetMinutes({ bed: 22 * 60, wake: 6 * 60 })).toBe(480);
    expect(targetSpan({ bed: 60, wake: 9 * 60 })).toEqual({ bed: 1500, wake: 1980 });
  });

  it('draws the end of last night and the start of tonight on a day', () => {
    const last = sleep('a', '2026-10-05T03:10:00', '2026-10-05T08:20:00'); // night of Oct 4
    const tonight = sleep('b', '2026-10-05T23:30:00', '2026-10-06T07:00:00');
    const bands = sleepBands('2026-10-05', [last, tonight], 4);
    expect(bands.map(b => [b.part, b.start, b.end])).toEqual([['morning', 240, 500], ['night', 1410, 1680]]);
  });

  it('ongoing sleep runs until now', () => {
    const s = sleep('c', '2026-10-05T23:00:00');
    const [b] = sleepBands('2026-10-05', [s], 4, at('2026-10-06T01:00:00'));
    expect([b.start, b.end]).toEqual([1380, 1500]);
  });

  it('stats: averages, regularity and debt against the target', () => {
    const s = sleepStats([
      sleep('1', '2026-10-01T23:00:00', '2026-10-02T07:00:00'),
      sleep('2', '2026-10-03T03:00:00', '2026-10-03T08:00:00'),
      sleep('nap', '2026-10-03T14:00:00', '2026-10-03T14:30:00'), // a nap does not replace the night
    ], '2026-10-01', '2026-10-07');
    expect(s.rows.map(r => [r.night, clockOf(r.bed), clockOf(r.wake), r.minutes])).toEqual([
      ['2026-10-01', '23:00', '07:00', 480],
      ['2026-10-02', '03:00', '08:00', 300],
    ]);
    expect(s.avgMinutes).toBe(390);
    expect(s.debt).toBe(180);
    expect(clockOf(s.avgBed)).toBe('01:00');
  });
});
