'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { X } from 'lucide-react';
import { m } from '@/i18n/en';
import { getDB } from '@/lib/db';
import { createTask } from '@/lib/ops';
import type { Task } from '@/lib/types';
import { Modal } from '../Modal';
import { TaskForm } from './TaskDetail';

/**
 * Detailed capture (Linear-style): the same form as editing, on a draft. “Create more” keeps
 * area, project, tags, plan and estimate for the next one; ⌘/Ctrl+Enter creates.
 */
export function TaskComposer({ initial, day, onClose, onCreated }: { initial: Partial<Task>; day: string; onClose: () => void; onCreated?: (t: Task) => void }) {
  const areas = useLiveQuery(() => getDB().areas.toArray(), []) ?? [];
  const blank = (): Task => ({ id: 'draft', title: '', status: 'inbox', createdAt: '', sort: 0, updatedAt: '', ...initial });
  const [draft, setDraft] = useState<Task>(blank);
  const [more, setMore] = useState(false);
  const [count, setCount] = useState(0);

  async function create() {
    if (!draft.title.trim()) return;
    const skip = new Set(['id', 'createdAt', 'sort', 'updatedAt', 'title']);
    const clean = Object.fromEntries(Object.entries(draft).filter(([k, v]) => !skip.has(k) && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));
    const t = await createTask(draft.title, clean, 'composer');
    onCreated?.(t);
    if (more) {
      setCount(c => c + 1);
      setDraft(d => ({ ...d, title: '', notes: undefined, subtasks: undefined }));
      (document.querySelector('.composer-form input') as HTMLInputElement | null)?.focus();
    } else onClose();
  }

  return (
    <Modal onClose={onClose} label={m.quick.detailTitle} wide>
      <div className="head"><b>{m.quick.detailTitle}</b><button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <div className="composer-form" onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void create(); } }}>
        <TaskForm create autoFocusTitle task={draft} areas={areas} day={day} onPatch={patch => setDraft(d => ({ ...d, ...patch }))} />
      </div>
      <div className="composer-foot">
        <label className="row hint"><input type="checkbox" checked={more} onChange={e => setMore(e.target.checked)} />{m.quick.createMore}{count ? ` · ${m.quick.created(count)}` : ''}</label>
        <span className="spacer" />
        <button type="button" className="btn sm ghost" onClick={onClose}>{m.close.back}</button>
        <button type="button" className="btn sm primary" disabled={!draft.title.trim()} onClick={() => void create()}>{m.quick.create} <span className="kbd-inv">⌘↵</span></button>
      </div>
    </Modal>
  );
}
