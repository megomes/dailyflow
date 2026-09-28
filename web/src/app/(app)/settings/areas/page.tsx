'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Plus } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { AREA_ICON_KEYS, AreaIcon, COLOR_KEYS } from '@/lib/icons';
import { save, uid, update as updateRecord } from '@/lib/repo';
import type { Area } from '@/lib/types';

export default function AreasPage() {
  const areas = useLiveQuery(() => getDB().areas.toArray(), []);
  if (!areas) return null;
  const list = areas.filter(a => !a.deleted).sort((a, b) => a.sort - b.sort);
  const active = list.filter(a => !a.archived);
  const archived = list.filter(a => a.archived);

  async function add() {
    const a: Area = { id: uid(), name: m.areas.newName, color: 'gray', icon: 'sparkles', sort: (list.at(-1)?.sort ?? 0) + 1, updatedAt: '' };
    await save('area', a);
    track('life_area_created', { area: a.id });
  }

  return (
    <>
      <section className="section">
        <div className="row"><h2 className="dup-title">{m.areas.title}</h2><span className="spacer" /><button type="button" className="btn sm" onClick={() => void add()}><Plus size={15} />{m.areas.add}</button></div>
        <p className="hint" style={{ margin: 0 }}>{m.areas.note}</p>
        <div className="list">{active.map(a => <AreaRow key={a.id} area={a} />)}</div>
      </section>
      {archived.length > 0 && (
        <section className="section">
          <h2>{m.areas.archived}</h2>
          <div className="list">{archived.map(a => <AreaRow key={a.id} area={a} />)}</div>
        </section>
      )}
    </>
  );
}

function AreaRow({ area }: { area: Area }) {
  const [name, setName] = useState(area.name);
  const [open, setOpen] = useState<'color' | 'icon' | null>(null);
  const [prevName, setPrevName] = useState(area.name);
  const ref = useRef<HTMLDivElement>(null);
  if (area.name !== prevName) { setPrevName(area.name); setName(area.name); }
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const update = (patch: Partial<Area>, event: string, props: Record<string, unknown> = {}) => {
    void updateRecord<Area>('area', area.id, patch);
    track(event, { area: area.id, ...props });
  };

  function commitName() {
    const n = name.trim();
    if (n && n !== area.name) update({ name: n }, 'life_area_renamed');
    else setName(area.name);
  }

  return (
    <div className="list-row" data-color={area.color} ref={ref} style={{ position: 'relative', opacity: area.archived ? 0.7 : 1 }}>
      <button type="button" className="area-icon" aria-label={m.areas.icon} onClick={() => setOpen(open === 'icon' ? null : 'icon')}><AreaIcon name={area.icon} size={15} /></button>
      <button type="button" className="swatch" aria-label={m.areas.color} onClick={() => setOpen(open === 'color' ? null : 'color')} style={{ width: 22, height: 22 }} />
      <input className="input" style={{ flex: 1, minWidth: 140 }} value={name} onChange={e => setName(e.target.value)} onBlur={commitName}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label="Name" />
      {area.archived ? (
        <button type="button" className="btn sm ghost" onClick={() => update({ archived: false }, 'life_area_restored')}><ArchiveRestore size={14} />{m.areas.restore}</button>
      ) : (
        <button type="button" className="btn sm ghost" onClick={() => update({ archived: true }, 'life_area_archived')}><Archive size={14} />{m.areas.archive}</button>
      )}
      {open === 'color' && (
        <div className="popover" style={{ top: 44, left: 48, gridTemplateColumns: 'repeat(6, 26px)' }}>
          {COLOR_KEYS.map(c => (
            <button key={c} type="button" className="swatch" data-color={c} aria-label={c} aria-pressed={c === area.color}
              onClick={() => { update({ color: c }, 'life_area_recolored', { color: c }); setOpen(null); }} />
          ))}
        </div>
      )}
      {open === 'icon' && (
        <div className="popover" style={{ top: 44, left: 8, gridTemplateColumns: 'repeat(6, 30px)' }}>
          {AREA_ICON_KEYS.map(k => (
            <button key={k} type="button" className="btn icon sm ghost" aria-label={k} aria-pressed={k === area.icon}
              style={k === area.icon ? { background: 'var(--bg-surface-active)' } : undefined}
              onClick={() => { update({ icon: k }, 'life_area_icon_changed', { icon: k }); setOpen(null); }}><AreaIcon name={k} size={15} /></button>
          ))}
        </div>
      )}
    </div>
  );
}
