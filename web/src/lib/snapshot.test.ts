import { describe, expect, it } from 'vitest';
import { buildSnapshot } from './snapshot';
import { codeHash, newCode, normalizeCode } from './pairing';
import type { Area, DayBlock, FocusSession, Task, TimeRecord } from './types';

const areas = [{ id: 'w', name: 'Work', color: 'blue', icon: 'briefcase', sort: 0, updatedAt: '' }, { id: 'm', name: 'Music', color: 'purple', icon: 'music', sort: 1, updatedAt: '' }] as Area[];
const blk = (id: string, start: number, end: number, areaId: string, title: string): DayBlock => ({ id, dayId: '2026-10-05', start, end, areaId, title, updatedAt: '' });

describe('snapshot', () => {
  it('builds now/next/progress at 10:42 in São Paulo', () => {
    const s = buildSnapshot({
      blocks: [blk('a', 600, 660, 'w', 'Work'), blk('b', 660, 720, 'm', 'Guitar')],
      records: [{ id: 'r', dayId: '2026-10-05', start: 600, end: null, startedAt: '2026-10-05T13:00:00Z', areaId: 'w', title: 'Work', source: 'live', createdAt: '', updatedAt: '' } as TimeRecord],
      tasks: [{ id: 't', title: 'Fix sync', status: 'today', dayId: '2026-10-05', blockId: 'a', priority: 'high', createdAt: '', sort: 0, updatedAt: '' } as Task],
      sessions: [{ id: 'f', dayId: '2026-10-05', title: 'Fix sync', taskId: 't', focusMin: 25, breakMin: 5, startedAt: '2026-10-05T13:30:00Z', pausedMs: 0, state: 'running', preset: '25/5', areaId: 'w', updatedAt: '' } as FocusSession],
      areas,
    }, new Date('2026-10-05T13:42:00Z'), 'America/Sao_Paulo', 4);
    expect(s.clock).toBe('10:42');
    expect(s.now).toMatchObject({ title: 'Work', remainingMin: 18, color: '#248CF2', endLabel: '11:00' });
    expect(s.next).toMatchObject({ title: 'Guitar', startLabel: '11:00', inMin: 18 });
    expect(s.running).toMatchObject({ elapsedMin: 42, sinceLabel: '10:00' });
    expect(s.focus).toMatchObject({ leftSec: 13 * 60, paused: false });
    expect(s.tasks).toMatchObject({ next: ['Fix sync'], high: ['Fix sync'], inProgress: ['Fix sync'] });
    expect(s.progress).toMatchObject({ trackedMin: 42, plannedMin: 120, plannedSoFarMin: 42 });
  });
});

describe('pairing codes', () => {
  it('are 8 unambiguous characters and normalize typing', async () => {
    const c = newCode();
    expect(c).toMatch(/^[A-HJ-KM-NP-Z2-9]{8}$/);
    expect(normalizeCode(' ab-cd ef12 ')).toBe('ABCDEF12');
    expect(await codeHash('ABC')).toHaveLength(64);
  });
});
