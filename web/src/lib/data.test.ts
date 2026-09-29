import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DailyFlowDB, setDB } from './db';
import { copyTemplate, ensureDay, migrateToDayTemplates, remove, save, seedIfEmpty, update } from './repo';
import { SEED_TS } from './seed';
import { applyRemote } from './sync';
import type { DayBlock, TemplateBlock } from './types';

let db: DailyFlowDB;
beforeEach(async () => {
  db = new DailyFlowDB(`test-${Math.random()}`);
  setDB(db);
  await seedIfEmpty();
});

describe('seed and day creation', () => {
  it('seeds the 11 areas and one template per weekday once', async () => {
    expect(await db.areas.count()).toBe(11);
    expect(await db.templateBlocks.where('templateId').equals('mon').count()).toBe(9);
    expect(await db.templateBlocks.where('templateId').equals('tue').count()).toBe(9);
    expect(await db.templateBlocks.where('templateId').equals('sat').count()).toBe(7);
    await seedIfEmpty();
    expect(await db.areas.count()).toBe(11);
  });

  it('creates a Monday from the Monday template with deterministic ids', async () => {
    expect(await ensureDay('2026-09-28')).toBe(true);
    expect((await db.days.get('2026-09-28'))?.templateId).toBe('mon');
    const blocks = await db.dayBlocks.where('dayId').equals('2026-09-28').toArray();
    expect(blocks).toHaveLength(9);
    expect(blocks.map(b => b.id)).toContain('2026-09-28:tb-mon:tb-weekday-1');
    expect(await ensureDay('2026-09-28')).toBe(false);
  });

  it('refills a day an old build created empty from the Weekday template', async () => {
    await save('day', { id: '2026-09-29', templateId: 'weekday', createdAt: '2026-09-29T10:29:10Z', updatedAt: '' });
    expect(await ensureDay('2026-09-29')).toBe(true);
    expect((await db.days.get('2026-09-29'))?.templateId).toBe('tue');
    expect(await db.dayBlocks.where('dayId').equals('2026-09-29').count()).toBe(9);
    expect(await ensureDay('2026-09-29')).toBe(false);
  });

  it('leaves a legacy day alone once it has blocks, even deleted ones', async () => {
    await save('day', { id: '2026-09-25', templateId: 'weekday', createdAt: '2026-09-25T10:00:00Z', updatedAt: '' });
    await save('day_block', { id: 'x', dayId: '2026-09-25', start: 0, end: 30, title: 'x', areaId: 'area-work', deleted: true, updatedAt: '' });
    expect(await ensureDay('2026-09-25')).toBe(false);
    expect(await db.dayBlocks.where('dayId').equals('2026-09-25').count()).toBe(1);
  });

  it('editing the day never touches the template', async () => {
    await ensureDay('2026-09-28');
    const block = (await db.dayBlocks.get('2026-09-28:tb-mon:tb-weekday-4'))!;
    await save('day_block', { ...block, start: 13 * 60, end: 14 * 60 });
    await remove('day_block', '2026-09-28:tb-mon:tb-weekday-1');
    const tpl = await db.templateBlocks.get('tb-mon:tb-weekday-4');
    expect(tpl?.start).toBe(11 * 60);
    expect((await db.templateBlocks.get('tb-mon:tb-weekday-1'))?.deleted).toBeFalsy();
    expect((await db.dayBlocks.get('2026-09-28:tb-mon:tb-weekday-1'))?.deleted).toBe(true);
  });

  it('uses the edited template for days created afterwards', async () => {
    const tpl = (await db.templateBlocks.get('tb-sat:tb-weekend-1'))!;
    await save('template_block', { ...tpl, title: 'Slow breakfast' });
    await ensureDay('2026-10-03');
    expect((await db.dayBlocks.get('2026-10-03:tb-sat:tb-weekend-1'))?.title).toBe('Slow breakfast');
    await ensureDay('2026-10-04'); // Sunday keeps its own template
    expect((await db.dayBlocks.get('2026-10-04:tb-sun:tb-weekend-1'))?.title).toBe('Family breakfast');
  });

  it('keeps both of two rapid edits to the same block', async () => {
    await ensureDay('2026-09-28');
    const id = '2026-09-28:tb-mon:tb-weekday-3';
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

describe('per-weekday templates (note #2)', () => {
  it('copies one day onto another, replacing its blocks', async () => {
    const mon = await db.templateBlocks.where('templateId').equals('mon').toArray();
    await update<TemplateBlock>('template_block', mon[0].id, { title: 'Deep work' });
    expect(await copyTemplate('mon', 'tue')).toBe(9);
    const tue = (await db.templateBlocks.where('templateId').equals('tue').toArray()).filter(b => !b.deleted);
    expect(tue).toHaveLength(9);
    expect(tue.map(b => b.title)).toContain('Deep work');
    expect(await db.templateBlocks.where('templateId').equals('mon').filter(b => !b.deleted).count()).toBe(9);
  });

  it('migrates an edited legacy Weekday/Weekend setup once, and only after a sync', async () => {
    await db.templateBlocks.clear();
    await db.meta.clear();
    await db.templateBlocks.bulkPut([
      { id: 'tb-weekday-1', templateId: 'weekday', start: 360, end: 540, title: 'Maker (edited)', areaId: 'area-maker', updatedAt: '2026-09-27T10:00:00.000Z' },
      { id: 'tb-weekend-1', templateId: 'weekend', start: 420, end: 540, title: 'Breakfast', areaId: 'area-family', updatedAt: SEED_TS },
    ]);
    expect(await migrateToDayTemplates(false)).toBe(0);
    expect(await migrateToDayTemplates(true)).toBe(7);
    expect((await db.templateBlocks.get('tb-wed:tb-weekday-1'))?.title).toBe('Maker (edited)');
    expect((await db.templateBlocks.get('tb-sun:tb-weekend-1'))?.title).toBe('Breakfast');
    expect((await db.templateBlocks.get('tb-weekday-1'))?.deleted).toBe(true);
    expect(await migrateToDayTemplates(true)).toBe(0);
  });

  it('does not migrate a fresh device that already has per-day templates', async () => {
    expect(await migrateToDayTemplates(true)).toBe(0);
    expect(await db.templateBlocks.where('templateId').equals('fri').count()).toBe(9);
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
    const rec = (await db.dayBlocks.get('2026-09-28:tb-mon:tb-weekday-2'))!;
    await applyRemote([{ entity: 'day_block', id: rec.id, data: { ...rec }, updatedAt: '2999-01-01T00:00:00.000Z', deleted: true, seq: 4 }]);
    expect((await db.dayBlocks.get(rec.id))?.deleted).toBe(true);
  });
});
