'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CornerDownLeft, Inbox, Plus } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { createTask, runningRecord, startDay, stopActivity } from '@/lib/ops';
import { logicalDay } from '@/lib/time';
import { Modal } from './Modal';

interface Cmd { id: string; label: string; run: () => void | Promise<void> }

/** ⌘K / N: capture to the Inbox in one keystroke (CAP-C7); also a small command list. + on phones. */
export function Palette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [t0, setT0] = useState(0);
  const router = useRouter();
  const path = usePathname();

  function show(surface: string) { setT0(performance.now()); setQ(''); setIdx(0); setOpen(true); track('palette_opened', { surface }); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); show('cmdk'); return; }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'n' || e.key === 'N') && !document.querySelector('.modal')) { e.preventDefault(); show('key_n'); }
    }
    window.addEventListener('keydown', onKey);
    const onOpen = () => show('event');
    window.addEventListener('df-capture', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('df-capture', onOpen); };
  }, []);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1800); return () => clearTimeout(t); }, [toast]);

  const go = (href: string) => () => router.push(href);
  const day = logicalDay();
  const commands: Cmd[] = [
    { id: 'today', label: m.palette.commands.today, run: go('/') },
    { id: 'tasks', label: m.palette.commands.tasks, run: go('/tasks') },
    { id: 'history', label: m.palette.commands.history, run: go('/history') },
    { id: 'plan', label: m.palette.commands.plan, run: go(`/plan?d=${day}`) },
    { id: 'startDay', label: m.palette.commands.startDay, run: () => startDay(day, 'quick') },
    { id: 'stop', label: m.palette.commands.stop, run: async () => { const r = await runningRecord(); if (r) await stopActivity(r.id); } },
    { id: 'closeDay', label: m.palette.commands.closeDay, run: go(`/close?d=${day}`) },
    { id: 'notes', label: m.palette.commands.notes, run: go('/notes') },
    { id: 'settings', label: m.palette.commands.settings, run: go('/settings') },
  ];
  const text = q.trim();
  const matches = text ? commands.filter(c => c.label.toLowerCase().includes(text.toLowerCase())) : [];
  const options: Cmd[] = text ? [{ id: 'create', label: m.palette.create(text), run: () => capture() }, ...matches] : commands.slice(0, 5);

  async function capture() {
    // On Today, capture goes straight to today's list; elsewhere to the Inbox.
    const toToday = path === '/' && !!(await getDB().days.get(day));
    await createTask(text, toToday ? { status: 'today', dayId: day } : {}, 'palette', t0);
    setToast(toToday ? m.tasks.addedToday : m.tasks.added);
  }

  async function choose(i: number) {
    const c = options[i];
    if (!c) return;
    setOpen(false);
    if (c.id !== 'create') track('command_used', { command: c.id });
    await c.run();
  }

  return (
    <>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Command palette">
          <div className="palette-input">
            <Inbox size={16} className="muted" />
            <input className="input" autoFocus placeholder={m.palette.placeholder} value={q}
              onChange={e => { setQ(e.target.value); setIdx(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(options.length - 1, i + 1)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
                if (e.key === 'Enter') { e.preventDefault(); void choose(idx); }
              }} />
          </div>
          <ul className="palette-list">
            {options.map((c, i) => (
              <li key={c.id}><button type="button" className={i === idx ? 'on' : ''} onMouseEnter={() => setIdx(i)} onClick={() => void choose(i)}>
                {c.id === 'create' ? <Plus size={14} /> : <span className="pl-dot" />}{c.label}{i === idx && <CornerDownLeft size={13} className="muted pl-enter" />}
              </button></li>
            ))}
          </ul>
          <span className="hint desk-only">{m.palette.hint}</span>
        </Modal>
      )}
      {(path === '/' || path.startsWith('/tasks')) && (
        <button type="button" className="fab sheet-only" aria-label={m.tasks.capture} onClick={() => show('fab')}><Plus size={22} /></button>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
