'use client';
import { SleepInsights } from '@/components/SleepInsights';
import { DEFAULT_TARGET } from '@/lib/sleep';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Hourglass } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { AreaIcon } from '@/lib/icons';
import { areaDistribution, compareAreas, dayDiscipline, daysIn, estimationAccuracy, focusStats, goalProgress, monthOf, plannedVsReal, previous, wastedTime, weekOf, type Period } from '@/lib/insights';
import { savePrefs } from '@/lib/prefs';
import { activeAreas } from '@/lib/repo';
import { addDays, dateFromIso, fmtDuration } from '@/lib/time';
import type { Area } from '@/lib/types';

type Span = 'day' | 'week' | 'month';
interface Tip { x: number; y: number; text: string }

/** Insights (E11): what the data says, never a productivity score. */
export default function InsightsPage() {
  const { day: today } = useClock();
  const [span, setSpan] = useState<Span>('week');
  const [anchor, setAnchor] = useState(today);
  const [tip, setTip] = useState<Tip | null>(null);
  const db = getDB();
  const records = useLiveQuery(() => db.timeRecords.toArray(), []);
  const blocks = useLiveQuery(() => db.dayBlocks.toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const sessions = useLiveQuery(() => db.focusSessions.toArray(), []);
  const days = useLiveQuery(() => db.days.toArray(), []);
  const revisions = useLiveQuery(() => db.revisions.toArray(), []);
  const areasRaw = useLiveQuery(() => db.areas.toArray(), []);
  const prefs = useLiveQuery(() => db.prefs.get('prefs'), []);
  const sleeps = (useLiveQuery(() => db.sleeps.toArray(), []) ?? []).filter(x => !x.deleted);

  const period: Period = span === 'day' ? { from: anchor, to: anchor, label: 'day' } : span === 'week' ? weekOf(anchor) : monthOf(anchor);
  const prev = previous(period);

  useEffect(() => {
    const t0 = Date.now();
    return () => track('insights_viewed', { section: 'all', period: span, dwell_s: Math.round((Date.now() - t0) / 1000) });
  }, [span]);

  const data = useMemo(() => {
    if (!records || !blocks || !tasks || !sessions || !days || !revisions || !areasRaw) return null;
    const wastedIds = new Set(areasRaw.filter(a => a.wasted && !a.deleted).map(a => a.id));
    const dist = areaDistribution(records, period);
    const prevDist = areaDistribution(records, prev);
    return {
      dist,
      cmp: compareAreas(dist.total, prevDist.total),
      pvr: plannedVsReal(blocks, records, period),
      disc: dayDiscipline(days, revisions, period),
      est: estimationAccuracy(tasks, sessions, period),
      focus: focusStats(sessions, period),
      goals: goalProgress(prefs?.goals, dist.total, period),
      wasted: wastedTime(records, wastedIds, period),
      prevWasted: wastedTime(records, wastedIds, prev).total,
    };
  }, [records, blocks, tasks, sessions, days, revisions, areasRaw, prefs, period.from, period.to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !areasRaw) return <div className="page" />;
  const areaMap = new Map(areasRaw.map(a => [a.id, a]));
  const tracked = [...data.dist.total.values()].reduce((s, v) => s + v, 0);
  const prevTracked = data.cmp.reduce((s, r) => s + r.prev, 0);
  const label = span === 'day'
    ? dateFromIso(period.from).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : span !== 'month'
    ? `${dateFromIso(period.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${dateFromIso(period.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : dateFromIso(period.from).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const shift = (n: number) => { setAnchor(span === 'day' ? addDays(anchor, n) : span !== 'month' ? addDays(anchor, 7 * n) : addDays(n > 0 ? addDays(period.to, 1) : period.from, n > 0 ? 0 : -1)); track('insight_interacted', { chart: 'period', action: n > 0 ? 'next' : 'prev' }); };
  const hover = (text: string) => (e: MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text });
  const leave = () => setTip(null);
  const empty = tracked === 0;

  return (
    <div className="page insights">
      <header className="page-head">
        <div><h1>{m.insights.title}</h1><div className="sub"><span>{m.insights.subtitle}</span></div></div>
      </header>
      {/* Stays on top while the cards scroll (note #26); arrows and dates never wrap apart (note #27). */}
      <div className="ins-controls">
        <div className="seg">{(['day', 'week', 'month'] as Span[]).map(s => <button key={s} type="button" aria-pressed={span === s} onClick={() => { setSpan(s); track('insight_interacted', { chart: 'period', action: s }); }}>{m.insights.spans[s]}</button>)}</div>
        <div className="period-nav">
          <button type="button" className="btn icon sm" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft size={15} /></button>
          <b className="period-label tabular">{label}</b>
          <button type="button" className="btn icon sm" onClick={() => shift(1)} disabled={period.to >= today} aria-label="Next"><ChevronRight size={15} /></button>
        </div>
        {span === 'day' && <Link className="btn sm ghost" href={`/day?d=${period.from}`}>{m.insights.openDay}</Link>}
      </div>

      <div className="stats">
        <div><b>{fmtDuration(tracked)}</b><span>{m.insights.tracked}{prevTracked ? ` · ${delta(tracked - prevTracked)}` : ''}</span></div>
        <div><b>{data.pvr.planned ? `${Math.round((data.pvr.real / data.pvr.planned) * 100)}%` : '—'}</b><span>{m.insights.ofPlan}</span></div>
        <div><b>{data.disc.closed}/{data.disc.days}</b><span>{m.insights.closed}</span></div>
        <div><b>{fmtDuration(data.focus.minutes)}</b><span>{m.insights.focus}</span></div>
      </div>

      {empty ? <><p className="secondary">{m.insights.empty}</p><SleepInsights sleeps={sleeps} period={period} target={prefs?.sleepTarget ?? DEFAULT_TARGET} blocks={blocks ?? []} records={records ?? []} hover={hover} leave={leave} /></> : (
        <div className="ins-grid">
          <Wasted w={data.wasted} prev={data.prevWasted} days={daysIn(period)} span={span} hover={hover} leave={leave} />

          <Card title={m.insights.distribution} hint={m.insights.distributionHint}>
            <div className="daybars">
              {daysIn(period).map(d => {
                const row = data.dist.byDay.get(d);
                const sum = row ? [...row.values()].reduce((s, v) => s + v, 0) : 0;
                const max = Math.max(1, ...[...data.dist.byDay.values()].map(r => [...r.values()].reduce((s, v) => s + v, 0)));
                return (
                  <div key={d} className="daybar-row">
                    <span className="muted tabular">{dateFromIso(d).toLocaleDateString('en-US', span !== 'month' ? { weekday: 'short' } : { day: 'numeric' })}</span>
                    <div className="hbar" style={{ width: `${(sum / max) * 100}%` }}>
                      {row && [...row.entries()].sort((a, b) => order(areaMap, a[0]) - order(areaMap, b[0])).map(([id, v]) => (
                        <i key={id} data-color={areaMap.get(id)?.color ?? 'gray'} className={areaMap.get(id)?.wasted ? 'wasted' : undefined} style={{ flexGrow: v }} onMouseMove={hover(`${areaMap.get(id)?.name ?? '?'} · ${fmtDuration(v)}`)} onMouseLeave={leave} />
                      ))}
                    </div>
                    <span className="tabular secondary">{sum ? fmtDuration(sum) : ''}</span>
                  </div>
                );
              })}
            </div>
            <Legend rows={data.cmp.filter(r => r.cur > 0)} areaMap={areaMap} />
          </Card>

          <Card title={m.insights.pvr} hint={m.insights.pvrHint(data.pvr.days)}>
            <PairBars rows={data.pvr.rows.map(r => ({ areaId: r.areaId, a: r.planned, b: r.real }))} areaMap={areaMap} labels={[m.insights.planned, m.insights.real]} hover={hover} leave={leave} />
          </Card>

          <Card title={m.insights.compare} hint={m.insights.compareHint}>
            <table className="sum-table">
              <thead><tr><th>{m.close.colArea}</th><th>{m.insights.prev}</th><th>{m.insights.cur}</th><th>Δ</th></tr></thead>
              <tbody>
                {data.cmp.slice(0, 10).map(r => (
                  <tr key={r.areaId} data-color={areaMap.get(r.areaId)?.color ?? 'gray'}>
                    <td><AreaName a={areaMap.get(r.areaId)} /></td>
                    <td className="tabular muted">{fmtDuration(r.prev)}</td>
                    <td className="tabular">{fmtDuration(r.cur)}</td>
                    <td className="tabular secondary">{Math.abs(r.delta) < 5 ? '—' : `${delta(r.delta)}${r.pct != null ? ` (${r.pct > 0 ? '+' : ''}${Math.round(r.pct * 100)}%)` : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Goals areas={activeAreas(areasRaw)} goals={prefs?.goals ?? {}} progress={data.goals} areaMap={areaMap} span={span} />

          <Card title={m.insights.estimates} hint={m.insights.estimatesHint}>
            {data.est.median == null ? <span className="hint">{m.insights.noEstimates}</span> : (
              <>
                <div className="hero-line"><b className="tabular">{data.est.median.toFixed(2)}×</b><span className="secondary">{m.insights.estimateSentence(data.est.median)}</span></div>
                <table className="sum-table">
                  <thead><tr><th>{m.close.colArea}</th><th>{m.insights.tasks}</th><th>{m.insights.ratio}</th></tr></thead>
                  <tbody>{data.est.groups.map(g => (
                    <tr key={g.areaId}><td><AreaName a={areaMap.get(g.areaId)} /></td><td className="tabular muted">{g.n}</td><td className="tabular">{g.median.toFixed(2)}×</td></tr>
                  ))}</tbody>
                </table>
              </>
            )}
          </Card>

          <Card title={m.insights.focusTitle} hint={m.insights.focusHint(data.focus.days)}>
            {data.focus.sessions === 0 ? <span className="hint">{m.insights.noFocus}</span> : (
              <>
                <div className="mini-stats">
                  <span><b className="tabular">{data.focus.sessions}</b> {m.insights.sessions}</span>
                  <span><b className="tabular">{Math.round(data.focus.completion * 100)}%</b> {m.insights.completed}</span>
                  <span><b className="tabular">{fmtDuration(data.focus.avg)}</b> {m.insights.avg}</span>
                </div>
                <div className="hours">
                  {data.focus.byHour.map((v, h) => {
                    const max = Math.max(1, ...data.focus.byHour);
                    return <div key={h} className="hcol" onMouseMove={hover(`${String(h).padStart(2, '0')}:00 · ${fmtDuration(v)}`)} onMouseLeave={leave}><i style={{ height: `${(v / max) * 100}%` }} /></div>;
                  })}
                </div>
                <div className="hours-axis tabular muted"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
                {data.focus.byPreset.length > 0 && <span className="hint">{m.insights.presets}: {data.focus.byPreset.map(([p, n]) => `${p} ×${n}`).join(' · ')}</span>}
              </>
            )}
          </Card>

          <SleepInsights sleeps={sleeps} period={period} target={prefs?.sleepTarget ?? DEFAULT_TARGET} blocks={blocks ?? []} records={records ?? []} hover={hover} leave={leave} />

          <Card title={m.insights.shape} hint={m.insights.shapeHint}>
            <DayShapes period={period} records={records ?? []} areaMap={areaMap} hover={hover} leave={leave} />
          </Card>

          <Card title={m.insights.changes} hint={m.insights.changesHint}>
            <div className="mini-stats">
              <span><b className="tabular">{data.disc.started}</b> {m.insights.started}</span>
              <span><b className="tabular">{data.disc.revisions}</b> {m.insights.revisions}</span>
            </div>
            {data.disc.reasons.length > 0 && <ul className="reasons">{data.disc.reasons.map(([r, n]) => <li key={r}><span>{r}</span><span className="tabular muted">{n}</span></li>)}</ul>}
          </Card>
        </div>
      )}
      {tip && <div className="chart-tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>}
    </div>
  );
}

const order = (areaMap: Map<string, Area>, id: string) => areaMap.get(id)?.sort ?? 99;
const delta = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtDuration(Math.abs(v))}`;

/** Wasted time (note #48): its own card, so it is seen apart from the rest of the day. */
function Wasted({ w, prev, days, span, hover, leave }: { w: ReturnType<typeof wastedTime>; prev: number; days: string[]; span: Span; hover: (t: string) => (e: MouseEvent) => void; leave: () => void }) {
  const max = Math.max(1, ...w.byDay.values());
  const maxH = Math.max(1, ...w.byHour);
  return (
    <section className="card stack ins-card wasted-card">
      <div><b className="row"><Hourglass size={15} />{m.insights.wasted}</b><div className="hint">{m.insights.wastedHint}</div></div>
      {w.total === 0 ? <span className="hint">{m.insights.wastedNone}</span> : (
        <>
          <div className="hero-line">
            <b className="tabular">{fmtDuration(w.total)}</b>
            <span className="secondary">{m.insights.wastedShare(Math.round(w.share * 100))} · {m.insights.wastedDays(w.days, days.length)}</span>
            {prev > 0 && Math.abs(w.total - prev) >= 5 && <span className={`wasted-delta tabular ${w.total > prev ? 'up' : 'down'}`}>{delta(w.total - prev)}</span>}
          </div>
          {span !== 'day' && (
            <div className="daybars">
              {days.map(d => {
                const v = w.byDay.get(d) ?? 0;
                return (
                  <div key={d} className="daybar-row">
                    <span className="muted tabular">{dateFromIso(d).toLocaleDateString('en-US', span !== 'month' ? { weekday: 'short' } : { day: 'numeric' })}</span>
                    <div className="hbar" style={{ width: `${(v / max) * 100}%` }}>{v > 0 && <i className="wasted" style={{ flexGrow: 1 }} onMouseMove={hover(fmtDuration(v))} onMouseLeave={leave} />}</div>
                    <span className="tabular secondary">{v ? fmtDuration(v) : ''}</span>
                  </div>
                );
              })}
            </div>
          )}
          <span className="sublabel">{m.insights.wastedWhen}</span>
          <div className="hours wasted-hours">
            {w.byHour.map((v, h) => <div key={h} className="hcol" onMouseMove={hover(`${String(h).padStart(2, '0')}:00 · ${fmtDuration(v)}`)} onMouseLeave={leave}><i style={{ height: `${(v / maxH) * 100}%` }} /></div>)}
          </div>
          <div className="hours-axis tabular muted"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
        </>
      )}
    </section>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <section className="card stack ins-card"><div><b>{title}</b>{hint && <div className="hint">{hint}</div>}</div>{children}</section>;
}

function AreaName({ a }: { a?: Area }) {
  return <span className="row area-name" data-color={a?.color ?? 'gray'}><span className="dot" />{a && <AreaIcon name={a.icon} size={13} />}{a?.name ?? m.close.unplanned}</span>;
}

function Legend({ rows, areaMap }: { rows: { areaId: string; cur: number }[]; areaMap: Map<string, Area> }) {
  return (
    <div className="legend">
      {[...rows].sort((a, b) => b.cur - a.cur).map(r => (
        <span key={r.areaId} className="legend-item" data-color={areaMap.get(r.areaId)?.color ?? 'gray'}><span className="dot" />{areaMap.get(r.areaId)?.name ?? '?'} <span className="tabular muted">{fmtDuration(r.cur)}</span></span>
      ))}
    </div>
  );
}

function PairBars({ rows, areaMap, labels, hover, leave }: {
  rows: { areaId: string; a: number; b: number }[]; areaMap: Map<string, Area>; labels: [string, string];
  hover: (t: string) => (e: MouseEvent) => void; leave: () => void;
}) {
  const max = Math.max(1, ...rows.map(r => Math.max(r.a, r.b)));
  return (
    <div className="pairs">
      <div className="legend"><span className="legend-item ghost-key">{labels[0]}</span><span className="legend-item solid-key">{labels[1]}</span></div>
      {rows.map(r => (
        <div key={r.areaId} className="pair-row" data-color={areaMap.get(r.areaId)?.color ?? 'gray'}>
          <AreaName a={areaMap.get(r.areaId)} />
          <div className="sbar" onMouseMove={hover(`${areaMap.get(r.areaId)?.name ?? '?'} · ${labels[0]} ${fmtDuration(r.a)} · ${labels[1]} ${fmtDuration(r.b)}`)} onMouseLeave={leave}>
            <i className="f" style={{ width: `${(r.a / max) * 100}%` }} /><i className="r" style={{ width: `${(r.b / max) * 100}%` }} />
          </div>
          <span className="tabular secondary">{fmtDuration(r.b)} <span className="muted">/ {fmtDuration(r.a)}</span></span>
        </div>
      ))}
    </div>
  );
}

function DayShapes({ period, records, areaMap, hover, leave }: {
  period: Period; records: { dayId: string; start: number; end: number | null; areaId: string; title: string; deleted?: boolean }[];
  areaMap: Map<string, Area>; hover: (t: string) => (e: MouseEvent) => void; leave: () => void;
}) {
  const lo = 5 * 60, hi = 25 * 60, span = hi - lo;
  const days = daysIn(period).slice(-14);
  return (
    <div className="shapes">
      {days.map(d => (
        <div key={d} className="shape-row">
          <span className="muted tabular">{dateFromIso(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</span>
          <div className="shape-track">
            {records.filter(r => !r.deleted && r.dayId === d && r.end != null).map((r, i) => {
              const s = Math.max(lo, r.start), e = Math.min(hi, r.end!);
              if (e <= s) return null;
              return <i key={i} data-color={areaMap.get(r.areaId)?.color ?? 'gray'} style={{ left: `${((s - lo) / span) * 100}%`, width: `${((e - s) / span) * 100}%` }}
                onMouseMove={hover(`${r.title || areaMap.get(r.areaId)?.name} · ${fmtDuration(r.end! - r.start)}`)} onMouseLeave={leave} />;
            })}
          </div>
        </div>
      ))}
      <div className="shape-row axis"><span /><div className="hours-axis tabular muted"><span>05</span><span>10</span><span>15</span><span>20</span><span>01</span></div></div>
    </div>
  );
}

function Goals({ areas, goals, progress, areaMap, span }: { areas: Area[]; goals: Record<string, number>; progress: ReturnType<typeof goalProgress>; areaMap: Map<string, Area>; span: Span }) {
  const [editing, setEditing] = useState(false);
  async function set(areaId: string, hours: string) {
    const min = Math.round(Number(hours) * 60);
    const next = { ...goals, [areaId]: Number.isFinite(min) && min > 0 ? min : 0 };
    await savePrefs({ goals: next });
    track('weekly_goal_set', { area: areaId, minutes: next[areaId] });
  }
  return (
    <Card title={m.insights.goals} hint={m.insights.goalsHint(span)}>
      {progress.length === 0 && !editing && <span className="hint">{m.insights.noGoals}</span>}
      {!editing && progress.map(g => (
        <div key={g.areaId} className="goal-row" data-color={areaMap.get(g.areaId)?.color ?? 'gray'}>
          <AreaName a={areaMap.get(g.areaId)} />
          <div className="bar"><i style={{ width: `${Math.min(100, g.ratio * 100)}%` }} /></div>
          <span className="tabular secondary">{fmtDuration(g.done)} / {fmtDuration(g.target)}</span>
        </div>
      ))}
      {editing && (
        <div className="goal-edit">
          {areas.map(a => (
            <label key={a.id} className="row"><AreaName a={a} /><span className="spacer" />
              <input className="input sel tabular" style={{ width: 70 }} type="number" min={0} step={0.5} defaultValue={goals[a.id] ? goals[a.id] / 60 : ''} placeholder="h"
                onBlur={e => void set(a.id, e.target.value)} />
              <span className="hint">{m.insights.perWeek}</span>
            </label>
          ))}
        </div>
      )}
      <div><button type="button" className="btn sm" onClick={() => setEditing(!editing)}>{editing ? m.insights.doneGoals : m.insights.editGoals}</button></div>
    </Card>
  );
}
