'use client';
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, CircleCheck, Inbox, Layers } from 'lucide-react';
import { m } from '@/i18n/en';
import { capacity } from '@/lib/actual';
import { columnOf, COLUMNS, type Column } from '@/lib/taskBoard';
import { fmtDuration, fmtMin } from '@/lib/time';
import type { Area, DayBlock, Task } from '@/lib/types';
import { useDraggedTask } from './dragState';
import { TaskRow } from './TaskRow';

export const COL_ICON: Record<Column, typeof Inbox> = { inbox: Inbox, backlog: Layers, today: CalendarClock, done: CircleCheck };
const DONE_SHOWN = 25;
const LONG_PRESS_MS = 380;
const isTaskDrag = (e: DragEvent) => e.dataTransfer.types.includes('text/df-task');

interface Props {
  day: string;
  minute: number;
  cols: Record<Column, Task[]>;
  /** Snoozed (“Later”) tasks: out of the columns until their day, listed collapsed under the Backlog. */
  snoozed?: Task[];
  /** Today's blocks (time order) and to-dos, for grouping the Today column and the drop zones. */
  blocks: DayBlock[];
  dayTasks: Task[];
  areaMap: Map<string, Area>;
  tracked: Map<string, { min: number; count: number }>;
  selId: string | null;
  coarse: boolean;
  /** Column to bring into view on phones (changes `n` to repeat). */
  jump: { col: Column; n: number } | null;
  /** Shown at the top of the Today column (desktop “where does it fit?”). */
  todayTop?: ReactNode;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onToday: (t: Task) => void;
  /** target = `col:<column>` or `block:<id>`. */
  onDrop: (t: Task, target: string, surface: string) => void;
}

/**
 * Tasks as a board: Inbox → Backlog → Today → Done, all visible at once.
 * Desktop: columns side by side, HTML5 drag between them; dragging over Today opens its blocks as drop zones.
 * Phone: the same columns as a horizontal pager (next column peeks), long-press lifts a card and a dock with
 * the columns appears at the bottom; holding over Today opens the day's blocks.
 */
