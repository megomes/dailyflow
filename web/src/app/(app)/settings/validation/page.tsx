'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { QuestionSet } from '@/components/Checkin';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { STAGE } from '@/lib/config';
import { toCsv, download } from '@/lib/csv';
import { getDB } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { pushEvents } from '@/lib/sync';
import type { ProductEvent } from '@/lib/types';
import { DAILY, RETRO } from '@/lib/validation';

type Row = Omit<ProductEvent, 'synced'>;
const stripSynced = (e: ProductEvent): Row => { const r: Partial<ProductEvent> = { ...e }; delete r.synced; return r as Row; };
type Scope = 'today' | 'stage' | 'all';
const COLS: (keyof Row & string)[] = ['ts', 'day', 'stage', 'event', 'screen', 'device', 'deviceId', 'sessionId', 'props', 'id'];

/** Server events from every device; falls back to this device's local copy when offline. */
async function fetchEvents(scope: Scope, day: string): Promise<{ events: Row[]; offline: boolean }> {
  const qs = new URLSearchParams({ limit: '5000' });
  if (scope !== 'all') qs.set('stage', STAGE);
  if (scope === 'today') qs.set('day', day);
  try {
    await pushEvents().catch(() => {});
    const res = await fetch(`/api/events?${qs}`);
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { events: Row[] };
    return { events: body.events.map(e => ({ ...e, ts: new Date(e.ts).toISOString() })), offline: false };
  } catch {
    let local = await getDB().events.orderBy('ts').reverse().toArray();
    if (scope !== 'all') local = local.filter(e => e.stage === STAGE);
    if (scope === 'today') local = local.filter(e => e.day === day);
    return { events: local.map(stripSynced), offline: true };
  }
}

export default function ValidationPage() {
  const { day } = useClock();
  const [scope, setScope] = useState<Scope>('today');
  const [filter, setFilter] = useState('');
  const [events, setEvents] = useState<Row[] | null>(null);
  const [offline, setOffline] = useState(false);
  const pending = useLiveQuery(() => getDB().events.where('synced').equals(0).count(), []);
  const todayCheckin = useLiveQuery(() => getDB().checkins.get(day), [day]);

  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchEvents(scope, day).then(r => { if (!cancelled) { setEvents(r.events); setOffline(r.offline); } });
    return () => { cancelled = true; };
  }, [scope, day, nonce]);
  const load = () => setNonce(n => n + 1);

  const names = useMemo(() => [...new Set((events ?? []).map(e => e.event))].sort(), [events]);
  const shown = useMemo(() => (events ?? []).filter(e => !filter || e.event === filter), [events, filter]);
  const stats = useMemo(() => {
    const ev = events ?? [];
    return {
      events: ev.length,
      sessions: new Set(ev.filter(e => e.event === 'session_started').map(e => e.sessionId)).size,
      checkins: new Set(ev.filter(e => e.event === 'checkin_completed').map(e => String((e.props as { about_day?: string }).about_day))).size,
      errors: ev.filter(e => e.event === 'error_logged' || e.event === 'sync_failed').length,
    };
  }, [events]);

  function exportAs(kind: 'json' | 'csv') {
    const name = `dailyflow-events-${scope}-${day}.${kind}`;
    if (kind === 'json') download(name, JSON.stringify(shown, null, 2), 'application/json');
    else download(name, toCsv(shown as unknown as Record<string, unknown>[], COLS), 'text/csv');
    track('validation_data_exported', { format: kind, scope, rows: shown.length });
  }

  return (
    <>
      <section className="section">
        <div><h2 className="dup-title">{m.validation.title}</h2><p className="hint" style={{ margin: '3px 0 0' }}>{m.validation.subtitle}</p></div>
      </section>
      <section className="section">
        <h2>{m.validation.checkin}</h2>
        {todayCheckin ? (
          <p className="secondary" style={{ margin: 0 }}>{todayCheckin.status === 'answered' ? m.checkin.thanks : `${m.checkin.skip} ✓`}</p>
        ) : (
          <QuestionSet questions={DAILY} kind="daily" about={day} title={m.checkin.title(STAGE)} meta={m.checkin.meta(DAILY.length)} />
        )}
      </section>
      <section className="section">
        <h2>{m.validation.retro}</h2>
        <p className="hint" style={{ margin: 0 }}>{m.validation.retroHint}</p>
        <QuestionSet questions={RETRO} kind="retro" about={day} title={`Retro · ${STAGE}`} />
      </section>
      <section className="section">
        <div className="row wrap">
          <h2>{m.validation.data}</h2><span className="spacer" />
          <div className="seg" role="group">
            {(['today', 'stage', 'all'] as const).map(s => (
              <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}>{m.validation[s]}</button>
            ))}
          </div>
          <select className="input" style={{ width: 'auto', height: 32 }} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Event">
            <option value="">All events</option>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button type="button" className="btn sm icon" onClick={load} aria-label="Reload"><RefreshCw size={14} /></button>
          <button type="button" className="btn sm" onClick={() => exportAs('json')} disabled={!shown.length}><Download size={14} />{m.validation.exportJson}</button>
          <button type="button" className="btn sm" onClick={() => exportAs('csv')} disabled={!shown.length}><Download size={14} />{m.validation.exportCsv}</button>
        </div>
        <div className="stats">
          {(['events', 'sessions', 'checkins', 'errors'] as const).map(k => (
            <div key={k}><b>{stats[k]}</b><span>{m.validation.stats[k]}</span></div>
          ))}
        </div>
        {!!pending && <p className="hint" style={{ margin: 0 }}>{m.validation.pending(pending)}</p>}
        {offline && <p className="hint" style={{ margin: 0 }}>{m.validation.offline}</p>}
        <div className="table-wrap">
          {events === null ? <p className="hint" style={{ padding: 12, margin: 0 }}>{m.validation.loading}</p>
            : !shown.length ? <p className="hint" style={{ padding: 12, margin: 0 }}>{m.validation.empty}</p>
            : (
              <table className="events">
                <thead><tr><th>Time</th><th>Event</th><th>Props</th><th>Screen</th><th>Device</th></tr></thead>
                <tbody>
                  {shown.slice(0, 1000).map(e => (
                    <tr key={e.id}>
                      <td className="mono tabular">{new Date(e.ts).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                      <td className="mono ev">{e.event}</td>
                      <td className="mono props">{Object.entries(e.props || {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ')}</td>
                      <td className="mono">{e.screen}</td>
                      <td className="mono">{e.device}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </section>
    </>
  );
}
