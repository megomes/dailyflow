import { describe, expect, it } from 'vitest';
import { areaDistribution, compareAreas, daysIn, estimationAccuracy, focusStats, goalProgress, median, monthOf, plannedVsReal, previous, weekOf } from './insights';
import type { DayBlock, FocusSession, Task, TimeRecord } from './types';

const rec = (dayId: string, start: number, end: number, areaId: string): TimeRecord =>
  ({ id: `${dayId}${start}`, dayId, start, end, areaId, title: '', source: 'live', createdAt: '', updatedAt: '' });

describe('periods', () => {
  it('builds Monday-first weeks and months', () => {
    expect(weekOf('2026-10-08')).toMatchObject({ from: '2026-10-05', to: '2026-10-11' });
    expect(monthOf('2026-02-10')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(previous(weekOf('2026-10-08'))).toMatchObject({ from: '2026-09-28', to: '2026-10-04' });
    expect(previous(monthOf('2026-03-15'))).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(daysIn(weekOf('2026-10-08'))).toHaveLength(7);
  });
});

describe('aggregations', () => {
  const week = weekOf('2026-10-05');
  const recs = [rec('2026-10-05', 360, 540, 'maker'), rec('2026-10-05', 600, 660, 'work'), rec('2026-10-06', 600, 720, 'work'), rec('2026-10-20', 0, 60, 'work')];
  it('sums real time per area in the period', () => {
    const { total, byDay } = areaDistribution(recs, week);
    expect(total.get('work')).toBe(180);
    expect(total.get('maker')).toBe(180);
    expect(byDay.get('2026-10-05')?.get('work')).toBe(60);
  });
  it('compares plan and real only on tracked days', () => {
    const blocks = [
      { id: 'a', dayId: '2026-10-05', start: 360, end: 540, areaId: 'maker', title: '', updatedAt: '' },
      { id: 'b', dayId: '2026-10-07', start: 360, end: 540, areaId: 'maker', title: '', updatedAt: '' },
    ] as DayBlock[];
    const r = plannedVsReal(blocks, recs, week);
    expect(r.days).toBe(2);
    expect(r.rows.find(x => x.areaId === 'maker')).toEqual({ areaId: 'maker', planned: 180, real: 180 });
  });
  it('measures estimates against focus time', () => {
    const t = (id: string, estimate: number, areaId: string) => ({ id, title: id, status: 'done', estimate, areaId, doneAt: '2026-10-06T10:00:00Z', createdAt: '', sort: 0, updatedAt: '' }) as Task;
    const s = (taskId: string, actualMin: number) => ({ id: taskId + actualMin, taskId, actualMin, dayId: '2026-10-06', state: 'done', startedAt: '2026-10-06T10:00:00', preset: '25/5' }) as FocusSession;
    const acc = estimationAccuracy([t('a', 60, 'work'), t('b', 30, 'work'), t('c', 30, 'maker')], [s('a', 90), s('b', 30), s('c', 15)], week);
    expect(acc.samples).toHaveLength(3);
    expect(acc.groups.find(g => g.areaId === 'work')).toMatchObject({ n: 2, median: 1.25 });
    expect(acc.median).toBe(1);
  });
  it('summarizes focus', () => {
    const f = focusStats([
      { id: '1', dayId: '2026-10-05', actualMin: 25, state: 'done', startedAt: '2026-10-05T09:00:00', preset: '25/5' },
      { id: '2', dayId: '2026-10-05', actualMin: 10, state: 'interrupted', startedAt: '2026-10-05T14:00:00', preset: '25/5' },
    ] as FocusSession[], week);
    expect(f).toMatchObject({ sessions: 2, minutes: 35, completion: 0.5 });
    expect(f.byHour[9]).toBe(25);
  });
  it('compares periods and goals', () => {
    const c = compareAreas(new Map([['work', 300]]), new Map([['work', 200], ['maker', 60]]));
    expect(c[0]).toMatchObject({ areaId: 'work', delta: 100, pct: 0.5 });
    expect(goalProgress({ music: 120 }, new Map([['music', 60]]), weekOf('2026-10-05'))).toEqual([{ areaId: 'music', target: 120, done: 60, ratio: 0.5 }]);
    expect(median([3, 1, 2, 4])).toBe(2.5);
  });
});
