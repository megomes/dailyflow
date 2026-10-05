import type { DayBlock, Task } from './types';

/**
 * To-dos for what you are doing now (Now card): everything for today in this block or this
 * area, plus a few suggestions from the area's Inbox/Backlog. Pure.
 */
export interface ActivityCtx { areaId: string; blockId?: string }

const rank = (t: Task) => (t.priority === 'high' ? 0 : t.priority === 'med' ? 1 : t.priority === 'low' ? 3 : 2);

export function activityTasks(ctx: ActivityCtx, dayId: string, tasks: Task[], blocks: DayBlock[], max = 5) {
  const blockArea = new Map(blocks.map(b => [b.id, b.areaId]));
  const live = tasks.filter(t => !t.deleted);
  const matches = (t: Task) =>
    (ctx.blockId && t.blockId === ctx.blockId) ||
    t.areaId === ctx.areaId ||
    (!!t.blockId && blockArea.get(t.blockId) === ctx.areaId);
  const today = live
    .filter(t => t.dayId === dayId && (t.status === 'today' || t.status === 'done') && matches(t))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (ctx.blockId ? Number(b.blockId === ctx.blockId) - Number(a.blockId === ctx.blockId) : 0) || rank(a) - rank(b) || a.sort - b.sort);
  const suggestions = live
    .filter(t => (t.status === 'inbox' || t.status === 'backlog') && t.areaId === ctx.areaId)
    .sort((a, b) => Number(!!b.carried?.length) - Number(!!a.carried?.length) || rank(a) - rank(b) || (a.due ?? '9').localeCompare(b.due ?? '9') || a.sort - b.sort)
    .slice(0, max);
  return { today, suggestions };
}
