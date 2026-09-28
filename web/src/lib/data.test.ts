import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DailyFlowDB, setDB } from './db';
import { ensureDay, remove, save, seedIfEmpty, update } from './repo';
import { SEED_TS } from './seed';
import { applyRemote } from './sync';
import type { DayBlock } from './types';

let db: DailyFlowDB;
beforeEach(async () => {
  db = new DailyFlowDB(`test-${Math.random()}`);
  setDB(db);
  await seedIfEmpty();
});

describe('seed and day creation', () => {
  it('seeds the 11 areas and both templates once', async () => {
    expect(await db.areas.count()).toBe(11);
    expect(await db.templateBlocks.where('templateId').equals('weekday').count()).toBe(9);
    await seedIfEmpty();
    expect(await db.areas.count()).toBe(11);
  });

  it('creates a Monday from the weekday template with deterministic ids', async () => {
    expect(await ensureDay('2026-09-28')).toBe(true);
    const blocks = await db.dayBlocks.where('dayId').equals('2026-09-28').toArray();
    expect(blocks).toHaveLength(9);
    expect(blocks.map(b => b.id)).toContain('2026-09-28:tb-weekday-1');
    expect(await ensureDay('2026-09-28')).toBe(false);
  });

  it('editing the day never touches the template', async () => {
    await ensureDay('2026-09-28');
    const block = (await db.dayBlocks.get('2026-09-28:tb-weekday-4'))!;
    await save('day_block', { ...block, start: 13 * 60, end: 14 * 60 });
    await remove('day_block', '2026-09-28:tb-weekday-1');
    const tpl = await db.templateBlocks.get('tb-weekday-4');
    expect(tpl?.start).toBe(11 * 60);
    expect((await db.templateBlocks.get('tb-weekday-1'))?.deleted).toBeFalsy();
    expect((await db.dayBlocks.get('2026-09-28:tb-weekday-1'))?.deleted).toBe(true);
  });

  it('uses the edited template for days created afterwards', async () => {
    const tpl = (await db.templateBlocks.get('tb-weekend-1'))!;
    await save('template_block', { ...tpl, title: 'Slow breakfast' });
    await ensureDay('2026-10-03');
    expect((await db.dayBlocks.get('2026-10-03:tb-weekend-1'))?.title).toBe('Slow breakfast');
  });

  it('keeps both of two rapid edits to the same block', async () => {
    await ensureDay('2026-09-28');
    const id = '2026-09-28:tb-weekday-3';
    await Promise.all([update<DayBlock>('day_block', id, { title: 'Report' }), update<DayBlock>('day_block', id, { areaId: 'area-maker' })]);
    const rec = await db.dayBlocks.get(id);
    expect(rec?.title).toBe('Report');
    expect(rec?.areaId).toBe('area-maker');
  });

  it('queues every local write in the outbox', async () => {
    const before = await db.outbox.count();
    await ensureDay('2026-09-29');
    expect(await db.outbox.count()).toBe(before + 10); // day + 9 blocks
  });
});

describe('sync merge (last writer wins)', () => {
  it('applies newer remote records and ignores older ones', async () => {
    const area = (await db.areas.get('area-work'))!;
    expect(area.updatedAt).toBe(SEED_TS);
    await applyRemote([{ entity: 'area', id: 'area-work', data: { ...area, name: 'Job' }, updatedAt: '2026-09-28T10:00:00.000Z', deleted: false, seq: 1 }]);
    expect((await db.areas.get('area-work'))?.name).toBe('Job');
    await applyRemote([{ entity: 'area', id: 'area-work', data: { ...area, name: 'Old' }, updatedAt: '2026-09-28T09:00:00.000Z', deleted: false, seq: 2 }]);
    expect((await db.areas.get('area-work'))?.name).toBe('Job');
  });

  it('keeps a newer local edit over an older remote one', async () => {
    const area = (await db.areas.get('area-music'))!;
    await save('area', { ...area, name: 'Guitar' });
    await applyRemote([{ entity: 'area', id: 'area-music', data: { ...area, name: 'Piano' }, updatedAt: '2000-01-01T00:00:00.000Z', deleted: false, seq: 3 }]);
    expect((await db.areas.get('area-music'))?.name).toBe('Guitar');
  });

  it('applies remote tombstones', async () => {
    await ensureDay('2026-09-28');
    const rec = (await db.dayBlocks.get('2026-09-28:tb-weekday-2'))!;
    await applyRemote([{ entity: 'day_block', id: rec.id, data: { ...rec }, updatedAt: '2999-01-01T00:00:00.000Z', deleted: true, seq: 4 }]);
    expect((await db.dayBlocks.get(rec.id))?.deleted).toBe(true);
  });
});
