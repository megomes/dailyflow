import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DailyFlowDB, setDB } from './db';
import { entityCsv, exportAll } from './export';
import { createTask, saveDayAsTemplate, toggleTaskDone } from './ops';
import { nextDate } from './recurrence';
import { ensureDay, seedIfEmpty } from './repo';
import { facets, matches } from './taskFilter';
import type { Task } from './types';

describe('recurrence', () => {
  it('computes next dates', () => {
    expect(nextDate({ freq: 'daily' }, '2026-10-05')).toBe('2026-10-06');
    expect(nextDate({ freq: 'weekdays' }, '2026-10-09')).toBe('2026-10-12');
    expect(nextDate({ freq: 'weekly', interval: 2 }, '2026-10-05')).toBe('2026-10-19');
    expect(nextDate({ freq: 'monthly' }, '2026-01-31')).toBe('2026-02-28');
  });
});

describe('filters', () => {
  const t = (p: Partial<Task>): Task => ({ id: 'x', title: 'Fix sync bug', status: 'backlog', createdAt: '', sort: 0, updatedAt: '', ...p });
  it('searches title, tags, project and subtasks', () => {
    expect(matches(t({ tags: ['dcs'] }), { q: 'sync dcs' }, '2026-10-05')).toBe(true);
    expect(matches(t({ project: 'Sortie' }), { q: 'sortie' }, '2026-10-05')).toBe(true);
    expect(matches(t({ subtasks: [{ id: 's', title: 'write test', done: false }] }), { q: 'test' }, '2026-10-05')).toBe(true);
    expect(matches(t({}), { q: 'nope' }, '2026-10-05')).toBe(false);
  });
  it('filters by due', () => {
    expect(matches(t({ due: '2026-10-01' }), { due: 'overdue' }, '2026-10-05')).toBe(true);
    expect(matches(t({ due: '2026-10-10' }), { due: 'week' }, '2026-10-05')).toBe(true);
    expect(matches(t({ due: '2026-11-10' }), { due: 'week' }, '2026-10-05')).toBe(false);
    expect(facets([t({ tags: ['a', 'b'] }), t({ tags: ['a'], project: 'P' })])).toEqual({ projects: ['P'], tags: ['a', 'b'] });
  });
});

describe('E12 operations', () => {
  let db: DailyFlowDB;
  beforeEach(async () => { db = new DailyFlowDB(`e12-${Math.random()}`); setDB(db); await seedIfEmpty(); });

  it('creates the next occurrence when a recurring task is done', async () => {
    const task = await createTask('Pay bills', { recurrence: { freq: 'monthly' }, due: '2026-10-05', subtasks: [{ id: 's', title: 'water', done: true }] });
    await toggleTaskDone(task.id);
    const all = await db.tasks.toArray();
    const next = all.find(x => x.id !== task.id)!;
    expect(next).toMatchObject({ title: 'Pay bills', status: 'backlog', due: '2026-11-05', seriesId: task.id });
    expect(next.subtasks?.[0].done).toBe(false);
  });

  it('saves a day as a weekday template and exports everything', async () => {
    await ensureDay('2026-10-05');
    expect(await saveDayAsTemplate('2026-10-05', 'sat')).toBe(9);
    const sat = (await db.templateBlocks.where('templateId').equals('sat').toArray()).filter(b => !b.deleted);
    expect(sat).toHaveLength(9);
    const ex = await exportAll();
    expect(ex.data.day_block).toHaveLength(9);
    expect(entityCsv(ex.data.area as Record<string, unknown>[]).split('\n')).toHaveLength(12);
  });
});
