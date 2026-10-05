import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { blockActual, capacity, dayGaps, mergeSpans, overlaps, planAsReal, planChanges, replanRemaining, uncovered, whatChanged } from './actual';
import { DailyFlowDB, setDB } from './db';
import { acceptPlanAsReal, addBlock, adoptPlan, closeDay, createTask, deleteBlock, endFocus, focusElapsedSec, patchBlock, scheduleTask, startDay, startFocus, PRESETS } from './ops';
import { ensureDay, save, seedIfEmpty } from './repo';
import type { Task, TimeRecord } from './types';

const blk = (id: string, start: number, end: number, areaId = 'a', fixed = false) => ({ id, start, end, title: id, areaId, fixed });
const rec = (start: number, end: number | null, areaId = 'a', extra: Partial<TimeRecord> = {}): TimeRecord =>
  ({ id: `${start}`, dayId: 'd', start, end, areaId, title: '', source: 'live', createdAt: '', updatedAt: '', ...extra });

describe('spans', () => {
  it('merges and finds uncovered parts', () => {
    expect(mergeSpans([{ start: 10, end: 20 }, { start: 15, end: 30 }, { start: 40, end: 50 }])).toEqual([{ start: 10, end: 30 }, { start: 40, end: 50 }]);
    expect(uncovered([{ start: 10, end: 20 }, { start: 30, end: 40 }], 0, 50)).toEqual([
      { start: 0, end: 10 }, { start: 20, end: 30 }, { start: 40, end: 50 },
    ]);
    expect(uncovered([{ start: 0, end: 60 }], 10, 50)).toEqual([]);
  });

  it('finds gaps only up to now', () => {
    const plan = [blk('m', 360, 540), blk('w', 600, 660)];
    const recs = [rec(380, 500), rec(500, null)];
    expect(dayGaps(plan, recs, 520)).toEqual([{ start: 360, end: 380 }]);
    expect(dayGaps(plan, [rec(380, 500)], 620)).toEqual([{ start: 360, end: 380 }, { start: 500, end: 620 }]);
  });
});

describe('plan as real', () => {
  it('fills only the uncovered parts of past plan blocks', () => {
    const plan = [blk('m', 360, 540, 'maker'), blk('c', 540, 600, 'commute'), blk('w', 600, 660, 'work')];
    const drafts = planAsReal(plan, [rec(400, 450, 'x')], 620);
    expect(drafts).toEqual([
      { start: 360, end: 400, areaId: 'maker', title: 'm', blockId: 'm' },
      { start: 450, end: 540, areaId: 'maker', title: 'm', blockId: 'm' },
      { start: 540, end: 600, areaId: 'commute', title: 'c', blockId: 'c' },
      { start: 600, end: 620, areaId: 'work', title: 'w', blockId: 'w' },
    ]);
  });
  it('does not double-fill overlapping plan blocks', () => {
    const drafts = planAsReal([blk('a', 0, 60), blk('b', 30, 90, 'b')], [], 100);
    expect(drafts.reduce((s, d) => s + d.end - d.start, 0)).toBe(90);
  });
});

describe('what changed', () => {
  it('reports per-area differences biggest first, counting only the past', () => {
    const plan = [blk('m', 360, 540, 'maker'), blk('mu', 660, 720, 'music'), blk('w', 900, 1000, 'work')];
    const recs = [rec(360, 420, 'maker'), rec(420, 540, 'work'), rec(660, 700, 'family')];
    const lines = whatChanged(undefined, plan, recs, 750);
    expect(lines.find(l => l.kind === 'area' && l.areaId === 'work')).toMatchObject({ planned: 0, actual: 120 });
    expect(lines.map(l => (l.kind === 'area' ? Math.abs(l.delta) : 0))).toEqual([120, 120, 40, 40]);
    expect(lines.find(l => l.kind === 'area' && l.areaId === 'maker')).toMatchObject({ planned: 180, actual: 60 });
    // Music had a record over it (family), so it counts as skipped for that part; 700–720 is just untracked.
    expect(lines.find(l => l.kind === 'area' && l.areaId === 'music')).toMatchObject({ planned: 40, actual: 0 });
  });
  it('describes plan changes against the baseline', () => {
    const base = [blk('a', 600, 660), blk('b', 700, 760), blk('c', 800, 860)];
    const cur = [blk('a', 780, 840), blk('b', 700, 730), blk('n', 900, 930)];
    const ch = planChanges(base, cur);
    expect(ch).toContainEqual(expect.objectContaining({ kind: 'moved', title: 'a', from: 600, to: 780 }));
    expect(ch).toContainEqual(expect.objectContaining({ kind: 'resized', title: 'b', from: 60, to: 30 }));
    expect(ch).toContainEqual(expect.objectContaining({ kind: 'removed', title: 'c' }));
    expect(ch).toContainEqual(expect.objectContaining({ kind: 'added', title: 'n' }));
  });
  it('measures real time inside a block', () => {
    expect(blockActual(blk('w', 600, 700, 'work'), [rec(590, 650, 'work'), rec(650, 720, 'x')], 800)).toEqual({ any: 100, same: 50 });
  });
});

