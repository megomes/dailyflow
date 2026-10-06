'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type PointerEvent as RPointerEvent } from 'react';
import { CalendarDays, Lock, Minus, Moon, Pause, Plus, Sunrise } from 'lucide-react';
import { MIN_BLOCK_MIN, SNAP_MIN, TIMELINE_END_MIN, TIMELINE_START_MIN } from '@/lib/config';
import { layoutLanes, visibleRange } from '@/lib/dayLogic';
import { AreaIcon } from '@/lib/icons';
import { clamp, fmtMin, snap } from '@/lib/time';
import type { Area, TimelineBlock } from '@/lib/types';
import { contextForMenu, pressForMenu, type MenuSpec } from './ContextMenu';

export type ChangeKind = 'move' | 'resize-start' | 'resize-end';

export interface TLItem extends TimelineBlock {
  /** plan = block, real = time record, ghost = baseline/reference (read-only), running = live record,
   *  sleep = a night (note #29, not a block), night = a planned Sleep block. */
  variant?: 'plan' | 'real' | 'ghost' | 'running' | 'event' | 'sleep' | 'night';
  /** Extra class (sleep: 'morning' | 'night'). */
  cls?: string;
  /** Sleep stages in minutes, drawn as a thin bar. */
  stages?: { deep: number; light: number; rem: number; awake: number };
  /** Color key when the item has no area (calendar events). */
  color?: string;
  fixed?: boolean;
  /** Small badge in the corner (e.g. “−40m”, “3 tasks”). */
  badge?: string;
  badgeTone?: 'warn' | 'ok' | 'muted';
  /** Paused stretches inside a real activity, drawn as striped holes (note #33). */
  holes?: { start: number; end: number }[];
}

/** Sleep is not a block (note #29): the night is the sky behind the day, with a marker where you woke up or went to bed. */
export interface TLNight { start: number; end: number; part: 'morning' | 'night'; planned?: boolean }
export interface TLMark { at: number; kind: 'wake' | 'bed'; text: string; tone?: 'ok' | 'late' | 'early'; planned?: boolean; night?: string }

export interface TLColumn {
  id: string;
  label?: string;
  items: TLItem[];
  editable?: boolean;
  nights?: TLNight[];
  marks?: TLMark[];
  /** Stretches confirmed “leave empty” (note #46): drawn dashed, like “Show later hours”, and only while nothing is recorded there. */
  empties?: { start: number; end: number }[];
}

interface Props {
  columns: TLColumn[];
  areas: Map<string, Area>;
  nowMin?: number | null;
  selectedId: string | null;
  onSelect: (id: string | null, columnId?: string) => void;
  onCreate?: (columnId: string, start: number, end: number) => void;
  onChange?: (columnId: string, id: string, start: number, end: number, kind: ChangeKind) => void;
  /** HTML5 drop of a task (dataTransfer 'text/df-task') on a block or an empty slot. */
  onDropTask?: (taskId: string, columnId: string, minute: number, itemId?: string) => void;
  /** While a task is dragged, blocks of this area stand out (DIA-04). */
  highlightArea?: string | null;
  pxPerMin?: number;
  /** Right-click / press-and-hold menu for an item (note #22). */
  onItemMenu?: (id: string, columnId: string) => MenuSpec | Promise<MenuSpec | null> | null;
  /** A wake / bed marker was tapped (to fix the time). */
  onMark?: (mark: TLMark) => void;
}

interface Drag { id: string; col: string; kind: ChangeKind; y0: number; s0: number; e0: number; s: number; e: number; moved: boolean; pointerId: number }

const GUTTER = 54;
const MAX_MIN = 28 * 60;
const COL_GAP = 6;

const ZOOM_KEY = 'df.tlzoom';
const ZOOM_MIN = 0.6, ZOOM_MAX = 4;
const MAX_EXTRA_H = (MAX_MIN - TIMELINE_END_MIN) / 60;

