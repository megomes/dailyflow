import { describe, expect, it } from 'vitest';
import { quickOps } from './quick';
import type { DayBlock, TimeRecord } from './types';

const blocks = [{ id: 'w', dayId: '2026-10-05', start: 600, end: 660, title: 'Work', areaId: 'area-work', updatedAt: '' }] as DayBlock[];
const at = new Date('2026-10-05T13:20:00Z'); // 10:20 in São Paulo

describe('quick actions', () => {
  it('starts the current block, stopping what was running', () => {
    const running = { id: 'r', dayId: '2026-10-05', start: 560, end: null, areaId: 'area-maker', title: 'Maker', source: 'live', createdAt: '', updatedAt: '' } as TimeRecord;
    const { ops, message } = quickOps('start', { blocks, records: [running] }, at, 'America/Sao_Paulo', 4, () => 'new');
    expect(message).toBe('Started Work');
    expect(ops[0]).toMatchObject({ id: 'r', data: { end: 620 } });
    expect(ops[1]).toMatchObject({ id: 'new', data: { start: 620, end: null, blockId: 'w', dayId: '2026-10-05' } });
    expect(ops[1].updatedAt > ops[0].updatedAt).toBe(true);
  });
  it('stops, and does nothing when there is nothing to do', () => {
    const running = { id: 'r', dayId: '2026-10-05', start: 600, end: null, areaId: 'area-work', title: 'Work', blockId: 'w', source: 'live', createdAt: '', updatedAt: '' } as TimeRecord;
    expect(quickOps('start', { blocks, records: [running] }, at, 'America/Sao_Paulo', 4, () => 'x').ops).toHaveLength(0);
    expect(quickOps('stop', { blocks, records: [running] }, at, 'America/Sao_Paulo', 4, () => 'x').ops[0]).toMatchObject({ data: { end: 620 } });
    expect(quickOps('stop', { blocks, records: [] }, at, 'America/Sao_Paulo', 4, () => 'x').message).toBe('Nothing running');
  });
});
