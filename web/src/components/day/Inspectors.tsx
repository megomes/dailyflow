'use client';
import { useState } from 'react';
import { Lock, Play, Square, Timer, Trash2, Unlock, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { capacity } from '@/lib/actual';
import { MIN_BLOCK_MIN } from '@/lib/config';
import { AreaIcon } from '@/lib/icons';
import { createTask, deleteRecord, PRESETS, startActivity, startFocus, stopActivity, updateRecord } from '@/lib/ops';
import { fmtDuration, fmtMin, parseHHMM } from '@/lib/time';
import type { Area, DayBlock, Revision, Task, TimeRecord } from '@/lib/types';
import { TaskRow } from '../tasks/TaskRow';

export interface TimesProps { start: number; end: number; onCommit: (start: number, end: number) => void; endEditable?: boolean }

/** Start/end fields that commit on blur; ends before the start roll past midnight. */
export function TimeFields({ start, end, onCommit, endEditable = true }: TimesProps) {
  const [s, setS] = useState(fmtMin(start));
  const [e, setE] = useState(fmtMin(end));
  const [prev, setPrev] = useState([start, end]);
  if (prev[0] !== start || prev[1] !== end) { setPrev([start, end]); setS(fmtMin(start)); setE(fmtMin(end)); }
  function commit(sv = s, ev = e) {
    let a = parseHHMM(sv), b = parseHHMM(ev);
    if (a == null || b == null) { setS(fmtMin(start)); setE(fmtMin(end)); return; }
    if (start >= 1440) a += 1440;
    // Only the start changed: keep the length (moving, not stretching).
    if (ev === fmtMin(end) && sv !== fmtMin(start)) b = a + (end - start);
    while (b <= a) b += 1440;
    if (b - a > 20 * 60) { setS(fmtMin(start)); setE(fmtMin(end)); return; }
    if (b - a < MIN_BLOCK_MIN && endEditable) b = a + MIN_BLOCK_MIN;
    if (a !== start || (endEditable && b !== end)) onCommit(a, endEditable ? b : end);
  }
  return (
    <div className="times">
      <label className="field"><span>{m.inspector.start}</span>
        <input className="input tabular" type="time" step={300} value={s} onChange={ev => setS(ev.target.value)} onBlur={() => commit()} />
      </label>
      <label className="field"><span>{m.inspector.end}</span>
        <input className="input tabular" type="time" step={300} value={e} disabled={!endEditable} onChange={ev => setE(ev.target.value)} onBlur={() => commit()} />
      </label>
    </div>
  );
}

function NameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setV(value); }
  return (
    <label className="field"><span>{m.inspector.name}</span>
      <input className="input" value={v} onChange={e => setV(e.target.value)}
        onBlur={() => { const t = v.trim(); if (t && t !== value) onCommit(t); else setV(value); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value); (e.target as HTMLInputElement).blur(); } }} />
    </label>
  );
}

export function AreaPicker({ areas, value, onPick }: { areas: Area[]; value?: string; onPick: (id: string) => void }) {
  const pickable = areas.filter(a => !a.deleted && (!a.archived || a.id === value)).sort((a, b) => a.sort - b.sort);
  return (
    <div className="field"><span>{m.inspector.area}</span>
      <div className="areas-pick">
        {pickable.map(a => (
          <button key={a.id} type="button" className="chip" data-color={a.color} aria-pressed={a.id === value} onClick={() => { if (a.id !== value) onPick(a.id); }}>
            <span className="dot" /><AreaIcon name={a.icon} size={12} />{a.name}
          </button>
        ))}
      </div>
    </div>
  );
}

interface BlockProps {
  dayId: string;
  block: DayBlock;
  areas: Area[];
  areaMap: Map<string, Area>;
  tasks: Task[];
  revisions: Revision[];
  live: boolean;
  started: boolean;
  running?: TimeRecord;
  onClose: () => void;
  onPatch: (patch: Partial<DayBlock>, kind: Revision['kind']) => void;
  onDelete: () => void;
}

