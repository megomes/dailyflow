'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { ENTITIES, getDB } from '@/lib/db';
import { download, entityCsv, exportAll } from '@/lib/export';
import { PRESETS } from '@/lib/ops';
import { savePrefs } from '@/lib/prefs';
import { setCutoffHour } from '@/lib/time';
import { DAY_CUTOFF_HOUR } from '@/lib/config';

export default function PreferencesPage() {
  const prefs = useLiveQuery(() => getDB().prefs.get('prefs'), []);
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const cutoff = prefs?.dayCutoffHour ?? DAY_CUTOFF_HOUR;
  const [focus, setFocus] = useState('');
  const [brk, setBrk] = useState('');

  async function toggleNotify(key: 'notifyFocus' | 'notifyBlocks', on: boolean) {
    if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== 'granted') return;
    }
    await savePrefs({ [key]: on });
    track('notifications_toggled', { kind: key, on });
  }

  return (
    <>
      <section className="section">
        <h2>{m.prefs.cutoff}</h2>
        <div className="row wrap">
          <div className="seg">
            {[0, 1, 2, 3, 4, 5, 6].map(h => (
              <button key={h} type="button" aria-pressed={cutoff === h} onClick={async () => { await savePrefs({ dayCutoffHour: h }); setCutoffHour(h); track('day_cutoff_changed', { hour: h }); }}>{String(h).padStart(2, '0')}:00</button>
            ))}
          </div>
        </div>
        <p className="hint" style={{ margin: 0 }}>{m.prefs.cutoffHint}</p>
      </section>
      <section className="section">
        <h2>{m.prefs.focusPreset}</h2>
        <div className="row wrap">
          {PRESETS.map(p => (
            <button key={p.id} type="button" className="chip" aria-pressed={(prefs?.focusPreset ?? '25/5') === p.id} onClick={() => void savePrefs({ focusPreset: p.id })}>{p.label}</button>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>{m.prefs.customPresets}</h2>
        <div className="row wrap">
          {(prefs?.customPresets ?? []).map(p => (
            <button key={p.id} type="button" className="chip" onClick={() => void savePrefs({ customPresets: (prefs?.customPresets ?? []).filter(x => x.id !== p.id) })}>{p.label} ×</button>
          ))}
        </div>
        <form className="row wrap" onSubmit={e => {
          e.preventDefault();
          const f = Number(focus), b = Number(brk);
          if (!(f >= 1 && f <= 240) || !(b >= 0 && b <= 60)) return;
          const id = `c${f}/${b}`;
          void savePrefs({ customPresets: [...(prefs?.customPresets ?? []).filter(x => x.id !== id), { id, label: `${f} / ${b}`, focus: f, brk: b }] });
          track('preset_created', { focus: f, brk: b });
          setFocus(''); setBrk('');
        }}>
          <input className="input sel tabular" style={{ width: 90 }} type="number" placeholder={m.prefs.focusMin} value={focus} onChange={e => setFocus(e.target.value)} />
          <input className="input sel tabular" style={{ width: 90 }} type="number" placeholder={m.prefs.breakMin} value={brk} onChange={e => setBrk(e.target.value)} />
          <button type="submit" className="btn sm">{m.prefs.addPreset}</button>
        </form>
      </section>
      <section className="section">
        <h2>{m.prefs.density}</h2>
        <div className="seg">{(['compact', 'normal', 'roomy'] as const).map(dn => <button key={dn} type="button" aria-pressed={(prefs?.density ?? 'normal') === dn} onClick={() => void savePrefs({ density: dn })}>{m.prefs.densities[dn]}</button>)}</div>
      </section>
      <section className="section">
        <h2>{m.prefs.recurLead}</h2>
        <p className="hint" style={{ margin: 0 }}>{m.prefs.recurLeadHint}</p>
        <div className="seg">{[0, 1, 2, 3, 7].map(n => <button key={n} type="button" aria-pressed={(prefs?.recurLeadDays ?? 1) === n} onClick={() => void savePrefs({ recurLeadDays: n })}>{m.prefs.recurLeadOpt(n)}</button>)}</div>
      </section>
      <section className="section">
        <h2>{m.prefs.data}</h2>
        <p className="hint" style={{ margin: 0 }}>{m.prefs.dataHint}</p>
        <div className="row wrap">
          <button type="button" className="btn sm" onClick={async () => {
            const all = await exportAll();
            download(`dailyflow-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(all, null, 2), 'application/json');
            track('export_done', { format: 'json', rows: Object.values(all.data).reduce((s, r) => s + r.length, 0) });
          }}>{m.prefs.exportJson}</button>
          <span className="hint">{m.prefs.exportCsv}:</span>
          {ENTITIES.map(e => (
            <button key={e} type="button" className="btn sm ghost" onClick={async () => {
              const all = await exportAll();
              const rows = all.data[e] as Record<string, unknown>[];
              download(`dailyflow-${e}.csv`, entityCsv(rows), 'text/csv');
              track('export_done', { format: 'csv', entity: e, rows: rows.length });
            }}>{e}</button>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>{m.prefs.notifications}</h2>
        {perm === 'unsupported' ? <p className="hint">{m.prefs.notifyUnsupported}</p> : (
          <div className="list">
            <label className="list-row"><input type="checkbox" checked={!!prefs?.notifyFocus && perm === 'granted'} onChange={e => void toggleNotify('notifyFocus', e.target.checked)} />{m.prefs.notifyFocus}</label>
            <label className="list-row"><input type="checkbox" checked={!!prefs?.notifyBlocks && perm === 'granted'} onChange={e => void toggleNotify('notifyBlocks', e.target.checked)} />{m.prefs.notifyBlocks}</label>
          </div>
        )}
        {perm === 'denied' && <p className="hint">{m.prefs.notifyDenied}</p>}
      </section>
    </>
  );
}
