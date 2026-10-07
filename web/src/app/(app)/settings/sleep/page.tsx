'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { HeartPulse, Moon } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { savePrefs } from '@/lib/prefs';
import { DEFAULT_TARGET, targetMinutes } from '@/lib/sleep';
import { dateFromIso, fmtDuration, fmtMin, parseHHMM } from '@/lib/time';
import { useHealthImport } from '@/lib/useHealthImport';

/** Settings › Sleep (note #29): the target night, and Samsung Health through Health Connect (Android app). */
export default function SleepSettings() {
  const prefs = useLiveQuery(() => getDB().prefs.get('prefs'), []);
  const target = prefs?.sleepTarget ?? DEFAULT_TARGET;
  const lastWatch = useLiveQuery(async () => (await getDB().sleeps.toArray()).filter(s => !s.deleted && s.source === 'health').sort((a, b) => b.night.localeCompare(a.night))[0], []);
  // Inside the Android app only: what the app says happened when it asked Health Connect (permission, read, import).
  const { app, busy, result, run: connect } = useHealthImport('settings');

  async function setTarget(k: 'bed' | 'wake', v: string) {
    const min = parseHHMM(v);
    if (min == null) return;
    await savePrefs({ sleepTarget: { ...target, [k]: min } });
    track('sleep_target_set', { [k]: min });
  }
  return (
    <>
      <section className="section">
        <h2><Moon size={15} /> {m.sleep.target}</h2>
        <div className="sleep-form" style={{ maxWidth: 360 }}>
          <label className="field"><span>{m.sleep.bed}</span><input id="target-bed" className="input tabular" type="time" value={fmtMin(target.bed)} onChange={e => void setTarget('bed', e.target.value)} /></label>
          <label className="field"><span>{m.sleep.wake}</span><input id="target-wake" className="input tabular" type="time" value={fmtMin(target.wake)} onChange={e => void setTarget('wake', e.target.value)} /></label>
        </div>
        <span className="hint">{fmtDuration(targetMinutes(target))}</span>
      </section>
      <section className="section">
        <h2><HeartPulse size={15} /> Samsung Health</h2>
        <p className="hint" style={{ margin: 0 }}>{m.sleep.connectHint}</p>
        {app ? (
          <div className="row wrap">
            <button type="button" className="btn sm primary" disabled={busy} onClick={connect}>{busy ? m.sleep.reading : lastWatch ? m.sleep.syncNow : m.sleep.connect}</button>
            {lastWatch && <span className="hint">{m.sleep.connected} · {dateFromIso(lastWatch.night).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
          </div>
        ) : <span className="hint">{m.sleep.onlyApp}</span>}
        {app && result && <p className={`hint health-result ${result.status}`} role="status">{m.sleep.healthResult(result)}</p>}
      </section>
    </>
  );
}
