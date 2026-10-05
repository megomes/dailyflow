'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { m } from '@/i18n/en';
import { AreaIcon } from '@/lib/icons';
import { activeAreas } from '@/lib/repo';
import type { Area } from '@/lib/types';
import { Modal } from '../Modal';

/** Quick switch (CAP-C6): log something off-plan by picking an area, optionally naming it. */
export function QuickSwitch({ areas, onPick, onClose, title = m.activity.switchTitle }: {
  areas: Area[]; onPick: (areaId: string, title: string) => void; onClose: () => void; title?: string;
}) {
  const [name, setName] = useState('');
  return (
    <Modal onClose={onClose} label={title}>
      <div className="head"><b>{title}</b><button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <input className="input" placeholder={m.activity.switchPlaceholder} value={name} onChange={e => setName(e.target.value)} autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches} />
      <div className="areas-pick big-pick">
        {activeAreas(areas).map(a => (
          <button key={a.id} type="button" className="chip" data-color={a.color} onClick={() => onPick(a.id, name.trim() || a.name)}>
            <span className="dot" /><AreaIcon name={a.icon} size={13} />{a.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}
