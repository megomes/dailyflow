import { describe, expect, it } from 'vitest';
import { fromHealth, supersededManual } from './sleepImport';

describe('sleep from Health Connect', () => {
  it('maps a session to its night (noon to noon) and sums the stages', () => {
    const s = fromHealth({
      id: 'abc', start: '2026-10-06T06:10:00Z', end: '2026-10-06T11:20:00Z', // 03:10 → 08:20 in São Paulo
      stages: [
        { stage: 4, start: '2026-10-06T06:10:00Z', end: '2026-10-06T07:40:00Z' },
        { stage: 5, start: '2026-10-06T07:40:00Z', end: '2026-10-06T08:40:00Z' },
        { stage: 6, start: '2026-10-06T08:40:00Z', end: '2026-10-06T09:30:00Z' },
        { stage: 1, start: '2026-10-06T09:30:00Z', end: '2026-10-06T09:40:00Z' },
        { stage: 4, start: '2026-10-06T09:40:00Z', end: '2026-10-06T11:20:00Z' },
      ],
    }, 'America/Sao_Paulo');
    expect(s).toMatchObject({ id: 'hc-abc', night: '2026-10-05', source: 'health', stages: { light: 190, deep: 60, rem: 50, awake: 10 } });
  });
  it('a manual night mostly covered by the watch gives way; a separate nap stays', () => {
    const health = [{ start: '2026-10-06T02:00:00Z', end: '2026-10-06T10:00:00Z' }];
    expect(supersededManual([
      { id: 'night', start: '2026-10-06T01:30:00Z', end: '2026-10-06T09:30:00Z' },
      { id: 'nap', start: '2026-10-06T17:00:00Z', end: '2026-10-06T17:30:00Z' },
      { id: 'open', start: '2026-10-06T02:00:00Z' },
    ], health)).toEqual(['night']);
  });
});
