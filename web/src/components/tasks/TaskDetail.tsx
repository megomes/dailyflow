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

/**
 * One form for creating and editing a to-do (Things/Todoist detail view). Edit mode writes on
 * every change; create mode edits a draft and the caller saves it (TaskComposer).
 */
export function TaskForm({ task, areas, day, onPatch, create = false, autoFocusTitle = false }: {
  task: Task; areas: Area[]; day: string; onPatch: (patch: Partial<Task>, fields?: string[]) => void; create?: boolean; autoFocusTitle?: boolean;
}) {
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
    if (v && !(task.tags ?? []).includes(v)) onPatch({ tags: [...(task.tags ?? []), v] }, ['tags']);
    setTag('');
  }
  const blocks = useLiveQuery(async () => liveBlocks(await getDB().dayBlocks.where('dayId').equals(day).toArray()), [day]) ?? [];
  return (
    <div className="task-form">
      <label className="field"><span>{m.tasks.fields.title}</span>
        <input className="input" value={create ? task.title : title} autoFocus={autoFocusTitle}
          onChange={e => (create ? onPatch({ title: e.target.value }) : setTitle(e.target.value))}
          onBlur={() => { if (!create && title.trim() && title !== task.title) onPatch({ title: title.trim() }); }} />
      </label>
      <AreaPicker areas={areas} value={task.areaId} onPick={id => onPatch({ areaId: id }, ['area'])} />
      <div className="field"><span>{m.tasks.fields.priority}</span>
        <div className="seg">{PRIORITIES.map(p => <button key={p} type="button" aria-pressed={task.priority === p} onClick={() => onPatch({ priority: task.priority === p ? undefined : p }, ['priority'])}>{m.tasks.priorities[p]}</button>)}</div>
      </div>
      <div className="field"><span>{m.tasks.fields.estimate}</span>
        <div className="row wrap">{ESTIMATES.map(e => <button key={e} type="button" className="chip" aria-pressed={task.estimate === e} onClick={() => onPatch({ estimate: task.estimate === e ? undefined : e }, ['estimate'])}>{fmtDuration(e)}</button>)}</div>
      </div>
      <label className="field"><span>{m.tasks.fields.due}</span>
        <input className="input" type="date" value={task.due ?? ''} onChange={e => onPatch({ due: e.target.value || undefined }, ['due'])} />
      </label>
      <div className="field"><span>{m.tasks.schedule}</span>
        <div className="row wrap">
          <button type="button" className="chip" aria-pressed={task.status === 'today' && !task.blockId} onClick={() => onPatch({ status: 'today', dayId: day, blockId: undefined }, ['schedule'])}>{m.tasks.toToday}</button>
          <select className="input sel" value={task.status === 'today' && task.dayId === day ? task.blockId ?? '' : ''} onChange={e => onPatch({ status: 'today', dayId: day, blockId: e.target.value || undefined, ...(e.target.value && !task.areaId ? { areaId: blocks.find(b => b.id === e.target.value)?.areaId } : {}) }, ['schedule'])}>
            <option value="">{m.tasks.toBlock}</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{fmtMin(b.start)} {b.title}</option>)}
          </select>
          <button type="button" className="chip" aria-pressed={task.status === 'backlog' || task.status === 'inbox'} onClick={() => onPatch({ status: create ? 'inbox' : 'backlog', dayId: undefined, blockId: undefined }, ['schedule'])}>{create ? m.quick.inbox : m.tasks.toBacklog}</button>
        </div>
      </div>
      <details className="more" open={create || hasMore || undefined}>
        <summary className="sublabel">{m.tasks.more}</summary>
        <div className="more-body">
      <div className="field"><span>{m.tasks.fields.scheduleOn}</span>
        <input className="input" type="date" min={day} value={task.status === 'today' && task.dayId && task.dayId > day ? task.dayId : ''}
          onChange={e => { if (e.target.value) onPatch({ status: 'today', dayId: e.target.value, blockId: undefined }, ['schedule']); }} />
      </div>
      <div className="field"><span>{m.tasks.fields.category}</span>
        <div className="seg">{(['work', 'personal'] as const).map(c => <button key={c} type="button" aria-pressed={task.category === c} onClick={() => onPatch({ category: task.category === c ? undefined : c }, ['category'])}>{m.tasks.categories[c]}</button>)}</div>
      </div>
      <label className="field"><span>{m.tasks.fields.project}</span>
        <input className="input" list="df-projects" value={create ? task.project ?? '' : project} onChange={e => (create ? onPatch({ project: e.target.value || undefined }) : setProject(e.target.value))}
          onBlur={() => { const v = project.trim() || undefined; if (!create && v !== task.project) onPatch({ project: v }, ['project']); }} />
        <datalist id="df-projects">{fac.projects.map(p => <option key={p} value={p} />)}</datalist>
      </label>
      <div className="field"><span>{m.tasks.fields.tags}</span>
        <div className="row wrap">
          {(task.tags ?? []).map(t => <button key={t} type="button" className="chip" onClick={() => onPatch({ tags: (task.tags ?? []).filter(x => x !== t) }, ['tags'])}>#{t} <X size={11} /></button>)}
          <input className="input sel" style={{ width: 120 }} list="df-tags" placeholder="+ tag" value={tag} onChange={e => setTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }} onBlur={addTag} />
          <datalist id="df-tags">{fac.tags.map(t => <option key={t} value={t} />)}</datalist>
        </div>
      </div>
      <div className="field"><span>{m.tasks.fields.subtasks}{subs.length ? ` · ${subs.filter(x => x.done).length}/${subs.length}` : ''}</span>
        <div className="subtasks">
          {subs.map(st => (
            <div key={st.id} className="row">
              <input type="checkbox" checked={st.done} onChange={() => onPatch({ subtasks: subs.map(x => x.id === st.id ? { ...x, done: !x.done } : x) }, ['subtasks'])} />
              <span className={st.done ? 'muted strike' : ''}>{st.title}</span>
              <span className="spacer" />
              <button type="button" className="btn icon sm ghost" aria-label="Remove" onClick={() => onPatch({ subtasks: subs.filter(x => x.id !== st.id) })}><X size={12} /></button>
            </div>
          ))}
          <form onSubmit={e => { e.preventDefault(); if (!sub.trim()) return; onPatch({ subtasks: [...subs, { id: uid(), title: sub.trim(), done: false }] }, ['subtasks']); setSub(''); }}>
            <input className="input" placeholder={m.tasks.addSubtask} value={sub} onChange={e => setSub(e.target.value)} />
          </form>
        </div>
      </div>
      <label className="field"><span>{m.tasks.fields.repeat}</span>
        <select className="input" value={task.recurrence ? `${task.recurrence.freq}:${task.recurrence.interval ?? 1}` : ''}
          onChange={e => {
            const [freq, n] = e.target.value.split(':');
            onPatch({ recurrence: freq ? { freq: freq as Recurrence['freq'], interval: Number(n) || 1 } : undefined }, ['recurrence']);
            if (freq) track('recurrence_created', { rule: e.target.value });
          }}>
          <option value="">{m.tasks.noRepeat}</option>
          {REPEATS.map(([v, r]) => <option key={v} value={v}>{describe(r)}</option>)}
        </select>
      </label>
      <label className="field"><span>{m.tasks.fields.notes}</span>
        <textarea className="input" value={create ? task.notes ?? '' : notes} onChange={e => (create ? onPatch({ notes: e.target.value }) : setNotes(e.target.value))} onBlur={() => { if (!create && notes !== (task.notes ?? '')) onPatch({ notes }); }} />
      </label>
        </div>
      </details>
    </div>
  );
}

/** Edit view: the form writing straight to the task, plus tracked sessions and delete. */
export function TaskDetail({ task, areas, day, onClose }: { task: Task; areas: Area[]; day: string; onClose: () => void }) {
  const sessions = (useLiveQuery(() => getDB().focusSessions.where('taskId').equals(task.id).toArray(), [task.id]) ?? []).filter(s => !s.deleted);
  const total = sessions.reduce((s, x) => s + (x.actualMin ?? 0), 0);
  function onPatch(patch: Partial<Task>, fields?: string[]) {
    if (fields?.includes('schedule')) {
      if (patch.status === 'today' && patch.dayId) {
        if (patch.dayId === day) void scheduleTask(task.id, day, patch.blockId, 'detail');
        else void scheduleTaskOn(task.id, patch.dayId);
      } else void unscheduleTask(task.id);
      return;
    }
    void updateTask(task.id, patch, fields);
  }
  return (
    <div className="card inspector task-detail">
      <div className="head"><span className="label">{m.tasks.lists[task.status] ?? task.status}</span>
        <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <TaskForm key={task.id} task={task} areas={areas} day={day} onPatch={onPatch} />
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
