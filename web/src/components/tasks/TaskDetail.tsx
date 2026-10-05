'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { getDB } from '@/lib/db';
import { track } from '@/lib/analytics';
import { deleteFocus, deleteTask, editFocusMinutes, PRIORITIES, scheduleTask, scheduleTaskOn, unscheduleTask, updateTask } from '@/lib/ops';
import { describe } from '@/lib/recurrence';
import { uid } from '@/lib/repo';
import { facets } from '@/lib/taskFilter';
import { liveBlocks } from '@/lib/repo';
import { fmtDuration, fmtMin } from '@/lib/time';
import type { Area, Recurrence, Task } from '@/lib/types';
import { AreaPicker } from '../day/Inspectors';

export const ESTIMATES = [15, 30, 45, 60, 90, 120, 180];
const REPEATS: [string, Recurrence][] = [
  ['daily:1', { freq: 'daily' }], ['weekdays:1', { freq: 'weekdays' }], ['weekly:1', { freq: 'weekly' }],
  ['weekly:2', { freq: 'weekly', interval: 2 }], ['monthly:1', { freq: 'monthly' }],
];

export function TaskDetail({ task, areas, day, onClose }: { task: Task; areas: Area[]; day: string; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [project, setProject] = useState(task.project ?? '');
  const [tag, setTag] = useState('');
  const [sub, setSub] = useState('');
  const subs = task.subtasks ?? [];
  const hasMore = !!(task.project || task.tags?.length || subs.length || task.recurrence || task.notes || task.category || (task.dayId && task.dayId > day));
  const all = useLiveQuery(() => getDB().tasks.toArray(), []) ?? [];
  const fac = facets(all);
  function addTag() {
    const v = tag.trim().replace(/^#/, '').toLowerCase();
    if (v && !(task.tags ?? []).includes(v)) void updateTask(task.id, { tags: [...(task.tags ?? []), v] }, ['tags']);
    setTag('');
  }
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
      <details className="more" open={hasMore || undefined}>
        <summary className="sublabel">{m.tasks.more}</summary>
        <div className="more-body">
      <div className="field"><span>{m.tasks.fields.scheduleOn}</span>
        <input className="input" type="date" min={day} value={task.status === 'today' && task.dayId && task.dayId > day ? task.dayId : ''}
          onChange={e => { if (e.target.value) void scheduleTaskOn(task.id, e.target.value); }} />
      </div>
      <div className="field"><span>{m.tasks.fields.category}</span>
        <div className="seg">{(['work', 'personal'] as const).map(c => <button key={c} type="button" aria-pressed={task.category === c} onClick={() => void updateTask(task.id, { category: task.category === c ? undefined : c }, ['category'])}>{m.tasks.categories[c]}</button>)}</div>
      </div>
      <label className="field"><span>{m.tasks.fields.project}</span>
        <input className="input" list="df-projects" value={project} onChange={e => setProject(e.target.value)}
          onBlur={() => { const v = project.trim() || undefined; if (v !== task.project) void updateTask(task.id, { project: v }, ['project']); }} />
        <datalist id="df-projects">{fac.projects.map(p => <option key={p} value={p} />)}</datalist>
      </label>
      <div className="field"><span>{m.tasks.fields.tags}</span>
        <div className="row wrap">
          {(task.tags ?? []).map(t => <button key={t} type="button" className="chip" onClick={() => void updateTask(task.id, { tags: (task.tags ?? []).filter(x => x !== t) }, ['tags'])}>#{t} <X size={11} /></button>)}
          <input className="input sel" style={{ width: 120 }} list="df-tags" placeholder="+ tag" value={tag} onChange={e => setTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag} />
          <datalist id="df-tags">{fac.tags.map(t => <option key={t} value={t} />)}</datalist>
        </div>
      </div>
      <div className="field"><span>{m.tasks.fields.subtasks}{subs.length ? ` · ${subs.filter(x => x.done).length}/${subs.length}` : ''}</span>
        <div className="subtasks">
          {subs.map(st => (
            <div key={st.id} className="row">
              <input type="checkbox" checked={st.done} onChange={() => void updateTask(task.id, { subtasks: subs.map(x => x.id === st.id ? { ...x, done: !x.done } : x) }, ['subtasks'])} />
              <span className={st.done ? 'muted strike' : ''}>{st.title}</span>
              <span className="spacer" />
              <button type="button" className="btn icon sm ghost" aria-label="Remove" onClick={() => void updateTask(task.id, { subtasks: subs.filter(x => x.id !== st.id) })}><X size={12} /></button>
            </div>
          ))}
          <form onSubmit={e => { e.preventDefault(); if (!sub.trim()) return; void updateTask(task.id, { subtasks: [...subs, { id: uid(), title: sub.trim(), done: false }] }, ['subtasks']); setSub(''); }}>
            <input className="input" placeholder={m.tasks.addSubtask} value={sub} onChange={e => setSub(e.target.value)} />
          </form>
        </div>
      </div>
      <label className="field"><span>{m.tasks.fields.repeat}</span>
        <select className="input" value={task.recurrence ? `${task.recurrence.freq}:${task.recurrence.interval ?? 1}` : ''}
          onChange={e => {
            const [freq, n] = e.target.value.split(':');
            void updateTask(task.id, { recurrence: freq ? { freq: freq as Recurrence['freq'], interval: Number(n) || 1 } : undefined }, ['recurrence']);
            if (freq) track('recurrence_created', { rule: e.target.value });
          }}>
          <option value="">{m.tasks.noRepeat}</option>
          {REPEATS.map(([v, r]) => <option key={v} value={v}>{describe(r)}</option>)}
        </select>
      </label>
      <label className="field"><span>{m.tasks.fields.notes}</span>
        <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes !== (task.notes ?? '')) void updateTask(task.id, { notes }); }} />
      </label>
        </div>
      </details>
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
