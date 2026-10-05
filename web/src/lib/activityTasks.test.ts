import { describe, expect, it } from 'vitest';
import { activityTasks } from './activityTasks';
import type { DayBlock, Task } from './types';

const t = (id: string, p: Partial<Task>): Task => ({ id, title: id, status: 'today', dayId: 'd', createdAt: '', sort: 0, updatedAt: '', ...p });
const blocks = [{ id: 'mk', dayId: 'd', start: 360, end: 540, areaId: 'maker', title: 'Maker', updatedAt: '' }, { id: 'mk2', dayId: 'd', start: 1200, end: 1260, areaId: 'maker', title: 'Maker', updatedAt: '' }] as DayBlock[];

describe('to-dos for the current activity', () => {
  const tasks = [
    t('inBlock', { blockId: 'mk' }),
    t('otherMakerBlock', { blockId: 'mk2' }),
    t('makerNoBlock', { areaId: 'maker' }),
    t('workToday', { areaId: 'work' }),
    t('doneMaker', { areaId: 'maker', status: 'done' }),
    t('backlogMaker', { status: 'backlog', areaId: 'maker', dayId: undefined, priority: 'high' }),
    t('inboxMaker', { status: 'inbox', areaId: 'maker', dayId: undefined }),
    t('backlogWork', { status: 'backlog', areaId: 'work', dayId: undefined }),
  ];
  it('shows today’s to-dos of the area even when doing it off-plan (no block)', () => {
    const r = activityTasks({ areaId: 'maker' }, 'd', tasks, blocks);
    expect(r.today.map(x => x.id)).toEqual(['inBlock', 'otherMakerBlock', 'makerNoBlock', 'doneMaker']);
    expect(r.suggestions.map(x => x.id)).toEqual(['backlogMaker', 'inboxMaker']);
  });
  it('puts the current block’s to-dos first', () => {
    const r = activityTasks({ areaId: 'maker', blockId: 'mk2' }, 'd', tasks, blocks);
    expect(r.today[0].id).toBe('otherMakerBlock');
  });
});
