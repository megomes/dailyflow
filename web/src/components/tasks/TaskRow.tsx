'use client';
import type { DragEvent } from 'react';
import { CalendarClock, CornerUpLeft, GripVertical, Repeat, Timer } from 'lucide-react';
import { m } from '@/i18n/en';
import { PRESETS, scheduleTask, startFocus, toggleTaskDone, unscheduleTask } from '@/lib/ops';
import { fmtDuration } from '@/lib/time';
import type { Area, Task } from '@/lib/types';
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
}

const fmtDue = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function TaskRow({ task: t, areaMap, dayId, compact, selected, tracked, onOpen }: Props) {
  const area = t.areaId ? areaMap.get(t.areaId) : undefined;
  const done = t.status === 'done';
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !!t.due && t.due < today && !done;

  function dragStart(e: DragEvent) {
    e.dataTransfer.setData('text/df-task', t.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTask(t);
  }

  return (
    <div className={`task-row${compact ? ' compact' : ''}${selected ? ' sel' : ''}${done ? ' is-done' : ''}`} data-color={area?.color ?? 'gray'}
      draggable={!done} onDragStart={dragStart} onDragEnd={() => setDraggedTask(null)} data-task={t.id}>
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
        {area && !compact && <span className="pill" data-color={area.color}>{area.name}</span>}
        {(t.carried?.length ?? 0) > 0 && !done && <span className="pill" data-color="orange">{m.tasks.carried(t.carried!.length)}</span>}
        {t.due && <span className={`muted tabular${overdue ? ' overdue' : ''}`}>{overdue ? m.tasks.overdue : m.tasks.due(fmtDue(t.due))}</span>}
        {tracked && tracked.min > 0 ? <span className="muted tabular">{t.estimate ? m.tasks.estimateVs(fmtDuration(tracked.min), fmtDuration(t.estimate)) : fmtDuration(tracked.min)}</span>
          : t.estimate ? <span className="muted tabular">{fmtDuration(t.estimate)}</span> : null}
      </span>
      {!done && dayId && (
        <span className="task-actions">
          {t.status !== 'today' && <button type="button" className="btn icon sm ghost" title={m.tasks.toToday} aria-label={m.tasks.toToday} onClick={() => void scheduleTask(t.id, dayId, undefined, 'button')}><CalendarClock size={13} /></button>}
          {t.status === 'today' && !compact && <button type="button" className="btn icon sm ghost" title={m.tasks.toBacklog} aria-label={m.tasks.toBacklog} onClick={() => void unscheduleTask(t.id)}><CornerUpLeft size={13} /></button>}
          <button type="button" className="btn icon sm ghost" title={m.focus.start} aria-label={m.focus.start}
            onClick={() => void startFocus(dayId, { preset: PRESETS[0], taskId: t.id, blockId: t.blockId, areaId: t.areaId ?? 'area-personal', title: t.title })}><Timer size={13} /></button>
        </span>
      )}
    </div>
  );
}
