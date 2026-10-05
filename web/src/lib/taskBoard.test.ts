import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DailyFlowDB, setDB } from './db';
import { createTask, moveTask, placeOf, restoreTask, startDay } from './ops';
import { ensureDay, seedIfEmpty } from './repo';
import { columnOf, fitToday, nextSlot } from './taskBoard';
import type { DayBlock, Task } from './types';

const DAY = '2026-10-05';
const t = (p: Partial<Task>): Task => ({ id: 'x', title: 'Fix sync bug', status: 'backlog', createdAt: '', sort: 0, updatedAt: '', ...p });
const blk = (id: string, start: number, end: number, areaId = 'area-maker'): DayBlock => ({ id, dayId: DAY, start, end, title: id, areaId, updatedAt: '' });

describe('board columns', () => {
  it('puts each task in one column', () => {
    expect(columnOf(t({ status: 'inbox' }), DAY)).toBe('inbox');
    expect(columnOf(t({ status: 'today', dayId: DAY }), DAY)).toBe('today');
    expect(columnOf(t({ status: 'today', dayId: '2026-10-03' }), DAY)).toBe('today');
    expect(columnOf(t({ status: 'today', dayId: '2026-10-09' }), DAY)).toBe('backlog');
    expect(columnOf(t({ status: 'done' }), DAY)).toBe('done');
    expect(columnOf(t({ status: 'archived' }), DAY)).toBeNull();
  });
});

describe('fitting a task into today', () => {
  const blocks = [blk('a', 540, 660), blk('b', 720, 780, 'area-personal'), blk('c', 840, 960)];
  it('lists blocks still ahead, same area first, with free time', () => {
    const task = t({ areaId: 'area-personal', estimate: 30 });
    const f = fitToday(task, blocks, [t({ id: 'y', status: 'today', blockId: 'c', estimate: 45 })], 600);
    expect(f.blocks.map(b => b.block.id)).toEqual(['b', 'a', 'c']);
    expect(f.blocks.find(b => b.block.id === 'a')).toMatchObject({ free: 60, now: true });
    expect(f.blocks.find(b => b.block.id === 'c')?.free).toBe(75);
    expect(f.estimated).toBe(75);
    expect(f.left).toBe(60 + 60 + 120);
    expect(f.slot).toEqual({ start: 660, end: 690 });
  });
  it('finds the next free gap', () => {
    expect(nextSlot(blocks, 545, 60)).toEqual({ start: 660, end: 720 });
    expect(nextSlot(blocks, 545, 90)).toEqual({ start: 960, end: 1050 });
    expect(nextSlot([], 1430, 30)).toBeNull();
  });
});

describe('moving tasks on the board', () => {
  let db: DailyFlowDB;
  beforeEach(async () => { db = new DailyFlowDB(`board-${Math.random()}`); setDB(db); await seedIfEmpty(); });

  it('marks tasks added to a day that already started, and undoes moves', async () => {
    await ensureDay(DAY);
    const a = await createTask('Planned', { status: 'backlog' });
    await moveTask(a, 'today', DAY, 'test');
    expect((await db.tasks.get(a.id))?.addedLate).toBeUndefined();
    await startDay(DAY, 'quick');
    const b = await createTask('Urgent');
    await moveTask(b, 'today', DAY, 'test');
    const moved = (await db.tasks.get(b.id))!;
    expect(moved).toMatchObject({ status: 'today', dayId: DAY });
    expect(moved.addedLate).toBeTruthy();
    await restoreTask(b.id, placeOf(b));
    expect(await db.tasks.get(b.id)).toMatchObject({ status: 'inbox', dayId: undefined, addedLate: undefined });
    await moveTask(moved, 'backlog', DAY, 'test');
    expect(await db.tasks.get(b.id)).toMatchObject({ status: 'backlog', dayId: undefined, addedLate: undefined });
  });
});

describe('snoozing (Later)', () => {
  it('sends a task to tomorrow, next Monday or the 1st of next month, and hides it until then', async () => {
    const { deferDate, isSnoozed } = await import('./taskBoard');
    expect(deferDate('tomorrow', '2026-10-05')).toBe('2026-10-06');
    expect(deferDate('week', '2026-10-05')).toBe('2026-10-12'); // Monday → next Monday
    expect(deferDate('week', '2026-10-09')).toBe('2026-10-12'); // Friday → Monday
    expect(deferDate('month', '2026-10-31')).toBe('2026-11-01');
    expect(isSnoozed(t({ status: 'inbox', deferUntil: '2026-10-06' }), DAY)).toBe(true);
    expect(isSnoozed(t({ status: 'inbox', deferUntil: DAY }), DAY)).toBe(false);
  });
});
