'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PlanEditor, type BlockPatch, type EditKind } from '@/components/PlanEditor';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { liveBlocks, remove, save, uid, update } from '@/lib/repo';
import type { TemplateBlock, TemplateId, TimelineBlock } from '@/lib/types';

export default function TemplatesPage() {
  const [tid, setTid] = useState<TemplateId>('weekday');
  const rows = useLiveQuery(() => getDB().templateBlocks.where('templateId').equals(tid).toArray(), [tid]);
  const areas = useLiveQuery(() => getDB().areas.toArray(), []);
  const blocks = useMemo(() => liveBlocks(rows ?? []), [rows]);

  const edited = (change: string, extra: Record<string, unknown> = {}) => track('template_edited', { template: tid, change, ...extra });

  async function onCreate(start: number, end: number, surface: string) {
    const b: TemplateBlock = { id: uid(), templateId: tid, start, end, title: m.inspector.newBlock, areaId: 'area-personal', updatedAt: '' };
    await save('template_block', b);
    edited('created', { surface, duration_min: end - start });
    return b.id;
  }

  function onUpdate(id: string, patch: BlockPatch, kind: EditKind, before: TimelineBlock) {
    const rec = rows?.find(r => r.id === id);
    if (!rec) return;
    void update<TemplateBlock>('template_block', id, patch);
    edited(kind === 'move' ? 'moved' : kind === 'rename' ? 'renamed' : kind === 'area' ? 'area_changed' : 'resized', {
      block: id, delta_min: kind === 'move' ? (patch.start ?? before.start) - before.start : undefined,
    });
  }

  function onDelete(b: TimelineBlock) {
    void remove('template_block', b.id);
    edited('deleted', { block: b.id, duration_min: b.end - b.start });
  }

  return (
    <section className="section">
      <div className="row wrap">
        <div className="seg" role="group" aria-label={m.templates.title}>
          {(['weekday', 'weekend'] as const).map(t => (
            <button key={t} type="button" aria-pressed={tid === t} onClick={() => setTid(t)}>{m.templates[t]}</button>
          ))}
        </div>
        <span className="hint">{tid === 'weekday' ? m.templates.weekdayHint : m.templates.weekendHint}</span>
        <span className="spacer" />
        <button type="button" className="btn sm" onClick={() => void onCreate(9 * 60, 10 * 60, 'button')}><Plus size={15} />{m.today.addBlock}</button>
      </div>
      <p className="hint" style={{ margin: 0 }}>{m.templates.note}</p>
      {rows && areas && (
        <PlanEditor key={tid} blocks={blocks} areas={areas} note={m.templates.note} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} pxPerMin={0.85} />
      )}
    </section>
  );
}
