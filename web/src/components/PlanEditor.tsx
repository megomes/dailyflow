'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Trash2, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { MIN_BLOCK_MIN, SNAP_MIN } from '@/lib/config';
import { useIsMobile } from '@/lib/hooks';
import { AreaIcon } from '@/lib/icons';
import { clamp, fmtDuration, fmtMin, parseHHMM } from '@/lib/time';
import type { Area, TimelineBlock } from '@/lib/types';
import { Timeline, type ChangeKind } from './Timeline';

export type BlockPatch = Partial<Pick<TimelineBlock, 'start' | 'end' | 'title' | 'areaId'>>;
export type EditKind = ChangeKind | 'rename' | 'area' | 'time';

interface Props {
  blocks: TimelineBlock[];
  areas: Area[];
  nowMin?: number | null;
  /** Content shown above the inspector in the side column (Now/Next, check-in…). */
  side?: ReactNode;
  /** Content shown below the inspector (check-in…). */
  sideAfter?: ReactNode;
  note: string;
  onCreate: (start: number, end: number, surface: string) => Promise<string>;
  onUpdate: (id: string, patch: BlockPatch, kind: EditKind, before: TimelineBlock) => void;
  onDelete: (b: TimelineBlock) => void;
  pxPerMin?: number;
}

/** Timeline + inspector used by Today and by the template editor. */
export function PlanEditor({ blocks, areas, nowMin = null, side, sideAfter, note, onCreate, onUpdate, onDelete, pxPerMin }: Props) {
  const [pickedId, setSelectedId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const areaMap = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);
  const selected = blocks.find(b => b.id === pickedId) ?? null;
  const selectedId = selected ? selected.id : null;

  async function create(start: number, end: number, surface: string) {
    const id = await onCreate(start, end, surface);
    setSelectedId(id);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        const base = nowMin != null ? Math.ceil(nowMin / 30) * 30 : 9 * 60;
        void create(base, base + 60, 'keyboard');
        return;
      }
      if (!selected) return;
      if (e.key === 'Escape') { setSelectedId(null); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete(selected); setSelectedId(null); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = (e.shiftKey ? 15 : SNAP_MIN) * (e.key === 'ArrowUp' ? -1 : 1);
        const len = selected.end - selected.start;
        const start = clamp(selected.start + step, 0, 28 * 60 - len);
        onUpdate(selected.id, { start, end: start + len }, 'move', selected);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const inspector = selected ? (
    <Inspector
      key={selected.id}
      block={selected}
      areas={areas}
      note={note}
      onClose={() => setSelectedId(null)}
      onUpdate={(patch, kind) => onUpdate(selected.id, patch, kind, selected)}
      onDelete={() => { onDelete(selected); setSelectedId(null); }}
    />
  ) : null;

  return (
    <div className="today">
      <div className="today-side">
        {side}
        {!isMobile && (inspector ?? <p className="hint">{m.today.emptyHint} <span className="kbd">B</span></p>)}
        {sideAfter}
      </div>
      <Timeline
        blocks={blocks}
        areas={areaMap}
        nowMin={nowMin}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={(s, e) => void create(s, e, 'timeline')}
        onChange={(id, start, end, kind) => { const b = blocks.find(x => x.id === id); if (b) onUpdate(id, { start, end }, kind, b); }}
        pxPerMin={pxPerMin ?? (isMobile ? 1 : 1.15)}
      />
      {isMobile && inspector && (
        <>
          <div className="sheet-backdrop" onClick={() => setSelectedId(null)} />
          <div className="sheet" role="dialog" aria-label={m.inspector.title}>{inspector}</div>
        </>
      )}
    </div>
  );
}

function Inspector({ block, areas, note, onClose, onUpdate, onDelete }: {
  block: TimelineBlock; areas: Area[]; note: string; onClose: () => void;
  onUpdate: (patch: BlockPatch, kind: EditKind) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [start, setStart] = useState(fmtMin(block.start));
  const [end, setEnd] = useState(fmtMin(block.end));
  const [prev, setPrev] = useState([block.start, block.end]);
  if (prev[0] !== block.start || prev[1] !== block.end) {
    setPrev([block.start, block.end]); setStart(fmtMin(block.start)); setEnd(fmtMin(block.end));
  }

  const pickable = areas.filter(a => !a.deleted && (!a.archived || a.id === block.areaId)).sort((a, b) => a.sort - b.sort);

  function commitTitle() {
    const t = title.trim();
    if (t && t !== block.title) onUpdate({ title: t }, 'rename');
    else setTitle(block.title);
  }

  function commitTimes(sv = start, ev = end) {
    let s = parseHHMM(sv), e = parseHHMM(ev);
    if (s == null || e == null) { setStart(fmtMin(block.start)); setEnd(fmtMin(block.end)); return; }
    // Blocks may run past midnight inside the logical day: keep them after the start.
    if (block.start >= 1440) s += 1440;
    if (e <= s) e += 1440;
    if (e - s < MIN_BLOCK_MIN) e = s + MIN_BLOCK_MIN;
    if (s !== block.start || e !== block.end) onUpdate({ start: s, end: e }, 'time');
  }

  return (
    <div className="card inspector">
      <div className="head"><span className="label">{m.inspector.title}</span>
        <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label={m.inspector.close}><X size={15} /></button>
      </div>
      <label className="field"><span>{m.inspector.name}</span>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setTitle(block.title); (e.target as HTMLInputElement).blur(); } }} />
      </label>
      <div className="times">
        <label className="field"><span>{m.inspector.start}</span>
          <input className="input tabular" type="time" step={300} value={start} onChange={e => setStart(e.target.value)} onBlur={() => commitTimes()} />
        </label>
        <label className="field"><span>{m.inspector.end}</span>
          <input className="input tabular" type="time" step={300} value={end} onChange={e => setEnd(e.target.value)} onBlur={() => commitTimes()} />
        </label>
      </div>
      <div className="hint tabular">{fmtDuration(block.end - block.start)}</div>
      <div className="field"><span>{m.inspector.area}</span>
        <div className="areas-pick">
          {pickable.map(a => (
            <button key={a.id} type="button" className="chip" data-color={a.color} aria-pressed={a.id === block.areaId}
              onClick={() => { if (a.id !== block.areaId) onUpdate({ areaId: a.id }, 'area'); }}>
              <span className="dot" /><AreaIcon name={a.icon} size={12} />{a.name}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">{note}</p>
      <div className="row"><button type="button" className="btn sm danger" onClick={onDelete}><Trash2 size={14} />{m.inspector.delete}</button></div>
    </div>
  );
}
