'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { prioRank, useAllSessions, useDay } from '@/components/day/useDay';
import { Modal } from '@/components/Modal';
import { FitToday } from '@/components/tasks/FitToday';
import { QuickAdd } from '@/components/tasks/QuickAdd';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { ESTIMATES, TaskDetail } from '@/components/tasks/TaskDetail';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { useClock, useCoarsePointer, useIsMobile } from '@/lib/hooks';
import { deleteTask, moveTask, placeOf, restoreTask, scheduleTask, toggleTaskDone, trackedByTask, updateTask, type TaskPlace } from '@/lib/ops';
import { activeAreas } from '@/lib/repo';
import { columnOf, COLUMNS, type Column } from '@/lib/taskBoard';
import { facets, isFiltering, matches, type TaskFilter } from '@/lib/taskFilter';
import type { Task } from '@/lib/types';

export default function TasksPage() {
  const { day, minute } = useClock();
  const isMobile = useIsMobile();
  const coarse = useCoarsePointer();
  const rows = useLiveQuery(() => getDB().tasks.toArray(), []);
  const areasRaw = useLiveQuery(() => getDB().areas.toArray(), []);
  const d = useDay(day);
  const sessions = useAllSessions();
  const [selId, setSelId] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [fit, setFit] = useState<{ id: string; prev: TaskPlace } | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [jump, setJump] = useState<{ col: Column; n: number } | null>(null);

  const areas = useMemo(() => activeAreas(areasRaw ?? []), [areasRaw]);
  const areaMap = useMemo(() => new Map((areasRaw ?? []).map(a => [a.id, a])), [areasRaw]);
  const tracked = useMemo(() => trackedByTask(sessions), [sessions]);
  const [filter, setFilter] = useState<TaskFilter>({});
  const unfiltered = useMemo(() => (rows ?? []).filter(t => !t.deleted), [rows]);
  const all = useMemo(() => unfiltered.filter(t => matches(t, filter, day)), [unfiltered, filter, day]);
  const fac = useMemo(() => facets(unfiltered), [unfiltered]);
  const cols = useMemo(() => {
    const by: Record<Column, Task[]> = { inbox: [], backlog: [], today: [], done: [] };
    for (const t of all) { const c = columnOf(t, day); if (c) by[c].push(t); }
    by.inbox.sort((a, b) => b.sort - a.sort);
    by.backlog.sort((a, b) => prioRank(a) - prioRank(b) || (a.due ?? '9').localeCompare(b.due ?? '9') || a.sort - b.sort);
    by.today.sort((a, b) => a.sort - b.sort);
    by.done.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
    return by;
  }, [all, day]);
  const sel = all.find(t => t.id === selId) ?? null;
  const detail = all.find(t => t.id === open) ?? null;
  const fitTask = fit ? unfiltered.find(t => t.id === fit.id && columnOf(t, day) === 'today') ?? null : null;

  useEffect(() => { track('tasks_opened', { inbox: cols.inbox.length, backlog: cols.backlog.length, view: 'board' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  /** Every move on the board goes through here: drag, long-press dock, the Today button and the keyboard. */
  async function move(t: Task, target: string, surface: string) {
    const prev = placeOf(t);
    const from = columnOf(t, day);
    if (target.startsWith('block:')) {
      const b = d.blocks.find(x => x.id === target.slice(6));
      if (!b) return;
      await scheduleTask(t.id, day, b.id, surface);
      setFit(null);
      setToast({ text: m.tasks.board.inBlock(b.title), undo: () => void restoreTask(t.id, prev) });
      return;
    }
    const to = target.slice(4) as Column;
    if (to === from) return;
    await moveTask(t, to, day, surface);
    if (to === 'today' && from !== 'done') {
      // It was not planned for today: ask where it fits (never required).
      setFit({ id: t.id, prev });
      return;
    }
    if (fit?.id === t.id) setFit(null);
    setToast({ text: m.tasks.board.moved(m.tasks.lists[to]), undo: () => void restoreTask(t.id, prev) });
  }

  // Keyboard triage (US-TASK-007), now across columns: ←/→ change column, j/k move inside it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal')) return;
      if (e.key === 'Escape' && fit) { setFit(null); return; }
      const col = sel ? columnOf(sel, day) : null;
      const items = col ? cols[col] : [];
      const idx = items.findIndex(x => x.id === selId);
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSelId((items[Math.min(items.length - 1, idx + 1)] ?? COLUMNS.map(c => cols[c][0]).find(Boolean))?.id ?? null); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSelId(items[Math.max(0, idx - 1)]?.id ?? null); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        for (let i = COLUMNS.indexOf(col ?? 'inbox') + step; i >= 0 && i < COLUMNS.length; i += step) {
          const list = cols[COLUMNS[i]];
          if (list.length) { setSelId(list[Math.min(Math.max(idx, 0), list.length - 1)].id); return; }
        }
        return;
      }
      if (e.key === 'c') { e.preventDefault(); document.querySelector<HTMLInputElement>('.capture .qa-input')?.focus(); return; }
      if (!sel) return;
      const next = () => setSelId(items[idx + 1]?.id ?? items[idx - 1]?.id ?? null);
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && areas[n - 1]) { void updateTask(sel.id, { areaId: areas[n - 1].id }, ['area']); return; }
      if (e.key === 'h' || e.key === 'm' || e.key === 'l') { void updateTask(sel.id, { priority: e.key === 'h' ? 'high' : e.key === 'm' ? 'med' : 'low' }, ['priority']); return; }
      if (e.key === 'e') { const i = ESTIMATES.indexOf(sel.estimate ?? 0); void updateTask(sel.id, { estimate: ESTIMATES[(i + 1) % ESTIMATES.length] }, ['estimate']); return; }
      if (e.key === 't') { next(); void move(sel, 'col:today', 'keyboard'); return; }
      if (e.key === 'b') { next(); void move(sel, 'col:backlog', 'keyboard'); return; }
      if (e.key === 'i') { next(); void move(sel, 'col:inbox', 'keyboard'); return; }
      if (e.key === 'x') { next(); void toggleTaskDone(sel.id); return; }
      if (e.key === 'Enter') { setOpen(sel.id); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); next(); void deleteTask(sel.id); }
      if (e.key === 'Escape') { setSelId(null); setOpen(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!rows || !areasRaw || !d.ready) return <div className="page" />;

  const fitCard = fitTask && fit && (
    <FitToday key={fitTask.id} task={fitTask} prev={fit.prev} day={day} minute={minute} blocks={d.blocks} dayTasks={d.tasks} areaMap={areaMap} onClose={() => setFit(null)} />
  );

  return (
    <div className="page tasks-page">
      <header className="page-head">
        <div>
          <h1>{m.tasks.title}</h1>
          {!coarse && !isMobile && <div className="sub"><span>{m.tasks.triageHint}</span></div>}
        </div>
      </header>
      <div className="capture">
        <QuickAdd mode="inbox" surface="tasks" onAdded={t => { setSelId(t.id); const c = columnOf(t, day); if (c) setJump({ col: c, n: Date.now() }); }} />
      </div>
      <div className="filters">
        <input className="input search" placeholder={m.tasks.search} value={filter.q ?? ''} onChange={e => setFilter({ ...filter, q: e.target.value || undefined })} />
        <select className="input" value={filter.areaId ?? ''} onChange={e => setFilter({ ...filter, areaId: e.target.value || undefined })}>
          <option value="">{m.tasks.anyArea}</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input" value={filter.priority ?? ''} onChange={e => setFilter({ ...filter, priority: e.target.value || undefined })}>
          <option value="">{m.tasks.anyPriority}</option>{(['high', 'med', 'low'] as const).map(p => <option key={p} value={p}>{m.tasks.priorities[p]}</option>)}
        </select>
        {fac.projects.length > 0 && (
          <select className="input" value={filter.project ?? ''} onChange={e => setFilter({ ...filter, project: e.target.value || undefined })}>
            <option value="">{m.tasks.anyProject}</option>{fac.projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {fac.tags.length > 0 && (
          <select className="input" value={filter.tag ?? ''} onChange={e => setFilter({ ...filter, tag: e.target.value || undefined })}>
            <option value="">{m.tasks.anyTag}</option>{fac.tags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
        <select className="input" value={filter.due ?? ''} onChange={e => setFilter({ ...filter, due: (e.target.value || undefined) as TaskFilter['due'] })}>
          <option value="">{m.tasks.anyDue}</option>{Object.entries(m.tasks.dueFilters).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {isFiltering(filter) && <button type="button" className="btn sm ghost" onClick={() => setFilter({})}>{m.tasks.clear}</button>}
      </div>
      <TaskBoard day={day} minute={minute} cols={cols} blocks={d.blocks} dayTasks={d.tasks} areaMap={areaMap} tracked={tracked} selId={selId} coarse={coarse} jump={jump}
        todayTop={!isMobile ? fitCard : undefined}
        onSelect={setSelId} onOpen={id => { setSelId(id); setOpen(id); }}
        onToday={t => void move(t, 'col:today', 'button')} onDrop={(t, target, surface) => void move(t, target, surface)} />
      {isMobile && fitCard && <Modal onClose={() => setFit(null)} label={m.tasks.fit.added}>{fitCard}</Modal>}
      {detail && (
        <Modal onClose={() => setOpen(null)} label={detail.title}>
          <TaskDetail task={detail} areas={areasRaw} day={day} onClose={() => setOpen(null)} />
        </Modal>
      )}
      {toast && (
        <div className="toast board-toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" className="btn sm ghost" onClick={() => { toast.undo?.(); setToast(null); }}><Undo2 size={13} />{m.quick.undo}</button>}
        </div>
      )}
    </div>
  );
}
