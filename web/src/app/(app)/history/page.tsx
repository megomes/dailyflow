'use client';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { m } from '@/i18n/en';
import { areaTotals, dayShape } from '@/lib/actual';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { addDays, dateFromIso, fmtDuration, isoDate } from '@/lib/time';
import type { Area, Day, TimeRecord } from '@/lib/types';

type View = 'calendar' | 'list';

/** History (CAP-H1): calendar and list, each day drawn by its “shape” (real time per area). */
export default function HistoryPage() {
  const { day: today } = useClock();
  const [view, setView] = useState<View>('calendar');
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const days = useLiveQuery(() => getDB().days.toArray(), []);
  const recs = useLiveQuery(() => getDB().timeRecords.toArray(), []);
  const blocks = useLiveQuery(() => getDB().dayBlocks.toArray(), []);
  const areas = useLiveQuery(() => getDB().areas.toArray(), []);
  useEffect(() => { track('history_opened', { view: 'calendar' }); }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, TimeRecord[]>();
    for (const r of recs ?? []) if (!r.deleted) map.set(r.dayId, [...(map.get(r.dayId) ?? []), r]);
    return map;
  }, [recs]);
  const planned = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of blocks ?? []) if (!b.deleted) map.set(b.dayId, (map.get(b.dayId) ?? 0) + b.end - b.start);
    return map;
  }, [blocks]);
  const areaMap = useMemo(() => new Map((areas ?? []).map(a => [a.id, a])), [areas]);
  const dayMap = useMemo(() => new Map((days ?? []).filter(d => !d.deleted).map(d => [d.id, d])), [days]);

  if (!days || !recs || !areas) return <div className="page" />;
  const list = [...dayMap.values()].filter(d => d.id <= today).sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>{m.history.title}</h1></div>
        <div className="seg">
          {(['calendar', 'list'] as View[]).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); track('history_opened', { view: v }); }}>{m.history[v]}</button>)}
        </div>
      </header>
      {view === 'calendar' ? (
        <Calendar month={month} setMonth={setMonth} today={today} dayMap={dayMap} byDay={byDay} areaMap={areaMap} />
      ) : list.length === 0 ? <p className="secondary">{m.history.empty}</p> : (
        <div className="hist-list">
          {list.map(d => <DayRow key={d.id} day={d} recs={byDay.get(d.id) ?? []} planned={planned.get(d.id) ?? 0} areaMap={areaMap} today={today} />)}
        </div>
      )}
    </div>
  );
}

function Shape({ recs, areaMap, total }: { recs: TimeRecord[]; areaMap: Map<string, Area>; total?: number }) {
  const shape = dayShape(recs);
  const sum = total ?? shape.reduce((s, [, v]) => s + v, 0);
  if (!sum) return <div className="shape empty" />;
  return (
    <div className="shape">
      {shape.map(([id, v]) => <i key={id} data-color={areaMap.get(id)?.color ?? 'gray'} style={{ width: `${(v / sum) * 100}%` }} title={`${areaMap.get(id)?.name ?? '?'} ${fmtDuration(v)}`} />)}
    </div>
  );
}

function DayRow({ day, recs, planned, areaMap, today }: { day: Day; recs: TimeRecord[]; planned: number; areaMap: Map<string, Area>; today: string }) {
  const tracked = [...areaTotals(recs.map(r => ({ start: r.start, end: r.end ?? r.start, areaId: r.areaId }))).values()].reduce((s, v) => s + v, 0);
  const top = dayShape(recs).slice(0, 3);
  const status = day.status ?? 'unplanned';
  return (
    <Link href={day.id === today ? '/' : `/day?d=${day.id}`} className="card hist-row">
      <div className="hist-date">
        <b>{dateFromIso(day.id).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</b>
        <span className={`status-pill s-${status}`}>{m.day.status[status]}</span>
      </div>
      <Shape recs={recs} areaMap={areaMap} total={Math.max(planned, tracked)} />
      <div className="hist-meta">
        <span className="tabular">{m.history.tracked(fmtDuration(tracked))}{planned ? ` / ${fmtDuration(planned)}` : ''}</span>
        <span className="muted">{top.map(([id, v]) => `${areaMap.get(id)?.name ?? '?'} ${fmtDuration(v)}`).join(' · ')}</span>
      </div>
    </Link>
  );
}

function Calendar({ month, setMonth, today, dayMap, byDay, areaMap }: {
  month: string; setMonth: (m: string) => void; today: string; dayMap: Map<string, Day>; byDay: Map<string, TimeRecord[]>; areaMap: Map<string, Area>;
}) {
  const first = dateFromIso(`${month}-01`);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const start = addDays(isoDate(first), -startOffset);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const shift = (n: number) => { const d = new Date(first); d.setMonth(d.getMonth() + n); setMonth(isoDate(d).slice(0, 7)); };
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="btn icon sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
        <b>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
        <button type="button" className="btn icon sm" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={15} /></button>
      </div>
      <div className="cal-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map(id => {
          const d = dayMap.get(id);
          const recs = byDay.get(id) ?? [];
          const inMonth = id.startsWith(month);
          const future = id > today;
          const content = (
            <>
              <span className={`cal-num${id === today ? ' is-today' : ''}`}>{Number(id.slice(8))}</span>
              {d && <span className={`cal-dot s-${d.status ?? 'unplanned'}`} />}
              {recs.length > 0 && <Shape recs={recs} areaMap={areaMap} />}
            </>
          );
          return future || !d ? <div key={id} className={`cal-cell${inMonth ? '' : ' out'}`}>{content}</div>
            : <Link key={id} href={id === today ? '/' : `/day?d=${id}`} className={`cal-cell has${inMonth ? '' : ' out'}`}>{content}</Link>;
        })}
      </div>
    </div>
  );
}
