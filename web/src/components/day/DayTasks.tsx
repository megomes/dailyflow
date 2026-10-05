'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { m } from '@/i18n/en';
import { createTask, trackedByTask } from '@/lib/ops';
import type { Area, Task } from '@/lib/types';
import { TaskRow } from '../tasks/TaskRow';
import { useAllSessions, useOpenTasks } from './useDay';

/** Tasks tray on Today and in planning: today's tasks, “continue from previous days” and the backlog to drag from. */
export function DayTasks({ dayId, tasks, areaMap, showBacklog = true, title = m.tasks.title }: {
  dayId: string; tasks: Task[]; areaMap: Map<string, Area>; showBacklog?: boolean; title?: string;
}) {
  const open = useOpenTasks();
  const sessions = useAllSessions();
  const [text, setText] = useState('');
  const [more, setMore] = useState(false);
  const tracked = trackedByTask(sessions);
  const todayOpen = tasks.filter(t => t.status !== 'done');
  const todayDone = tasks.filter(t => t.status === 'done');
  const unassigned = todayOpen.filter(t => !t.blockId);
  const inBlocks = todayOpen.filter(t => t.blockId);
  const carried = open.filter(t => (t.carried?.length ?? 0) > 0);
  const rest = open.filter(t => !(t.carried?.length));
  const backlogShown = more ? rest : rest.slice(0, 6);

  return (
    <section className="card day-tasks">
      <div className="head"><span className="label">{title}{todayOpen.length ? ` · ${todayOpen.length}` : ''}</span><Link href="/tasks" className="btn sm ghost">{m.tasks.title}<ChevronRight size={13} /></Link></div>
      <form onSubmit={async e => { e.preventDefault(); if (!text.trim()) return; await createTask(text, { status: 'today', dayId }, 'today'); setText(''); }}>
        <input className="input" placeholder={m.tasks.capture} value={text} onChange={e => setText(e.target.value)} />
      </form>
      {inBlocks.length > 0 && <div className="task-list">{inBlocks.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} />)}</div>}
      {unassigned.length > 0 && (
        <>
          <span className="sublabel">{m.tasks.unassigned}</span>
          <div className="task-list">{unassigned.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} />)}</div>
        </>
      )}
      {todayDone.length > 0 && (
        <details>
          <summary className="sublabel">{m.tasks.lists.done} · {todayDone.length}</summary>
          <div className="task-list">{todayDone.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} />)}</div>
        </details>
      )}
      {showBacklog && carried.length > 0 && (
        <>
          <span className="sublabel">{m.tasks.continue}</span>
          <div className="task-list">{carried.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} />)}</div>
        </>
      )}
      {showBacklog && rest.length > 0 && (
        <>
          <span className="sublabel">{m.tasks.fromBacklog} · <span className="muted">{m.tasks.dragHint}</span></span>
          <div className="task-list">{backlogShown.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} tracked={tracked.get(t.id)} />)}</div>
          {rest.length > 6 && <button type="button" className="btn sm ghost" onClick={() => setMore(!more)}>{more ? m.day.less : m.day.more(rest.length - 6)}</button>}
        </>
      )}
    </section>
  );
}
