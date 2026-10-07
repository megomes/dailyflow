'use client';
import { GripVertical, Pencil, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { fmtMin } from '@/lib/time';

/**
 * Phone: tapping a block only selects it (handles on, ready to drag) and this bar shows at the bottom;
 * the inspector sheet opens from Edit. The sheet used to open on the tap and cover the timeline, so
 * blocks could not be dragged on the phone (note #54).
 */
export function SelBar({ title, start, end, onEdit, onClose }: { title: string; start: number; end: number; onEdit: () => void; onClose: () => void }) {
  return (
    <div className="selbar" role="toolbar" aria-label={m.inspector.title}>
      <GripVertical size={15} className="muted" aria-hidden />
      <div className="selbar-text">
        <b>{title}</b>
        <span className="hint tabular">{fmtMin(start)}–{fmtMin(end)} · {m.inspector.dragHint}</span>
      </div>
      <button type="button" className="btn sm" onClick={onEdit}><Pencil size={13} />{m.inspector.edit}</button>
      <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label={m.inspector.close}><X size={15} /></button>
    </div>
  );
}