export function TaskBoard(p: Props) {
  const { day, minute, cols, blocks, dayTasks, areaMap, tracked, selId, coarse } = p;
  const dragged = useDraggedTask();
  const [over, setOver] = useState<string | null>(null);
  // Phones: long-press a card → a “Move to…” sheet (no dragging, so scrolling stays fully native).
  const [sheet, setSheet] = useState<{ task: Task; from: Column } | null>(null);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Column>('inbox');
  const [allDone, setAllDone] = useState(false);

  const moving = dragged ?? null;
  const from = moving ? columnOf(moving, day) : null;
  const ahead = useMemo(() => blocks.filter(b => b.end > minute), [blocks, minute]);

  // Phone pager: which column is in view, and jumping to one.
  function colEl(c: Column) { return boardRef.current?.querySelector<HTMLElement>(`[data-col='${c}']`); }
  function scrollToCol(c: Column) { colEl(c)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); }
  function onScroll() {
    const el = boardRef.current;
    if (!el) return;
    const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
    setActive(COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, Math.round(el.scrollLeft / (w + 10))))]);
  }
  useEffect(() => { if (p.jump) scrollToCol(p.jump.col); }, [p.jump]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Desktop drag & drop ──
  const dropProps = (target: string) => ({
    'data-drop': target,
    onDragOver: (e: DragEvent) => {
      if (!isTaskDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (over !== target) setOver(target);
    },
    onDragLeave: (e: DragEvent) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(o => (o === target ? null : o)); },
    onDrop: (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      setOver(null);
      const task = dragged ?? [...COLUMNS.flatMap(c => cols[c])].find(t => t.id === e.dataTransfer.getData('text/df-task'));
      if (task) p.onDrop(task, target, 'drag');
    },
  });

  // ── Phones: long-press opens “Move to…” (passive pointer handlers only — nothing ever blocks scrolling) ──
  function pressStart(e: React.PointerEvent, task: Task, col: Column) {
    if (!coarse || e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('input, .task-actions')) return;
    pressEnd();
    const x = e.clientX, y = e.clientY;
    const timer = window.setTimeout(() => { press.current = null; navigator.vibrate?.(12); setSheet({ task, from: col }); }, LONG_PRESS_MS);
    press.current = { timer, x, y };
  }
  function pressMove(e: React.PointerEvent) {
    const pr = press.current;
    if (pr && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > 10) pressEnd();
  }
  function pressEnd() { if (press.current) { clearTimeout(press.current.timer); press.current = null; } }
  function pick(target: string) {
    const st = sheet;
    setSheet(null);
    if (st) p.onDrop(st.task, target, 'long_press');
  }

  const row = (t: Task, col: Column) => (
    <div key={t.id} className={`board-card${sheet?.task.id === t.id ? ' lifted' : ''}`} role="presentation"
      onClick={() => p.onSelect(t.id)} onPointerDown={e => pressStart(e, t, col)} onPointerMove={pressMove} onPointerUp={pressEnd} onPointerCancel={pressEnd}
      onContextMenu={e => { if (coarse) e.preventDefault(); }}>
      <TaskRow task={t} areaMap={areaMap} dayId={day} selected={t.id === selId} tracked={tracked.get(t.id)} nativeDrag={!coarse}
        onOpen={x => p.onOpen(x.id)} onToday={p.onToday} />
    </div>
  );

  // Today, grouped: earlier days (never closed), then each block, then loose.
  const today = cols.today;
  const stale = today.filter(t => !t.dayId || t.dayId < day);
  const groups = blocks.map(b => ({ b, tasks: today.filter(t => t.dayId === day && t.blockId === b.id) })).filter(g => g.tasks.length);
  const loose = today.filter(t => t.dayId === day && (!t.blockId || !blocks.some(b => b.id === t.blockId)));
  const load = dayTasks.filter(t => t.status !== 'done').reduce((s, t) => s + (t.estimate ?? 0), 0);
  const left = ahead.reduce((s, b) => s + b.end - Math.max(b.start, minute), 0);
  const done = allDone ? cols.done : cols.done.slice(0, DONE_SHOWN);

  const blockZones = (list: DayBlock[], forTask: Task | null, cls: string) => (
    <div className={cls}>
      {list.map(b => {
        const area = areaMap.get(b.areaId);
        const target = `block:${b.id}`;
        const same = !!forTask?.areaId && forTask.areaId === b.areaId;
        const cap = capacity({ ...b, start: Math.max(b.start, minute) }, dayTasks.filter(t => t.id !== forTask?.id));
        return (
          <div key={b.id} className={`zone${same ? ' same' : ''}${over === target ? ' on' : ''}`} data-color={area?.color ?? 'gray'} {...(coarse ? { 'data-drop': target } : dropProps(target))}>
            <span className="dot" />
            <span className="tabular muted">{fmtMin(b.start)}</span>
            <span className="zone-name">{b.title}</span>
            <span className="tabular muted">{m.tasks.fit.free(fmtDuration(Math.max(0, cap.available - cap.estimated)))}</span>
          </div>
        );
      })}
    </div>
  );

  const column = (c: Column, body: ReactNode, extra?: ReactNode) => {
    const Icon = COL_ICON[c];
    const target = `col:${c}`;
    const count = c === 'done' ? 0 : cols[c].length;
    const hint = !coarse && !!moving && from !== c;
    return (
      <section key={c} data-col={c} className={`board-col${over === target ? ' over' : ''}${hint ? ' hint' : ''}`} {...(coarse ? {} : dropProps(target))}>
        <header className="col-head">
          <Icon size={14} />
          <span className="col-name">{m.tasks.lists[c]}</span>
          {count > 0 && <span className="col-count tabular">{count}</span>}
          {extra}
        </header>
        <div className="col-body">
          {body}
          {hint && <div className="col-drop">{m.tasks.board.dropHere}</div>}
        </div>
      </section>
    );
  };

  return (
    <>
      <nav className="board-nav sheet-only" aria-label={m.tasks.title}>
        {COLUMNS.map(c => {
          const n = c === 'done' ? 0 : cols[c].length;
          return (
            <button key={c} type="button" aria-pressed={active === c} data-drop={`col:${c}`} onClick={() => scrollToCol(c)}>
              {m.tasks.lists[c]}{n > 0 && <span className="tabular">{n}</span>}
            </button>
          );
        })}
      </nav>
      <div className="board" ref={boardRef} onScroll={onScroll}>
        {column('inbox', cols.inbox.length ? cols.inbox.map(t => row(t, 'inbox')) : <p className="col-empty">{m.tasks.board.empty.inbox}</p>)}
        {column('backlog', (
          <>
            {cols.backlog.length ? cols.backlog.map(t => row(t, 'backlog')) : <p className="col-empty">{m.tasks.board.empty.backlog}</p>}
            {(p.snoozed?.length ?? 0) > 0 && (
              <details className="col-snoozed">
                <summary className="sublabel">{m.tasks.later.snoozed(p.snoozed!.length)}</summary>
                <div className="col-group">{p.snoozed!.map(t => row(t, 'backlog'))}</div>
              </details>
            )}
          </>
        ))}
        {column('today', (
          <>
            {p.todayTop}
            {dragged && !coarse && ahead.length > 0 && (
              <div className="zones-wrap">
                <span className="sublabel">{m.tasks.board.dropBlock}</span>
                {blockZones(ahead, dragged, 'zones')}
                <span className="muted zones-or">{m.tasks.board.orAnywhere}</span>
              </div>
            )}
            {stale.length > 0 && <><span className="sublabel">{m.tasks.board.fromEarlier}</span>{stale.map(t => row(t, 'today'))}</>}
            {groups.map(({ b, tasks }) => {
              const cap = capacity(b, dayTasks);
              return (
                <div key={b.id} className="col-group">
                  <span className="group-head" data-color={areaMap.get(b.areaId)?.color ?? 'gray'}>
                    <span className="dot" /><span className="tabular">{fmtMin(b.start)}</span><span className="group-name">{b.title}</span>
                    {cap.estimated > 0 && <span className={`tabular cap${cap.over ? ' over' : ''}`}>{fmtDuration(cap.estimated)}/{fmtDuration(cap.available)}</span>}
                  </span>
                  {tasks.map(t => row(t, 'today'))}
                </div>
              );
            })}
            {loose.length > 0 && (
              <div className="col-group">
                {groups.length > 0 && <span className="group-head"><span className="group-name muted">{m.tasks.noBlock}</span></span>}
                {loose.map(t => row(t, 'today'))}
              </div>
            )}
            {!today.length && !p.todayTop && <p className="col-empty">{m.tasks.board.empty.today}</p>}
          </>
        ), load > 0 ? <span className={`col-load tabular${load > left ? ' over' : ''}`} title={m.tasks.capacity(fmtDuration(load), fmtDuration(left))}>{fmtDuration(load)} / {fmtDuration(left)}</span> : null)}
        {column('done', (
          <>
            {done.length ? done.map(t => row(t, 'done')) : <p className="col-empty">{m.tasks.board.empty.done}</p>}
            {cols.done.length > DONE_SHOWN && !allDone && <button type="button" className="btn sm ghost" onClick={() => setAllDone(true)}>{m.tasks.board.showMore(cols.done.length - DONE_SHOWN)}</button>}
          </>
        ))}
      </div>
      {sheet && createPortal(
        <>
          <div className="modal-backdrop" onClick={() => setSheet(null)} />
          <div className="modal move-sheet" role="dialog" aria-label={m.tasks.board.moveTo}>
            <span className="label">{m.tasks.board.moveTo}</span>
            <b className="move-title">{sheet.task.title}</b>
            <div className="dock-row">
              {COLUMNS.filter(c => c !== sheet.from).map(c => {
                const Icon = COL_ICON[c];
                return <button key={c} type="button" className="dock-target" onClick={() => pick(`col:${c}`)}><Icon size={18} /><span>{m.tasks.lists[c]}</span></button>;
              })}
            </div>
            {ahead.length > 0 && (
              <>
                <span className="sublabel">{m.tasks.board.dropBlock}</span>
                <div className="zones">
                  {ahead.map(b => {
                    const area = areaMap.get(b.areaId);
                    const same = !!sheet.task.areaId && sheet.task.areaId === b.areaId;
                    const cap = capacity({ ...b, start: Math.max(b.start, minute) }, dayTasks.filter(t => t.id !== sheet.task.id));
                    return (
                      <button key={b.id} type="button" className={`zone${same ? ' same' : ''}`} data-color={area?.color ?? 'gray'} onClick={() => pick(`block:${b.id}`)}>
                        <span className="dot" /><span className="tabular muted">{fmtMin(b.start)}</span><span className="zone-name">{b.title}</span>
                        <span className="tabular muted">{m.tasks.fit.free(fmtDuration(Math.max(0, cap.available - cap.estimated)))}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
