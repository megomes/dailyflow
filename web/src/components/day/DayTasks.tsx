'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { m } from '@/i18n/en';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB } from '@/lib/db';
import { trackedByTask } from '@/lib/ops';
import { Modal } from '../Modal';
import { QuickAdd } from '../tasks/QuickAdd';
import { TaskDetail } from '../tasks/TaskDetail';
import type { Area, Task } from '@/lib/types';
import { TaskRow } from '../tasks/TaskRow';
import { useAllSessions, useOpenTasks } from './useDay';

/** Tasks tray on Today and in planning: today's tasks, “continue from previous days” and the backlog to drag from. */
export function DayTasks({ dayId, tasks, areaMap, showBacklog = true, title = m.tasks.title }: {
  dayId: string; tasks: Task[]; areaMap: Map<string, Area>; showBacklog?: boolean; title?: string;
}) {
  const openTasks = useOpenTasks();
  const sessions = useAllSessions();
  const [open, setOpen] = useState<string | null>(null);
  const areas = useLiveQuery(() => getDB().areas.toArray(), []) ?? [];
  const [more, setMore] = useState(false);
  const tracked = trackedByTask(sessions);
  const todayOpen = tasks.filter(t => t.status !== 'done');
  const todayDone = tasks.filter(t => t.status === 'done');
  const unassigned = todayOpen.filter(t => !t.blockId);
  const inBlocks = todayOpen.filter(t => t.blockId);
  const carried = openTasks.filter(t => (t.carried?.length ?? 0) > 0);
  const rest = openTasks.filter(t => !(t.carried?.length));
  const detail = [...tasks, ...openTasks].find(t => t.id === open) ?? null;
  const backlogShown = more ? rest : rest.slice(0, 6);

  return (
    <section className="card day-tasks">
      <div className="head"><span className="label">{title}{todayOpen.length ? ` · ${todayOpen.length}` : ''}</span><Link href="/tasks" className="btn sm ghost">{m.tasks.title}<ChevronRight size={13} /></Link></div>
      <QuickAdd mode="today" dayId={dayId} surface="today" />
      {inBlocks.length > 0 && <div className="task-list">{inBlocks.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} onOpen={x => setOpen(x.id)} />)}</div>}
      {unassigned.length > 0 && (
        <>
          <span className="sublabel">{m.tasks.unassigned}</span>
          <div className="task-list">{unassigned.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} onOpen={x => setOpen(x.id)} />)}</div>
        </>
      )}
      {todayDone.length > 0 && (
        <details>
          <summary className="sublabel">{m.tasks.lists.done} · {todayDone.length}</summary>
          <div className="task-list">{todayDone.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} onOpen={x => setOpen(x.id)} />)}</div>
        </details>
      )}
      {showBacklog && carried.length > 0 && (
        <>
          <span className="sublabel">{m.tasks.continue}</span>
          <div className="task-list">{carried.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} onOpen={x => setOpen(x.id)} />)}</div>
        </>
      )}
      {showBacklog && rest.length > 0 && (
        <>
          <span className="sublabel">{m.tasks.fromBacklog} · <span className="muted">{m.tasks.dragHint}</span></span>
          <div className="task-list">{backlogShown.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} onOpen={x => setOpen(x.id)} />)}</div>
          {rest.length > 6 && <button type="button" className="btn sm ghost" onClick={() => setMore(!more)}>{more ? m.day.less : m.day.more(rest.length - 6)}</button>}
        </>
      )}
      {detail && (
        <Modal onClose={() => setOpen(null)} label={detail.title}>
          <TaskDetail task={detail} areas={areas} day={dayId} onClose={() => setOpen(null)} />
        </Modal>
      )}
    </section>
  );
}
