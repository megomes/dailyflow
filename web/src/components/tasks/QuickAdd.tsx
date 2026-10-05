'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock, Flag, Inbox, Plus, Undo2 } from 'lucide-react';
import { m } from '@/i18n/en';
import { getDB } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { AreaIcon } from '@/lib/icons';
import { createTask, deleteTask } from '@/lib/ops';
import { parseQuick } from '@/lib/quickParse';
import { activeAreas, liveBlocks } from '@/lib/repo';
import { addDays, fmtDuration, fmtMin } from '@/lib/time';
import type { Task } from '@/lib/types';

/**
 * The one way to add a to-do, used everywhere (Today, block inspector, Tasks, ⌘K / N, phone +).
 * Where it goes is always visible and one tap to change: Today (optionally into a block) or Inbox.
 * Optional typed tokens (30m, !, #area, tomorrow) show up as chips while typing.
 */
interface Props {
  /** Default destination. 'block' pins the block (inspector) and hides the destination chips. */
  mode: 'today' | 'inbox' | 'block';
  /** Day the to-do is planned on when it goes to Today (defaults to the current logical day). */
  dayId?: string;
  blockId?: string;
  autoFocus?: boolean;
  /** Always show the destination chips (sheet / palette), not only while focused. */
  expanded?: boolean;
  surface: string;
  onAdded?: (t: Task) => void;
  placeholder?: string;
}