let memoryZoom: number | null = null;
const zoomListeners = new Set<() => void>();
const subscribeZoom = (l: () => void) => { zoomListeners.add(l); return () => { zoomListeners.delete(l); }; };
const readZoom = () => {
  if (memoryZoom == null) { try { const z = Number(localStorage.getItem(ZOOM_KEY)); memoryZoom = z >= ZOOM_MIN && z <= ZOOM_MAX ? z : 1; } catch { memoryZoom = 1; } }
  return memoryZoom;
};

const scrollParent = (el: HTMLElement | null): HTMLElement | null => {
  for (let p = el; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
};

export function Timeline({ columns, areas, nowMin = null, selectedId, onSelect, onCreate, onChange, onDropTask, highlightArea, pxPerMin: basePx = 1.15, onItemMenu, onMark }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  // Zoom (note #44): pinch with two fingers on the phone, − / + on the desktop. One level for every timeline, kept on this device.
  const zoom = useSyncExternalStore(subscribeZoom, readZoom, () => 1);
  const pxPerMin = basePx * zoom;
  // Hours past 22:00 the user asked for (note #43): the grid ends there unless a block reaches further.
  const [extraH, setExtraH] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const live = useRef({ zoom, lo: 0, basePx });
  const setZoom = (z: number) => {
    memoryZoom = clamp(Math.round(z * 100) / 100, ZOOM_MIN, ZOOM_MAX);
    try { localStorage.setItem(ZOOM_KEY, String(memoryZoom)); } catch { /* private mode */ }
    zoomListeners.forEach(l => l());
  };
  /** Zoom around a point of the screen: the minute under it stays where it is. */
  const zoomAround = (z: number, clientY: number | null) => {
    const el = wrapRef.current?.querySelector('.tl') as HTMLElement | null;
    const sp = scrollParent(el);
    const { zoom: z0, lo: l0, basePx: b0 } = live.current;
    const next = clamp(z, ZOOM_MIN, ZOOM_MAX);
    if (el && clientY != null) {
      const minute = l0 + (clientY - el.getBoundingClientRect().top) / (b0 * z0);
      setZoom(next);
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dy = r.top + (minute - l0) * b0 * next - clientY;
        if (sp) sp.scrollTop += dy; else window.scrollBy(0, dy);
      });
    } else setZoom(next);
  };
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let startDist = 0, startZoom = 1;
    const dist = (t: TouchList) => Math.max(40, Math.abs(t[0].clientY - t[1].clientY), Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) * 0.5);
    const onStart = (e: TouchEvent) => { if (e.touches.length === 2) { startDist = dist(e.touches); startZoom = live.current.zoom; } };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDist) return;
      e.preventDefault();
      zoomAround(startZoom * (dist(e.touches) / startDist), (e.touches[0].clientY + e.touches[1].clientY) / 2);
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) startDist = 0; };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [dropAt, setDropAt] = useState<{ col: string; id?: string; min: number } | null>(null);
  const suppressClick = useRef(false);

  const all = useMemo(() => columns.flatMap(c => c.items), [columns]);
  const [lo, hi] = useMemo(() => {
    const extra = nowMin != null ? [{ id: 'now', start: nowMin, end: nowMin + 1, title: '', areaId: '' }] : [];
    return visibleRange([...all, ...extra], TIMELINE_START_MIN, TIMELINE_END_MIN + extraH * 60);
  }, [all, nowMin, extraH]);
  useEffect(() => { live.current = { zoom, lo, basePx }; });
  const placedCols = useMemo(() => columns.map(c => ({
    col: c,
    placed: layoutLanes(c.items.map(b => (drag && b.id === drag.id ? { ...b, start: drag.s, end: drag.e } : b))),
  })), [columns, drag]);
  const y = (min: number) => (min - lo) * pxPerMin;
  const height = (hi - lo) * pxPerMin;
  const n = columns.length;
  const colLeft = (i: number) => `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${i / n} + ${i ? COL_GAP / 2 : 0}px)`;
  const colWidth = `calc((100% - ${GUTTER}px) / ${n} - ${n > 1 ? COL_GAP / 2 : 0}px)`;

  const hours: number[] = [];
  for (let h = lo; h <= hi; h += 30) hours.push(h);

  function begin(e: RPointerEvent, b: TLItem, col: TLColumn, kind: ChangeKind) {
    if (e.button !== 0 || !col.editable || b.variant === 'ghost' || b.variant === 'event' || b.variant === 'sleep') return;
    const selected = b.id === selectedId;
    if (e.pointerType !== 'mouse' && !selected) return; // touch: first tap selects, then drag
    if (b.variant === 'running' && kind === 'resize-end') return;
    e.stopPropagation();
    suppressClick.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: b.id, col: col.id, kind, y0: e.clientY, s0: b.start, e0: b.end, s: b.start, e: b.end, moved: false, pointerId: e.pointerId });
  }

  function move(e: RPointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 4) return;
    const d = snap(dy / pxPerMin, SNAP_MIN);
    let s = drag.s0, en = drag.e0;
    if (drag.kind === 'move') {
      const len = drag.e0 - drag.s0;
      s = clamp(drag.s0 + d, 0, MAX_MIN - len);
      en = s + len;
    } else if (drag.kind === 'resize-start') {
      s = clamp(drag.s0 + d, 0, drag.e0 - MIN_BLOCK_MIN);
    } else {
      en = clamp(drag.e0 + d, drag.s0 + MIN_BLOCK_MIN, MAX_MIN);
    }
    setDrag({ ...drag, s, e: en, moved: true });
  }

  function end(e: RPointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    setDrag(null);
    if (d.moved && (d.s !== d.s0 || d.e !== d.e0)) {
      onChange?.(d.col, d.id, d.s, d.e, d.kind);
      if (d.id !== selectedId) onSelect(d.id, d.col);
      suppressClick.current = true;
    } else if (!d.moved) {
      onSelect(d.id, d.col);
      suppressClick.current = true;
    }
  }

  function minuteAt(e: { clientY: number }, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return lo + (e.clientY - rect.top) / pxPerMin;
  }

  function clickGrid(e: React.MouseEvent<HTMLDivElement>, col: TLColumn) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (e.target !== e.currentTarget) return;
    if (selectedId) { onSelect(null); return; }
    if (!col.editable || !onCreate) return;
    const start = clamp(Math.floor(minuteAt(e, e.currentTarget) / 30) * 30, 0, MAX_MIN - 60);
    onCreate(col.id, start, start + (col.id === 'real' ? 30 : 60));
  }

  const isTaskDrag = (e: DragEvent) => e.dataTransfer.types.includes('text/df-task');
  function over(e: DragEvent<HTMLElement>, col: TLColumn, id?: string) {
    if (!onDropTask || !isTaskDrag(e) || col.id !== 'plan') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const min = Math.floor(minuteAt(e, e.currentTarget.closest('.tl') as HTMLElement) / 15) * 15;
    if (dropAt?.id !== id || dropAt?.min !== min || dropAt?.col !== col.id) setDropAt({ col: col.id, id, min });
  }
  function drop(e: DragEvent<HTMLElement>, col: TLColumn, id?: string) {
    if (!onDropTask || !isTaskDrag(e) || col.id !== 'plan') return;
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData('text/df-task');
    const min = Math.floor(minuteAt(e, e.currentTarget.closest('.tl') as HTMLElement) / 15) * 15;
    setDropAt(null);
    if (taskId) onDropTask(taskId, col.id, min, id);
  }

  return (
    <div className="tl-wrap" ref={wrapRef}>
      <div className="tl-zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => zoomAround(zoom / 1.25, null)}><Minus size={13} /></button>
        <button type="button" className="pct" aria-label="Reset zoom" disabled={zoom === 1} onClick={() => zoomAround(1, null)}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => zoomAround(zoom * 1.25, null)}><Plus size={13} /></button>
      </div>
      {n > 1 && (
        <div className="tl-cols">
          {columns.map((c, i) => (
            <div key={c.id} className="label" style={{ left: colLeft(i), width: colWidth }}>{c.label}</div>
          ))}
        </div>
      )}
      <div className="tl" style={{ height }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDragLeave={e => { if (e.target === e.currentTarget) setDropAt(null); }}>
        {hours.map(h => (
          <div key={h} className={`tl-hour${h % 60 ? ' half' : ''}`} style={{ top: y(h) }}>
            {h % 60 === 0 && <span>{fmtMin(h)}</span>}
          </div>
        ))}
        {placedCols.map(({ col }, i) => (
          <div
            key={`grid-${col.id}`}
            className={`tl-grid${col.editable ? '' : ' ro'}${n > 1 ? ' boxed' : ''}`}
            style={{ left: colLeft(i), width: colWidth }}
            onClick={e => clickGrid(e, col)}
            onDragOver={e => over(e, col)}
            onDrop={e => drop(e, col)}
            role="presentation"
            data-col={col.id}
          />
        ))}
        {columns.map((col, ci) => (
          <div key={`sky-${col.id}`} className="tl-sky" aria-hidden={!col.marks?.length}>
            {col.nights?.map((nb, i) => {
              const t = Math.max(0, y(nb.start)), b = Math.min(height, y(nb.end));
              if (b - t < 2) return null;
              return <div key={i} className={`tl-night ${nb.part}${nb.planned ? ' planned' : ''}`} style={{ top: t, height: b - t, left: colLeft(ci), width: colWidth }}><span className="stars" /></div>;
            })}
            {col.marks?.map((mk, i) => {
              const top = y(mk.at);
              if (top < 0 || top > height) return null;
              return (
                <div key={`m${i}`} className={`tl-mark ${mk.kind}${mk.tone ? ` ${mk.tone}` : ''}${mk.planned ? ' planned' : ''}`} style={{ top, left: colLeft(ci), width: colWidth }}>
                  <button type="button" onClick={() => onMark?.(mk)} disabled={mk.planned || !onMark}>{mk.kind === 'wake' ? <Sunrise size={11} /> : <Moon size={11} />}{mk.text}</button>
                </div>
              );
            })}
          </div>
        ))}
        {columns.map((col, ci) => col.empties?.map((e, i) => (
          <div key={`empty-${col.id}-${i}`} className="tl-empty" title="Left empty" aria-hidden style={{ top: y(e.start), height: Math.max((e.end - e.start) * pxPerMin, 4), left: colLeft(ci), width: colWidth }} />
        )))}
        {dropAt && !dropAt.id && (
          <div className="ghost-new" style={{ top: y(dropAt.min), height: 60 * pxPerMin, left: colLeft(columns.findIndex(c => c.id === dropAt.col)), width: colWidth }} />
        )}
        {placedCols.map(({ col, placed }, ci) => placed.map(({ block: b, lane, lanes }) => {
          const area = areas.get(b.areaId);
          const top = y(b.start) + 1;
          const h = Math.max((b.end - b.start) * pxPerMin - 2, 14);
          const sel = b.id === selectedId && b.variant !== 'ghost';
          const dragging = drag?.id === b.id && drag.moved;
          const past = nowMin != null && b.end <= nowMin && b.variant !== 'real' && b.variant !== 'running';
          const current = nowMin != null && b.start <= nowMin && nowMin < b.end && (b.variant ?? 'plan') === 'plan';
          const evt = b.variant === 'event';
          const compact = h < 38;
          const dim = highlightArea != null && col.id === 'plan' && b.areaId !== highlightArea;
          const lit = highlightArea != null && col.id === 'plan' && b.areaId === highlightArea;
          const dropping = dropAt?.id === b.id;
          const left = `calc(${colLeft(ci)} + (${colWidth}) * ${lane / lanes} + 2px)`;
          const width = `calc((${colWidth}) / ${lanes} - 4px)`;
          const cls = ['blk', b.variant ?? 'plan', b.cls, area?.wasted && 'wasted', sel && 'sel', dragging && 'dragging', past && !sel && 'past', current && 'current', compact && 'compact', dim && 'dim', lit && 'lit', dropping && 'drop'].filter(Boolean).join(' ');
          return (
            <div
              key={`${col.id}-${b.id}`}
              className={cls}
              data-color={b.color ?? area?.color ?? 'gray'}
              style={{ top, height: h, left, width }}
              onPointerDown={e => { if (onItemMenu && b.variant !== 'ghost') pressForMenu(e, () => onItemMenu(b.id, col.id)); begin(e, b, col, 'move'); }}
              onContextMenu={onItemMenu && b.variant !== 'ghost' ? e => contextForMenu(e, () => onItemMenu(b.id, col.id)) : undefined}
              onClick={e => { e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } if (b.variant !== 'ghost') onSelect(b.id, col.id); }}
              onDragOver={e => over(e, col, b.id)}
              onDrop={e => drop(e, col, b.id)}
              role="button"
              tabIndex={b.variant === 'ghost' ? -1 : 0}
              aria-pressed={sel}
              aria-label={`${b.title}, ${fmtMin(b.start)} to ${fmtMin(b.end)}`}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.id, col.id); } }}
            >
              {sel && col.editable && !evt && <div className="blk-handle top" onPointerDown={e => begin(e, b, col, 'resize-start')} />}
              <div className="blk-title">
                {b.variant === 'event' ? <CalendarDays size={12} /> : b.variant === 'sleep' ? (b.cls === 'morning' ? <Sunrise size={13} /> : <Moon size={13} />) : area && <AreaIcon name={area.icon} size={13} />}<span>{b.title || area?.name || '—'}</span>
                {b.fixed && <Lock size={11} className="blk-lock" aria-label="Fixed" />}
              </div>
              <div className="blk-time">{fmtMin(b.start)}–{b.variant === 'running' ? 'now' : fmtMin(b.end)}</div>
              {b.holes?.map((hl, i) => <span key={i} className="blk-hole" style={{ top: (hl.start - b.start) * pxPerMin, height: Math.max((hl.end - hl.start) * pxPerMin, 6) }} title={`Paused ${Math.round(hl.end - hl.start)} min`}>{(hl.end - hl.start) * pxPerMin >= 16 && <Pause size={10} />}</span>)}
              {b.badge && <span className={`blk-badge ${b.badgeTone ?? 'muted'}`}>{b.badge}</span>}
              {area && h >= 64 && (b.variant === 'plan' || b.variant === 'real' || !b.variant) && <span className="blk-corner" aria-hidden><AreaIcon name={area.icon} size={12} /></span>}
              {b.stages && h >= 30 && <span className="stage-bar">{(['deep', 'rem', 'light', 'awake'] as const).map(k => <i key={k} className={`st-${k}`} style={{ flexGrow: b.stages![k] }} />)}</span>}
              {sel && col.editable && !evt && b.variant !== 'running' && <div className="blk-handle bottom" onPointerDown={e => begin(e, b, col, 'resize-end')} />}
            </div>
          );
        }))}
        {drag?.moved && <div className="drag-tip" style={{ top: Math.max(0, y(drag.s) - 22) }}>{fmtMin(drag.s)}–{fmtMin(drag.e)}</div>}
        {nowMin != null && nowMin >= lo && nowMin <= hi && (
          <div className="nowline" style={{ top: y(nowMin) }} data-now><span>{fmtMin(nowMin)}</span></div>
        )}
      </div>
      {onCreate && hi < MAX_MIN && extraH < MAX_EXTRA_H && columns.some(c => c.editable) && (
        <button type="button" className="tl-more" onClick={() => setExtraH(h => Math.min(MAX_EXTRA_H, Math.max(h, Math.ceil((hi - TIMELINE_END_MIN) / 60)) + 2))}>Show later hours</button>
      )}
    </div>
  );
}
