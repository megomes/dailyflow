'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useCalStatus } from '@/components/day/useCalendar';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { syncCalendars } from '@/lib/calendar/client';
import { getDB } from '@/lib/db';
import { savePrefs } from '@/lib/prefs';
import { activeAreas, update } from '@/lib/repo';
import type { Calendar, CalClass } from '@/lib/types';

interface AccountRow { id: string; provider: 'google' | 'microsoft'; email: string | null; status: string; lastError: string | null; lastSyncAt: string | null }
interface Accounts { configured: { google: boolean; microsoft: boolean }; tableMissing: boolean; accounts: AccountRow[] }

/** Settings › Calendars (E9): connect accounts, classify calendars, see sync status. */
function CalendarsInner() {
  const params = useSearchParams();
  const [info, setInfo] = useState<Accounts | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const status = useCalStatus();
  const calendars = (useLiveQuery(() => getDB().calendars.toArray(), []) ?? []).filter(c => !c.deleted);
  const areas = activeAreas(useLiveQuery(() => getDB().areas.toArray(), []) ?? []);
  const prefs = useLiveQuery(() => getDB().prefs.get('prefs'), []);
  /** Default area of an account's events: Work for Microsoft (Teams), Personal for Google, unless changed. */
  const areaOf = (a: AccountRow) => prefs?.calendarAreas?.[a.id] ?? (a.provider === 'microsoft' ? 'area-work' : 'area-personal');
  async function setArea(a: AccountRow, areaId: string) {
    await savePrefs({ calendarAreas: { ...(prefs?.calendarAreas ?? {}), [a.id]: areaId } });
    track('calendar_area_set', { provider: a.provider, area: areaId });
    void syncCalendars('area', { force: true });
  }

  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/calendars/accounts')
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Accounts>; })
      .then(j => { if (!cancelled) setInfo(j); })
      .catch(e => { if (!cancelled) setLoadError(String((e as Error).message)); });
    return () => { cancelled = true; };
  }, [reload, status.at]);
  useEffect(() => {
    // Just back from OAuth: pull the new calendars and their events.
    if (params.get('connected')) { track('calendar_connected', { account: params.get('connected')?.split(':')[0] }); void syncCalendars('connected', { force: true }); }
  }, [params]);

  async function classify(c: Calendar, cls: CalClass) {
    await update<Calendar>('calendar', c.id, { classification: cls });
    track('calendar_event_classified', { from: c.classification, to: cls, scope: 'calendar' });
    void syncCalendars('classified', { force: true });
  }
  async function remove(id: string) {
    await fetch(`/api/calendars/accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    track('calendar_disconnected', {});
    setReload(r => r + 1);
    void syncCalendars('removed', { force: true });
  }

  const err = params.get('error');
  return (
    <>
      <section className="section">
        <h2>{m.calendars.title}</h2>
        <p className="hint" style={{ margin: 0 }}>{m.calendars.intro}</p>
        {params.get('connected') && <p className="ok-line">{m.calendars.connected}</p>}
        {err && <p className="error">{err.startsWith('not_configured_') ? m.calendars.notConfigured(err.replace('not_configured_', '')) : err}</p>}
        {info?.tableMissing && <p className="error">{m.calendars.tableMissing}</p>}
        {loadError && <p className="error">{loadError}</p>}
        <div className="row wrap">
          <a className="btn sm" href="/api/calendars/connect?provider=google" aria-disabled={info ? !info.configured.google : undefined}>{m.calendars.connectGoogle}</a>
          <a className="btn sm" href="/api/calendars/connect?provider=microsoft" aria-disabled={info ? !info.configured.microsoft : undefined}>{m.calendars.connectMicrosoft}</a>
          <button type="button" className="btn sm ghost" disabled={status.running} onClick={() => void syncCalendars('manual', { force: true, refreshCalendars: true })}>
            <RefreshCw size={14} />{status.running ? m.calendars.syncing : m.calendars.syncNow}
          </button>
        </div>
        {info && !info.configured.google && <span className="hint">{m.calendars.notConfigured('Google')}</span>}
        {info && !info.configured.microsoft && <span className="hint">{m.calendars.notConfigured('Microsoft')}</span>}
      </section>
      {(info?.accounts ?? []).length === 0 && calendars.length === 0 ? <p className="secondary">{m.calendars.none}</p> : (info?.accounts ?? []).map(a => {
        const result = status.results.find(r => r.account === a.id);
        return (
          <section key={a.id} className="section">
            <div className="row wrap">
              <h2>{a.email ?? a.id}</h2>
              <span className={`status-pill ${a.status === 'ok' ? 's-active' : ''}`}>{m.calendars.status[a.status] ?? a.status}</span>
              <span className="spacer" />
              {a.status !== 'ok' && <a className="btn sm" href={`/api/calendars/connect?provider=${a.provider}`}>{m.calendars.reconnect}</a>}
              <button type="button" className="btn sm danger" onClick={() => void remove(a.id)}>{m.calendars.remove}</button>
            </div>
            <span className="hint">
              {a.lastSyncAt ? m.calendars.lastSync(new Date(a.lastSyncAt).toLocaleString()) : ''}
              {result?.events != null ? ` · ${m.calendars.events(result.events)}` : ''}
              {a.lastError ? ` · ${a.lastError}` : ''}
            </span>
            <label className="row cal-area">{m.calendars.areaLabel}
              <select className="input sel" value={areaOf(a)} onChange={e => void setArea(a, e.target.value)}>
                {areas.map(ar => <option key={ar.id} value={ar.id}>{ar.name}</option>)}
              </select>
            </label>
            <div className="list">
              {calendars.filter(c => c.accountId === a.id).sort((x, y) => Number(!!y.primary) - Number(!!x.primary) || x.name.localeCompare(y.name)).map(c => (
                <div key={c.id} className="list-row">
                  <span className="cal-swatch" style={{ background: c.color ?? 'var(--c-gray)' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{c.name}{c.primary ? ' ·  primary' : ''}</span>
                  <div className="seg">
                    {(['commitment', 'hidden'] as CalClass[]).map(k => (
                      <button key={k} type="button" aria-pressed={k === 'commitment' ? c.classification === 'commitment' : c.classification !== 'commitment'} onClick={() => void classify(c, k)}>{m.calendars.classes[k]}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export default function CalendarsPage() {
  return <Suspense fallback={null}><CalendarsInner /></Suspense>;
}