export function BlockInspector({ dayId, block, areas, areaMap, tasks, revisions, live, started, running, onClose, onPatch, onDelete }: BlockProps) {
  const [newTask, setNewTask] = useState('');
  const mine = tasks.filter(t => t.blockId === block.id);
  const cap = capacity(block, tasks);
  const revs = revisions.filter(r => r.blockId === block.id);
  const isRunning = running?.blockId === block.id;
  return (
    <div className="card inspector">
      <div className="head"><span className="label">{m.inspector.title}</span>
        <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label={m.inspector.close}><X size={15} /></button>
      </div>
      <NameField value={block.title} onCommit={t => onPatch({ title: t }, 'rename')} />
      <TimeFields start={block.start} end={block.end} onCommit={(s, e) => onPatch({ start: s, end: e }, s !== block.start && e - s === block.end - block.start ? 'move' : 'resize')} />
      <div className="row wrap">
        <span className="hint tabular">{fmtDuration(block.end - block.start)}</span>
        <span className="spacer" />
        <button type="button" className="btn sm ghost" aria-pressed={!!block.fixed} onClick={() => onPatch({ fixed: !block.fixed }, 'fixed')}
          title={block.fixed ? 'Fixed: keeps its time when replanning' : 'Flexible: can move when replanning'}>
          {block.fixed ? <Lock size={13} /> : <Unlock size={13} />}{block.fixed ? 'Fixed' : 'Flexible'}
        </button>
      </div>
      {live && (
        <div className="row wrap">
          {isRunning
            ? <button type="button" className="btn sm" onClick={() => running && void stopActivity(running.id)}><Square size={13} />{m.activity.stop}</button>
            : <button type="button" className="btn sm primary" onClick={() => void startActivity(dayId, { areaId: block.areaId, title: block.title, blockId: block.id, source: 'live' })}><Play size={13} />{m.activity.start}</button>}
          <button type="button" className="btn sm" onClick={() => void startFocus(dayId, { preset: PRESETS[0], blockId: block.id, areaId: block.areaId, title: block.title })}><Timer size={13} />{m.activity.focus}</button>
        </div>
      )}
      <AreaPicker areas={areas} value={block.areaId} onPick={id => onPatch({ areaId: id }, 'area')} />
      <div className="field">
        <span>{m.tasks.title}{cap.estimated > 0 && <em className={`cap${cap.over ? ' over' : ''}`}> · {m.tasks.capacity(fmtDuration(cap.estimated), fmtDuration(cap.available))}</em>}</span>
        <div className="task-list compact">
          {mine.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} compact />)}
        </div>
        <form onSubmit={async e => {
          e.preventDefault();
          if (!newTask.trim()) return;
          await createTask(newTask, { status: 'today', dayId, blockId: block.id, areaId: block.areaId }, 'block');
          setNewTask('');
        }}>
          <input className="input" placeholder={m.tasks.addToBlock} value={newTask} onChange={e => setNewTask(e.target.value)} />
        </form>
      </div>
      {started && revs.length > 0 && (
        <details className="revs">
          <summary className="hint">{m.day.revs(revs.length)}</summary>
          <ol>{revs.map(r => <li key={r.id} className="hint">{fmtMin(r.before?.start ?? r.after?.start ?? 0)} · {m.day.revKinds[r.kind]} {r.before && r.after && r.kind !== 'rename' ? `${fmtMin(r.before.start)}–${fmtMin(r.before.end)} → ${fmtMin(r.after.start)}–${fmtMin(r.after.end)}` : ''}{r.reason ? ` · ${r.reason}` : ''}</li>)}</ol>
        </details>
      )}
      <p className="hint">{started ? m.day.startHint : m.today.onlyToday}</p>
      <div className="row"><button type="button" className="btn sm danger" onClick={onDelete}><Trash2 size={14} />{m.inspector.delete}</button></div>
    </div>
  );
}

export function RecordInspector({ record, areas, closed, onClose }: { record: TimeRecord; areas: Area[]; closed: boolean; onClose: () => void }) {
  const runningNow = record.end == null;
  return (
    <div className="card inspector">
      <div className="head"><span className="label">{m.record.title} · {m.record.sources[record.source] ?? record.source}</span>
        <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label={m.inspector.close}><X size={15} /></button>
      </div>
      <NameField value={record.title} onCommit={t => void updateRecord(record.id, { title: t }, 'title')} />
      <TimeFields start={record.start} end={record.end ?? record.start + 1} endEditable={!runningNow}
        onCommit={(s, e) => void updateRecord(record.id, runningNow ? { start: s } : { start: s, end: e }, 'time')} />
      <span className="hint tabular">{runningNow ? m.record.running : fmtDuration((record.end ?? 0) - record.start)}{record.editedAfterClose || closed ? ` · ${m.day.edited}` : ''}</span>
      {runningNow && <div className="row"><button type="button" className="btn sm" onClick={() => void stopActivity(record.id)}><Square size={13} />{m.activity.stop}</button></div>}
      <AreaPicker areas={areas} value={record.areaId} onPick={id => void updateRecord(record.id, { areaId: id }, 'area')} />
      <div className="row"><button type="button" className="btn sm danger" onClick={() => { void deleteRecord(record.id); onClose(); }}><Trash2 size={14} />{m.record.delete}</button></div>
    </div>
  );
}