export function QuickAdd({ mode, dayId: dayProp, blockId: pinned, autoFocus, expanded, surface, onAdded, placeholder }: Props) {
  const { day: today, minute } = useClock();
  const dayId = dayProp ?? today;
  const [text, setText] = useState('');
  const [dest, setDest] = useState<'today' | 'inbox'>(mode === 'inbox' ? 'inbox' : 'today');
  const [blockId, setBlockId] = useState<string | null>(pinned ?? null);
  const [focused, setFocused] = useState(false);
  const [added, setAdded] = useState<{ task: Task; where: string } | null>(null);
  const t0 = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const areasRaw = useLiveQuery(() => getDB().areas.toArray(), []);
  const areas = useMemo(() => activeAreas(areasRaw ?? []), [areasRaw]);
  const rows = useLiveQuery(() => getDB().dayBlocks.where('dayId').equals(dayId).toArray(), [dayId]);
  const blocks = useMemo(() => liveBlocks(rows ?? []).filter(b => dayId !== today || b.end > minute), [rows, dayId, today, minute]);
  const parsed = parseQuick(text, areas);
  const block = blocks.find(b => b.id === blockId) ?? (pinned ? liveBlocks(rows ?? []).find(b => b.id === pinned) : undefined);
  const nowBlock = dayId === today ? blocks.find(b => b.start <= minute && minute < b.end) : undefined;
  const nextBlock = blocks.find(b => b.id !== nowBlock?.id && (dayId !== today || b.start > minute));
  const others = blocks.filter(b => b.id !== nowBlock?.id && b.id !== nextBlock?.id);
  const area = parsed.areaId ? areas.find(a => a.id === parsed.areaId) : undefined;

  useEffect(() => { if (!added) return; const t = setTimeout(() => setAdded(null), 6000); return () => clearTimeout(t); }, [added]);

  const targetDay = parsed.when === 'tomorrow' ? addDays(today, 1) : dayId;
  const goesToday = mode === 'block' || dest === 'today' || !!parsed.when;
  const effectiveBlock = goesToday && targetDay === dayId ? block : undefined;

  function whereLabel(): string {
    if (!goesToday) return m.quick.inbox;
    const dayLabel = targetDay === today ? m.quick.today : targetDay === addDays(today, 1) ? m.quick.tomorrow : targetDay;
    return effectiveBlock ? `${dayLabel} · ${effectiveBlock.title} ${fmtMin(effectiveBlock.start)}` : dayLabel;
  }

  async function submit() {
    if (!parsed.title) return;
    const where = whereLabel();
    const task = await createTask(parsed.title, {
      status: goesToday ? 'today' : 'inbox',
      ...(goesToday ? { dayId: targetDay } : {}),
      ...(effectiveBlock ? { blockId: effectiveBlock.id } : {}),
      ...(parsed.areaId ? { areaId: parsed.areaId } : effectiveBlock ? { areaId: effectiveBlock.areaId } : {}),
      ...(parsed.estimate ? { estimate: parsed.estimate } : {}),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
    }, surface, t0.current ?? undefined);
    t0.current = null;
    setText('');
    setAdded({ task, where });
    onAdded?.(task);
    input.current?.focus();
  }

  const showChips = expanded || focused || !!text;
  return (
    <div className={`quick-add${showChips ? ' open' : ''}`}>
      <form className="qa-row" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <Plus size={16} className="qa-plus" aria-hidden />
        <input ref={input} className="input qa-input" value={text} autoFocus={autoFocus}
          placeholder={placeholder ?? m.quick.placeholder}
          aria-label={m.quick.placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={e => { if (e.key === 'Escape') { setText(''); (e.target as HTMLInputElement).blur(); } }}
          onChange={e => { if (t0.current == null) t0.current = performance.now(); setText(e.target.value); }} />
        <button type="submit" className={`btn sm${parsed.title ? ' primary' : ''}`} disabled={!parsed.title}>{m.quick.add}</button>
      </form>
      {added && (
        <div className="qa-added" role="status">
          <span>{m.quick.added(added.where)}</span>
          <button type="button" className="btn sm ghost" onClick={() => { void deleteTask(added.task.id); setAdded(null); }}><Undo2 size={13} />{m.quick.undo}</button>
        </div>
      )}

      {showChips && (
        <div className="qa-chips" onMouseDown={e => e.preventDefault()}>
          {mode !== 'block' && (
            <div className="seg qa-dest" role="group" aria-label={m.quick.where}>
              <button type="button" aria-pressed={dest === 'today'} onClick={() => setDest('today')}><CalendarDays size={13} />{dayId === today ? m.quick.today : m.quick.thatDay}</button>
              <button type="button" aria-pressed={dest === 'inbox'} onClick={() => setDest('inbox')}><Inbox size={13} />{m.quick.inbox}</button>
            </div>
          )}
          {mode !== 'block' && dest === 'today' && blocks.length > 0 && (
            <div className="qa-blocks" role="group" aria-label={m.quick.block}>
              <button type="button" className="chip" aria-pressed={!blockId} onClick={() => setBlockId(null)}>{m.quick.noBlock}</button>
              {nowBlock && <button type="button" className="chip" aria-pressed={blockId === nowBlock.id} onClick={() => setBlockId(nowBlock.id)} data-color={areas.find(a => a.id === nowBlock.areaId)?.color ?? 'gray'}><span className="dot" />{m.quick.now}: {nowBlock.title}</button>}
              {nextBlock && <button type="button" className="chip" aria-pressed={blockId === nextBlock.id} onClick={() => setBlockId(nextBlock.id)} data-color={areas.find(a => a.id === nextBlock.areaId)?.color ?? 'gray'}><span className="dot" />{m.quick.next}: {nextBlock.title} <span className="tabular muted">{fmtMin(nextBlock.start)}</span></button>}
              {others.length > 0 && (
                <select className={`input sel qa-other${others.some(b => b.id === blockId) ? ' on' : ''}`} value={others.some(b => b.id === blockId) ? blockId! : ''} onChange={e => setBlockId(e.target.value || null)} aria-label={m.quick.otherBlock}>
                  <option value="">{m.quick.otherBlock}</option>
                  {others.map(b => <option key={b.id} value={b.id}>{fmtMin(b.start)} {b.title}</option>)}
                </select>
              )}
            </div>
          )}
          {(parsed.estimate || parsed.priority || area || parsed.when) ? (
            <div className="qa-parsed">
              {parsed.estimate && <span className="chip static"><Clock size={12} />{fmtDuration(parsed.estimate)}</span>}
              {parsed.priority && <span className="chip static"><Flag size={12} />{m.tasks.priorities.high}</span>}
              {area && <span className="chip static" data-color={area.color}><span className="dot" /><AreaIcon name={area.icon} size={12} />{area.name}</span>}
              {parsed.when && <span className="chip static"><CalendarDays size={12} />{parsed.when === 'today' ? m.quick.today : m.quick.tomorrow}</span>}
            </div>
          ) : <span className="hint qa-hint">{m.quick.syntax}</span>}
        </div>
      )}

    </div>
  );
}
