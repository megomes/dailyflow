'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { PRESETS } from '@/lib/ops';
import { savePrefs } from '@/lib/prefs';
import { setCutoffHour } from '@/lib/time';
import { DAY_CUTOFF_HOUR } from '@/lib/config';

export default function PreferencesPage() {
  const prefs = useLiveQuery(() => getDB().prefs.get('prefs'), []);
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const cutoff = prefs?.dayCutoffHour ?? DAY_CUTOFF_HOUR;

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
