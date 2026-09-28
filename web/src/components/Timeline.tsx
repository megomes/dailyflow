'use client';
import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { MIN_BLOCK_MIN, SNAP_MIN, TIMELINE_END_MIN, TIMELINE_START_MIN } from '@/lib/config';
import { layoutLanes, visibleRange } from '@/lib/dayLogic';
import { AreaIcon } from '@/lib/icons';
import { clamp, fmtMin, snap } from '@/lib/time';
import type { Area, TimelineBlock } from '@/lib/types';

export type ChangeKind = 'move' | 'resize-start' | 'resize-end';

interface Props {
  blocks: TimelineBlock[];
  areas: Map<string, Area>;
  nowMin?: number | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (start: number, end: number) => void;
  onChange: (id: string, start: number, end: number, kind: ChangeKind) => void;
  pxPerMin?: number;
}

interface Drag { id: string; kind: ChangeKind; y0: number; s0: number; e0: number; s: number; e: number; moved: boolean; pointerId: number }

const GUTTER = 54;
const MAX_MIN = 28 * 60;

export function Timeline({ blocks, areas, nowMin = null, selectedId, onSelect, onCreate, onChange, pxPerMin = 1.15 }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);

  const shown = useMemo(() => blocks.map(b => (drag && b.id === drag.id ? { ...b, start: drag.s, end: drag.e } : b)), [blocks, drag]);
  const [lo, hi] = useMemo(() => {
    const extra = nowMin != null ? [{ id: 'now', start: nowMin, end: nowMin + 1, title: '', areaId: '' }] : [];
    return visibleRange([...blocks, ...extra], TIMELINE_START_MIN, TIMELINE_END_MIN);
  }, [blocks, nowMin]);
  const placed = useMemo(() => layoutLanes(shown), [shown]);
  const y = (min: number) => (min - lo) * pxPerMin;
  const height = (hi - lo) * pxPerMin;

  const hours: number[] = [];
  for (let h = lo; h <= hi; h += 30) hours.push(h);

  function begin(e: RPointerEvent, b: TimelineBlock, kind: ChangeKind) {
    if (e.button !== 0) return;
    const selected = b.id === selectedId;
    if (e.pointerType !== 'mouse' && !selected) return; // touch: first tap selects, then drag
    e.stopPropagation();
    suppressClick.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: b.id, kind, y0: e.clientY, s0: b.start, e0: b.end, s: b.start, e: b.end, moved: false, pointerId: e.pointerId });
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
      onChange(d.id, d.s, d.e, d.kind);
      if (d.id !== selectedId) onSelect(d.id);
      suppressClick.current = true;
    } else if (!d.moved) {
      onSelect(d.id);
      suppressClick.current = true;
    }
  }

  function clickGrid(e: React.MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (e.target !== e.currentTarget) return;
    if (selectedId) { onSelect(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const min = lo + (e.clientY - rect.top) / pxPerMin;
    const start = clamp(Math.floor(min / 30) * 30, 0, MAX_MIN - 60);
    onCreate(start, start + 60);
  }

  return (
    <div className="tl-wrap">
      <div className="tl" style={{ height }} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {hours.map(h => (
          <div key={h} className={`tl-hour${h % 60 ? ' half' : ''}`} style={{ top: y(h) }}>
            {h % 60 === 0 && <span>{fmtMin(h)}</span>}
          </div>
        ))}
        <div className="tl-grid" onClick={clickGrid} role="presentation" />
        {placed.map(({ block: b, lane, lanes }) => {
          const area = areas.get(b.areaId);
          const top = y(b.start) + 1;
          const h = Math.max((b.end - b.start) * pxPerMin - 2, 14);
          const sel = b.id === selectedId;
          const dragging = drag?.id === b.id && drag.moved;
          const past = nowMin != null && b.end <= nowMin;
          const current = nowMin != null && b.start <= nowMin && nowMin < b.end;
          const compact = h < 38;
          const left = `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${lane / lanes} + 2px)`;
          const width = `calc((100% - ${GUTTER}px) / ${lanes} - 4px)`;
          return (
            <div
              key={b.id}
              className={`blk${sel ? ' sel' : ''}${dragging ? ' dragging' : ''}${past && !sel ? ' past' : ''}${current ? ' current' : ''}${compact ? ' compact' : ''}`}
              data-color={area?.color ?? 'gray'}
              style={{ top, height: h, left, width }}
              onPointerDown={e => begin(e, b, 'move')}
              onClick={e => { e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } onSelect(b.id); }}
              role="button"
              tabIndex={0}
              aria-pressed={sel}
              aria-label={`${b.title}, ${fmtMin(b.start)} to ${fmtMin(b.end)}`}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.id); } }}
            >
              {sel && <div className="blk-handle top" onPointerDown={e => begin(e, b, 'resize-start')} />}
              <div className="blk-title">{area && <AreaIcon name={area.icon} size={13} />}<span>{b.title || '—'}</span></div>
              <div className="blk-time">{fmtMin(b.start)}–{fmtMin(b.end)}</div>
              {sel && <div className="blk-handle bottom" onPointerDown={e => begin(e, b, 'resize-end')} />}
            </div>
          );
        })}
        {drag?.moved && <div className="drag-tip" style={{ top: Math.max(0, y(drag.s) - 22) }}>{fmtMin(drag.s)}–{fmtMin(drag.e)}</div>}
        {nowMin != null && nowMin >= lo && nowMin <= hi && (
          <div className="nowline" style={{ top: y(nowMin) }} data-now><span>{fmtMin(nowMin)}</span></div>
        )}
      </div>
    </div>
  );
}
