'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { PlanEditor, type BlockPatch, type EditKind } from '@/components/PlanEditor';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { copyTemplate, liveBlocks, remove, save, uid, update } from '@/lib/repo';
import { DAY_KEYS, logicalDay, templateIdForDate } from '@/lib/time';
import type { DayKey, TemplateBlock, TimelineBlock } from '@/lib/types';

export default function TemplatesPage() {
  const todayKey = templateIdForDate(logicalDay());
  const [tid, setTid] = useState<DayKey>(todayKey);
  const [copyFrom, setCopyFrom] = useState<DayKey | ''>('');
  const [msg, setMsg] = useState('');
  const rows = useLiveQuery(() => getDB().templateBlocks.where('templateId').equals(tid).toArray(), [tid]);
  const counts = useLiveQuery(async () => {
    const all = await getDB().templateBlocks.toArray();
    return Object.fromEntries(DAY_KEYS.map(d => [d, all.filter(b => b.templateId === d && !b.deleted).length])) as Record<DayKey, number>;
  }, []);
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
    if (!rows?.some(r => r.id === id)) return;
    void update<TemplateBlock>('template_block', id, patch);
    edited(kind === 'move' ? 'moved' : kind === 'rename' ? 'renamed' : kind === 'area' ? 'area_changed' : kind === 'fixed' ? 'fixed_toggled' : 'resized', {
      block: id, delta_min: kind === 'move' ? (patch.start ?? before.start) - before.start : undefined,
    });
  }

  function onDelete(b: TimelineBlock) {
    void remove('template_block', b.id);
    edited('deleted', { block: b.id, duration_min: b.end - b.start });
  }

  async function doCopy() {
    if (!copyFrom) return;
    const n = await copyTemplate(copyFrom, tid);
    track('template_copied', { from: copyFrom, to: tid, blocks: n });
    setMsg(m.templates.copied(n, m.templates.names[copyFrom]));
    setCopyFrom('');
    setTimeout(() => setMsg(''), 4000);
  }

  function pickDay(d: DayKey) { setTid(d); setCopyFrom(''); setMsg(''); }

  return (
    <section className="section">
      <div className="seg day-seg" role="group" aria-label={m.templates.title}>
        {DAY_KEYS.map(d => (
          <button key={d} type="button" aria-pressed={tid === d} onClick={() => pickDay(d)} title={m.templates.names[d]}>
            {m.templates.short[d]}{d === todayKey && <span className="today-dot" aria-label={m.templates.today} />}
          </button>
        ))}
      </div>
      <div className="row wrap">
        <span className="hint">{m.templates.dayHint(m.templates.names[tid])}{counts ? ` · ${counts[tid]} blocks` : ''}</span>
        <span className="spacer" />
        <select className="input" style={{ width: 'auto', height: 28, fontSize: 12.5, padding: '0 8px' }} value={copyFrom}
          onChange={e => setCopyFrom(e.target.value as DayKey | '')} aria-label={m.templates.copyFrom}>
          <option value="">{m.templates.copyFrom}</option>
          {DAY_KEYS.filter(d => d !== tid).map(d => <option key={d} value={d}>{m.templates.names[d]}{counts ? ` (${counts[d]})` : ''}</option>)}
        </select>
        {copyFrom && (
          <button type="button" className="btn sm danger" onClick={() => void doCopy()}>
            <Copy size={14} />{m.templates.copyConfirm(m.templates.names[copyFrom], m.templates.names[tid])}
          </button>
        )}
        <button type="button" className="btn sm" onClick={() => void onCreate(9 * 60, 10 * 60, 'button')}><Plus size={15} />{m.today.addBlock}</button>
      </div>
      {msg && <p className="hint" role="status" style={{ margin: 0 }}>{msg}</p>}
      <p className="hint" style={{ margin: 0 }}>{m.templates.note}</p>
      {rows && areas && (
        <PlanEditor key={tid} blocks={blocks} areas={areas} note={m.templates.note} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} pxPerMin={0.85} />
      )}
    </section>
  );
}