describe('replanning', () => {
  it('detects overlaps', () => {
    const c = overlaps([blk('a', 0, 60), blk('b', 30, 90), blk('c', 100, 120)]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ minutes: 30 });
  });
  it('pushes flexible blocks from now around fixed ones', () => {
    const plan = [blk('missed', 600, 660), blk('next', 660, 720), blk('meeting', 720, 780, 'w', true), blk('late', 780, 840)];
    const r = replanRemaining(plan, [], 680, 1440);
    expect(r.moves).toEqual([
      { id: 'missed', start: 780, end: 840 },
      { id: 'next', start: 840, end: 900 },
      { id: 'late', start: 900, end: 960 },
    ]);
  });
  it('keeps blocks already under way and drops what does not fit', () => {
    const plan = [blk('now', 600, 700), blk('a', 700, 760), blk('b', 760, 820)];
    const r = replanRemaining(plan, [rec(600, null)], 650, 800);
    expect(r.moves).toEqual([]);
    expect(r.dropped).toEqual(['b']);
  });
  it('measures block capacity', () => {
    const t = (estimate: number, status: Task['status'] = 'today') => ({ id: `${estimate}`, title: '', status, estimate, blockId: 'b', createdAt: '', sort: 0, updatedAt: '' }) as Task;
    expect(capacity(blk('b', 0, 60), [t(30), t(45), t(20, 'done')])).toEqual({ estimated: 75, available: 60, over: true, count: 2 });
  });
});

describe('day operations', () => {
  let db: DailyFlowDB;
  beforeEach(async () => {
    db = new DailyFlowDB(`ops-${Math.random()}`);
    setDB(db);
    await seedIfEmpty();
    await ensureDay('2026-09-28');
  });

  it('freezes the baseline at start and records revisions only after it', async () => {
    const { id, revId } = await addBlock('2026-09-28', { start: 1300, end: 1320, title: 'x', areaId: 'area-work' });
    expect(revId).toBeNull();
    await startDay('2026-09-28', 'quick');
    const day = await db.days.get('2026-09-28');
    expect(day?.status).toBe('active');
    expect(day?.baseline).toHaveLength(10);
    const rev = await patchBlock(id, { start: 1310, end: 1330 }, 'move');
    expect(rev).toBeTruthy();
    await deleteBlock(id);
    expect(await db.revisions.count()).toBe(2);
    expect((await db.days.get('2026-09-28'))?.baseline).toHaveLength(10);
  });

  it('lets the first plan of an implicitly started day become its baseline', async () => {
    await startDay('2026-09-28', 'implicit');
    const { id } = await addBlock('2026-09-28', { start: 1300, end: 1320, title: 'x', areaId: 'area-work' });
    expect((await db.days.get('2026-09-28'))?.baseline).toHaveLength(9);
    expect(await adoptPlan('2026-09-28', 'guided')).toBe(true);
    const day = await db.days.get('2026-09-28');
    expect(day?.startMode).toBe('guided');
    expect(day?.baseline?.some(b => b.id === id)).toBe(true);
    // Only once: later plan changes are revisions against that baseline.
    expect(await adoptPlan('2026-09-28', 'guided')).toBe(false);
  });

  it('accepts the plan as real and returns unfinished tasks to the backlog on close', async () => {
    await startDay('2026-09-28', 'quick');
    const n = await acceptPlanAsReal('2026-09-28', 24 * 60);
    expect(n).toBe(9);
    const t = await createTask('Fix sync');
    await scheduleTask(t.id, '2026-09-28', '2026-09-28:tb-mon:tb-weekday-1');
    expect((await db.tasks.get(t.id))?.areaId).toBe('area-maker');
    await closeDay('2026-09-28', { energy: 4 }, Date.now());
    const after = await db.tasks.get(t.id);
    expect(after?.status).toBe('backlog');
    expect(after?.carried).toEqual(['2026-09-28']);
    expect((await db.days.get('2026-09-28'))?.status).toBe('closed');
  });

  it('runs a focus session and stops it in the past when forgotten', async () => {
    const t = await createTask('Write');
    const f = await startFocus('2026-09-28', { preset: PRESETS[0], taskId: t.id, areaId: 'area-work', title: 'Write' });
    expect((await db.timeRecords.toArray()).filter(r => r.end == null)).toHaveLength(1);
    await save('focus_session', { ...f, startedAt: new Date(Date.now() - 90 * 60000).toISOString() });
    const stored = await db.focusSessions.get(f.id);
    expect(Math.round(focusElapsedSec(stored!) / 60)).toBe(90);
    await endFocus(f.id, 'done', new Date(Date.now() - 60 * 60000));
    expect((await db.focusSessions.get(f.id))?.actualMin).toBe(30);
  });
});
