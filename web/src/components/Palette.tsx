'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CornerDownLeft, Plus, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { runningRecord, startDay, stopActivity } from '@/lib/ops';
import { logicalDay } from '@/lib/time';
import { Modal } from './Modal';
import { QuickAdd } from './tasks/QuickAdd';

interface Cmd { id: string; label: string; run: () => void | Promise<void> }

/**
 * N and the phone “+” open capture directly (CAP-C7): one field, destination visible.
 * ⌘K opens commands, with “New to-do” first. Two jobs, two surfaces — never a guessed destination.
 */
export function Palette() {
  const [mode, setMode] = useState<'capture' | 'commands' | null>(null);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const path = usePathname();

  function show(next: 'capture' | 'commands', surface: string) {
    setQ(''); setIdx(0); setMode(next);
    track(next === 'capture' ? 'capture_opened' : 'palette_opened', { surface });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); show('commands', 'cmdk'); return; }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'n' || e.key === 'N') && !document.querySelector('.modal')) { e.preventDefault(); show('capture', 'key_n'); }
    }
    window.addEventListener('keydown', onKey);
    const onOpen = () => show('capture', 'event');
    window.addEventListener('df-capture', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('df-capture', onOpen); };
  }, []);

  const go = (href: string) => () => router.push(href);
  const day = logicalDay();
  const commands: Cmd[] = [
    { id: 'new', label: m.palette.commands.new, run: () => show('capture', 'cmdk') },
    { id: 'today', label: m.palette.commands.today, run: go('/') },
    { id: 'tasks', label: m.palette.commands.tasks, run: go('/tasks') },
    { id: 'history', label: m.palette.commands.history, run: go('/history') },
    { id: 'plan', label: m.palette.commands.plan, run: go(`/plan?d=${day}`) },
    { id: 'startDay', label: m.palette.commands.startDay, run: () => startDay(day, 'quick') },
    { id: 'stop', label: m.palette.commands.stop, run: async () => { const r = await runningRecord(); if (r) await stopActivity(r.id); } },
    { id: 'closeDay', label: m.palette.commands.closeDay, run: go(`/close?d=${day}`) },
    { id: 'insights', label: m.palette.commands.insights, run: go('/insights') },
    { id: 'notes', label: m.palette.commands.notes, run: go('/notes') },
    { id: 'settings', label: m.palette.commands.settings, run: go('/settings') },
  ];
  const text = q.trim().toLowerCase();
  const options = text ? commands.filter(c => c.label.toLowerCase().includes(text)) : commands;

  async function choose(i: number) {
    const c = options[i];
    if (!c) return;
    if (c.id !== 'new') setMode(null);
    track('command_used', { command: c.id });
    await c.run();
  }

  // On Today the to-do goes to today by default; anywhere else to the Inbox. Either way it is shown and changeable.
  const captureMode = path === '/' || path.startsWith('/plan') ? 'today' : 'inbox';

  return (
    <>
      {mode === 'capture' && (
        <Modal onClose={() => setMode(null)} label={m.quick.title}>
          <div className="head"><b>{m.quick.title}</b><button type="button" className="btn icon sm ghost" onClick={() => setMode(null)} aria-label="Close"><X size={15} /></button></div>
          <QuickAdd mode={captureMode} autoFocus expanded surface="capture" />
          <span className="hint desk-only">{m.palette.captureHint}</span>
        </Modal>
      )}
      {mode === 'commands' && (
        <Modal onClose={() => setMode(null)} label="Command palette">
          <div className="palette-input">
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
                {c.id === 'new' ? <Plus size={14} /> : <span className="pl-dot" />}{c.label}{i === idx && <CornerDownLeft size={13} className="muted pl-enter" />}
              </button></li>
            ))}
          </ul>
          <span className="hint">{m.palette.hint}</span>
        </Modal>
      )}
      {(path === '/' || path.startsWith('/tasks')) && (
        <button type="button" className="fab sheet-only" aria-label={m.quick.title} onClick={() => show('capture', 'fab')}><Plus size={22} /></button>
      )}
    </>
  );
}
