'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { getDB } from '@/lib/db';
import { deleteFocus, deleteTask, editFocusMinutes, PRIORITIES, scheduleTask, unscheduleTask, updateTask } from '@/lib/ops';
import { liveBlocks } from '@/lib/repo';
import { fmtDuration, fmtMin } from '@/lib/time';
import type { Area, Task } from '@/lib/types';
import { AreaPicker } from '../day/Inspectors';

export const ESTIMATES = [15, 30, 45, 60, 90, 120, 180];

export function TaskDetail({ task, areas, day, onClose }: { task: Task; areas: Area[]; day: string; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const blocks = useLiveQuery(async () => liveBlocks(await getDB().dayBlocks.where('dayId').equals(day).toArray()), [day]) ?? [];
  const sessions = (useLiveQuery(() => getDB().focusSessions.where('taskId').equals(task.id).toArray(), [task.id]) ?? []).filter(s => !s.deleted);
  const total = sessions.reduce((s, x) => s + (x.actualMin ?? 0), 0);
  return (
    <div className="card inspector task-detail">
      <div className="head"><span className="label">{m.tasks.lists[task.status] ?? task.status}</span>
        <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <label className="field"><span>{m.tasks.fields.title}</span>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { if (title.trim() && title !== task.title) void updateTask(task.id, { title: title.trim() }); }} />
      </label>
      <AreaPicker areas={areas} value={task.areaId} onPick={id => void updateTask(task.id, { areaId: id }, ['area'])} />
      <div className="field"><span>{m.tasks.fields.priority}</span>
        <div className="seg">{PRIORITIES.map(p => <button key={p} type="button" aria-pressed={task.priority === p} onClick={() => void updateTask(task.id, { priority: task.priority === p ? undefined : p }, ['priority'])}>{m.tasks.priorities[p]}</button>)}</div>
      </div>
      <div className="field"><span>{m.tasks.fields.estimate}</span>
        <div className="row wrap">{ESTIMATES.map(e => <button key={e} type="button" className="chip" aria-pressed={task.estimate === e} onClick={() => void updateTask(task.id, { estimate: task.estimate === e ? undefined : e }, ['estimate'])}>{fmtDuration(e)}</button>)}</div>
      </div>
      <label className="field"><span>{m.tasks.fields.due}</span>
        <input className="input" type="date" value={task.due ?? ''} onChange={e => void updateTask(task.id, { due: e.target.value || undefined }, ['due'])} />
      </label>
      <div className="field"><span>{m.tasks.schedule}</span>
        <div className="row wrap">
          <button type="button" className="chip" aria-pressed={task.status === 'today' && !task.blockId} onClick={() => void scheduleTask(task.id, day, undefined, 'detail')}>{m.tasks.toToday}</button>
          <select className="input sel" value={task.status === 'today' && task.dayId === day ? task.blockId ?? '' : ''} onChange={e => void (e.target.value ? scheduleTask(task.id, day, e.target.value, 'detail') : scheduleTask(task.id, day, undefined, 'detail'))}>
            <option value="">{m.tasks.toBlock}</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{fmtMin(b.start)} {b.title}</option>)}
          </select>
          <button type="button" className="chip" aria-pressed={task.status === 'backlog'} onClick={() => void unscheduleTask(task.id)}>{m.tasks.toBacklog}</button>
        </div>
      </div>
      <label className="field"><span>{m.tasks.fields.notes}</span>
        <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes !== (task.notes ?? '')) void updateTask(task.id, { notes }); }} />
      </label>
      {sessions.length > 0 && (
        <div className="field"><span>{m.tasks.tracked(fmtDuration(total), sessions.length)}{task.estimate ? ` · ${m.tasks.estimateVs(fmtDuration(total), fmtDuration(task.estimate))}` : ''}</span>
          <ul className="sessions">
            {sessions.map(s => (
              <li key={s.id} className="row">
                <span className="tabular">{new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date(s.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                {s.actualMin != null
                  ? <input className="input sel tabular" style={{ width: 64 }} type="number" min={0} max={600} defaultValue={s.actualMin} aria-label="Minutes"
                      onBlur={e => { const v = Math.max(0, Math.min(600, Number(e.target.value) || 0)); if (v !== s.actualMin) void editFocusMinutes(s.id, v); }} />
                  : <span className="muted">{s.state}</span>}
                <span className="muted">{s.actualMin != null ? 'min' : ''}{s.state === 'interrupted' ? ' · interrupted' : ''}</span>
                <span className="spacer" />
                {s.state !== 'running' && s.state !== 'paused' && <button type="button" className="btn icon sm ghost" aria-label="Delete session" onClick={() => void deleteFocus(s.id)}><Trash2 size={12} /></button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="row"><button type="button" className="btn sm danger" onClick={() => { void deleteTask(task.id); onClose(); }}><Trash2 size={14} />{m.tasks.delete}</button></div>
    </div>
  );
}
