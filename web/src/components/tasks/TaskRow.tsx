'use client';
import type { DragEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { AlarmClock, CalendarClock, CornerUpLeft, GripVertical, Repeat, Timer } from 'lucide-react';
import { deferDate } from '@/lib/taskBoard';
import { logicalDay } from '@/lib/time';
import { m } from '@/i18n/en';
import { deferTask, PRESETS, scheduleTask, startFocus, toggleTaskDone, unscheduleTask } from '@/lib/ops';
import { fmtDuration } from '@/lib/time';
import type { Area, Task } from '@/lib/types';
import { contextForMenu, pressForMenu } from '../ContextMenu';
import { taskMenu } from '../menus';
import { setDraggedTask } from './dragState';

interface Props {
  task: Task;
  areaMap: Map<string, Area>;
  /** Day the row is shown in (Today / planning); enables focus and “today” actions. */
  dayId?: string;
  compact?: boolean;
  selected?: boolean;
  tracked?: { min: number; count: number };
  onOpen?: (t: Task) => void;
  /** Replaces the plain “Today” action (Tasks board: asks where it fits). */
  onToday?: (t: Task) => void;
  /** HTML5 drag; off on touch screens, where the board uses long-press instead. */
  nativeDrag?: boolean;
  /** Right-click / press-and-hold menu (note #22). Off when a parent opens it (the board). */
  menu?: boolean;
}

const fmtDue = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function TaskRow({ task: t, areaMap, dayId, compact, selected, tracked, onOpen, onToday, nativeDrag = true, menu = true }: Props) {
  const area = t.areaId ? areaMap.get(t.areaId) : undefined;
  const done = t.status === 'done';
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !!t.due && t.due < today && !done;
  const [later, setLater] = useState(false);
  const laterRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!later) return;
    const close = (e: PointerEvent) => { if (!laterRef.current?.contains(e.target as Node)) setLater(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [later]);
  const canDefer = !done && (t.status === 'inbox' || t.status === 'backlog');
  const snoozed = !!t.deferUntil && t.deferUntil > (dayId ?? logicalDay());
  function defer(when: 'tomorrow' | 'week' | 'month' | null) {
    setLater(false);
    void deferTask(t.id, when ? deferDate(when, dayId ?? logicalDay()) : null, 'row');
  }

  function dragStart(e: DragEvent) {
    e.dataTransfer.setData('text/df-task', t.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTask(t);
  }

  return (
    <div className={`task-row${compact ? ' compact' : ''}${selected ? ' sel' : ''}${done ? ' is-done' : ''}`} data-color={area?.color ?? 'gray'}
      draggable={!done && nativeDrag} onDragStart={dragStart} onDragEnd={() => setDraggedTask(null)} data-task={t.id}
      {...(menu ? { onContextMenu: e => contextForMenu(e, () => taskMenu(t, { dayId, onOpen })), onPointerDown: e => pressForMenu(e, () => taskMenu(t, { dayId, onOpen })) } : {})}>
      {!compact && <GripVertical size={13} className="grip" aria-hidden />}
      <input type="checkbox" checked={done} onChange={() => void toggleTaskDone(t.id)} aria-label={t.title} />
      <button type="button" className="task-title" onClick={() => onOpen?.(t)} disabled={!onOpen}>
        {t.priority === 'high' && <span className="prio" title={m.tasks.priorities.high}>!</span>}
        <span>{t.title}</span>
      </button>
      <span className="task-meta">
        {t.subtasks?.length ? <span className="muted tabular">{t.subtasks.filter(x => x.done).length}/{t.subtasks.length}</span> : null}
        {t.recurrence && <Repeat size={12} className="muted" aria-label="Repeats" />}
        {t.project && !compact && <span className="pill" data-color="gray">{t.project}</span>}
        {!compact && t.tags?.slice(0, 2).map(x => <span key={x} className="muted">#{x}</span>)}
        {t.status === 'today' && t.dayId && dayId && t.dayId > dayId && <span className="pill" data-color="blue">{m.tasks.onDay(fmtDue(t.dayId))}</span>}
        {snoozed && <span className="pill" data-color="purple" title={m.tasks.later.snoozedTitle}>{m.tasks.later.until(fmtDue(t.deferUntil!))}</span>}
        {area && !compact && <span className="pill" data-color={area.color}>{area.name}</span>}
        {t.addedLate && t.status === 'today' && dayId && t.dayId === dayId && (
          <span className="pill" data-color="yellow" title={m.tasks.board.addedLateTitle}>{m.tasks.board.addedLate(new Date(t.addedLate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))}</span>
        )}
        {(t.carried?.length ?? 0) > 0 && !done && <span className="pill" data-color="orange">{m.tasks.carried(t.carried!.length)}</span>}
        {t.due && <span className={`muted tabular${overdue ? ' overdue' : ''}`}>{overdue ? m.tasks.overdue : m.tasks.due(fmtDue(t.due))}</span>}
        {tracked && tracked.min > 0 ? <span className="muted tabular">{t.estimate ? m.tasks.estimateVs(fmtDuration(tracked.min), fmtDuration(t.estimate)) : fmtDuration(tracked.min)}</span>
          : t.estimate ? <span className="muted tabular">{fmtDuration(t.estimate)}</span> : null}
      </span>
      {!done && dayId && (
        <span className="task-actions">
          {t.status !== 'today' && <button type="button" className="btn icon sm ghost" title={m.tasks.toToday} aria-label={m.tasks.toToday} onClick={() => (onToday ? onToday(t) : void scheduleTask(t.id, dayId, undefined, 'button'))}><CalendarClock size={13} /></button>}
          {canDefer && (
            <span className="later-wrap" ref={laterRef}>
              <button type="button" className="btn icon sm ghost" title={m.tasks.later.title} aria-label={m.tasks.later.title} aria-expanded={later} onClick={() => setLater(!later)}><AlarmClock size={13} /></button>
              {later && (
                <span className="later-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => defer('tomorrow')}>{m.tasks.later.tomorrow}</button>
                  <button type="button" role="menuitem" onClick={() => defer('week')}>{m.tasks.later.week}</button>
                  <button type="button" role="menuitem" onClick={() => defer('month')}>{m.tasks.later.month}</button>
                  {snoozed && <button type="button" role="menuitem" onClick={() => defer(null)}>{m.tasks.later.now}</button>}
                </span>
              )}
            </span>
          )}
          {t.status === 'today' && !compact && <button type="button" className="btn icon sm ghost" title={m.tasks.toBacklog} aria-label={m.tasks.toBacklog} onClick={() => void unscheduleTask(t.id)}><CornerUpLeft size={13} /></button>}
          <button type="button" className="btn icon sm ghost" title={m.focus.start} aria-label={m.focus.start}
            onClick={() => void startFocus(dayId, { preset: PRESETS[0], taskId: t.id, blockId: t.blockId, areaId: t.areaId ?? 'area-personal', title: t.title })}><Timer size={13} /></button>
        </span>
      )}
    </div>
  );
}
