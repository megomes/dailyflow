'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import { prioRank, useAllSessions } from '@/components/day/useDay';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { TaskRow } from '@/components/tasks/TaskRow';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { useClock, useIsMobile } from '@/lib/hooks';
import { createTask, deleteTask, scheduleTask, toggleTaskDone, trackedByTask, unscheduleTask, updateTask } from '@/lib/ops';
import { activeAreas } from '@/lib/repo';
import { ESTIMATES } from '@/components/tasks/TaskDetail';

type List = 'inbox' | 'backlog' | 'today' | 'done';

export default function TasksPage() {
  const { day } = useClock();
  const isMobile = useIsMobile();
  const rows = useLiveQuery(() => getDB().tasks.toArray(), []);
  const areasRaw = useLiveQuery(() => getDB().areas.toArray(), []);
  const sessions = useAllSessions();
  const [list, setList] = useState<List>('inbox');
  const [selId, setSelId] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const t0 = useRef<number | null>(null);
  const captureRef = useRef<HTMLInputElement>(null);

  const areas = useMemo(() => activeAreas(areasRaw ?? []), [areasRaw]);
  const areaMap = useMemo(() => new Map((areasRaw ?? []).map(a => [a.id, a])), [areasRaw]);
  const tracked = useMemo(() => trackedByTask(sessions), [sessions]);
  const all = useMemo(() => (rows ?? []).filter(t => !t.deleted), [rows]);
  const lists = useMemo(() => ({
    inbox: all.filter(t => t.status === 'inbox').sort((a, b) => b.sort - a.sort),
    backlog: all.filter(t => t.status === 'backlog').sort((a, b) => prioRank(a) - prioRank(b) || (a.due ?? '9').localeCompare(b.due ?? '9') || a.sort - b.sort),
    today: all.filter(t => t.status === 'today' && t.dayId === day).sort((a, b) => a.sort - b.sort),
    done: all.filter(t => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 100),
  }), [all, day]);
  // Tasks scheduled on an earlier day that was never closed still show under Today.
  const staleToday = all.filter(t => t.status === 'today' && t.dayId !== day);
  const items = list === 'today' ? [...lists.today, ...staleToday] : lists[list];
  const sel = items.find(t => t.id === selId) ?? null;
  const detail = all.find(t => t.id === open) ?? null;

  useEffect(() => { track('tasks_opened', { inbox: lists.inbox.length, backlog: lists.backlog.length }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard triage (US-TASK-007).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal')) return;
      const idx = items.findIndex(x => x.id === selId);
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSelId(items[Math.min(items.length - 1, idx + 1)]?.id ?? null); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSelId(items[Math.max(0, idx - 1)]?.id ?? null); return; }
      if (e.key === 'c') { e.preventDefault(); captureRef.current?.focus(); return; }
      if (!sel) return;
      const next = () => setSelId(items[idx + 1]?.id ?? items[idx - 1]?.id ?? null);
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && areas[n - 1]) { void updateTask(sel.id, { areaId: areas[n - 1].id }, ['area']); return; }
      if (e.key === 'h' || e.key === 'm' || e.key === 'l') { void updateTask(sel.id, { priority: e.key === 'h' ? 'high' : e.key === 'm' ? 'med' : 'low' }, ['priority']); return; }
      if (e.key === 'e') { const i = ESTIMATES.indexOf(sel.estimate ?? 0); void updateTask(sel.id, { estimate: ESTIMATES[(i + 1) % ESTIMATES.length] }, ['estimate']); return; }
      if (e.key === 't') { next(); void scheduleTask(sel.id, day, undefined, 'keyboard'); return; }
      if (e.key === 'b') { next(); void (sel.status === 'today' ? unscheduleTask(sel.id) : updateTask(sel.id, { status: 'backlog' }, ['status'])); return; }
      if (e.key === 'x') { next(); void toggleTaskDone(sel.id); return; }
      if (e.key === 'Enter') { setOpen(sel.id); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); next(); void deleteTask(sel.id); }
      if (e.key === 'Escape') { setSelId(null); setOpen(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!rows || !areasRaw) return <div className="page" />;

  return (
    <div className="page tasks-page">
      <header className="page-head">
        <div>
          <h1>{m.tasks.title}</h1>
          <div className="sub"><span>{m.tasks.triageHint}</span></div>
        </div>
      </header>
      <form className="capture" onSubmit={async e => {
        e.preventDefault();
        if (!text.trim()) return;
        await createTask(text, {}, 'tasks', t0.current ?? undefined);
        setText(''); t0.current = null;
        if (list !== 'inbox') setList('inbox');
      }}>
        <Inbox size={16} className="muted" />
        <input ref={captureRef} className="input" placeholder={m.tasks.capturePlaceholder} value={text}
          onChange={e => { if (t0.current == null) t0.current = performance.now(); setText(e.target.value); }} />
      </form>
      <div className="seg" role="tablist">
        {(['inbox', 'backlog', 'today', 'done'] as List[]).map(l => (
          <button key={l} type="button" aria-pressed={list === l} onClick={() => { setList(l); setSelId(null); }}>
            {m.tasks.lists[l]}{l !== 'done' && (l === 'today' ? lists.today.length + staleToday.length : lists[l].length) ? ` · ${l === 'today' ? lists.today.length + staleToday.length : lists[l].length}` : ''}
          </button>
        ))}
      </div>
      <div className={`tasks-layout${detail && !isMobile ? ' with-detail' : ''}`}>
        <div className="card task-list big">
          {items.length === 0 ? <p className="secondary" style={{ margin: 8 }}>{m.tasks.empty[list]}</p> :
            items.map(t => (
              <div key={t.id} onClick={() => setSelId(t.id)} role="presentation">
                <TaskRow task={t} areaMap={areaMap} dayId={day} selected={t.id === selId} tracked={tracked.get(t.id)} onOpen={x => { setSelId(x.id); setOpen(x.id); }} />
              </div>
            ))}
        </div>
        {detail && !isMobile && <TaskDetail task={detail} areas={areasRaw} day={day} onClose={() => setOpen(null)} />}
      </div>
      {detail && isMobile && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(null)} />
          <div className="sheet"><TaskDetail task={detail} areas={areasRaw} day={day} onClose={() => setOpen(null)} /></div>
        </>
      )}
    </div>
  );
}
