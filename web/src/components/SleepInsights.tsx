'use client';
import type { MouseEvent } from 'react';
import { m } from '@/i18n/en';
import { plannedVsReal, type Period } from '@/lib/insights';
import { clockOf, sleepStats, targetSpan, type SleepTarget } from '@/lib/sleep';
import { addDays, dateFromIso, fmtDuration } from '@/lib/time';
import type { DayBlock, Sleep, TimeRecord } from '@/lib/types';
import { StageBar } from './day/Sleep';

/** Axis of the night chart: 20:00 → 12:00 next day, in night minutes. */
const LO = 20 * 60, HI = 36 * 60;
const pct = (min: number) => `${((Math.min(HI, Math.max(LO, min)) - LO) / (HI - LO)) * 100}%`;

/**
 * Insights › Sleep (note #29): each night as a bar from bedtime to wake-up against the target,
 * how regular both are, the debt, the stages when the watch recorded them, and what short nights
 * did to the next day.
 */
export function SleepInsights({ sleeps, period, target, blocks, records, hover, leave }: {
  sleeps: Sleep[]; period: Period; target: SleepTarget; blocks: DayBlock[]; records: TimeRecord[];
  hover: (text: string) => (e: MouseEvent) => void; leave: () => void;
}) {
  // Nights that end inside the period: the night before its first day counts.
  const s = sleepStats(sleeps, addDays(period.from, -1), period.to, target);
  const t = targetSpan(target);
  if (!s.rows.length) return <section className="card stack ins-card"><div><b>{m.sleep.card}</b></div><p className="hint" style={{ margin: 0 }}>{m.sleep.none}</p></section>;

  // What the next day looked like after short nights vs the rest.
  const next = s.rows.map(r => {
    const day = addDays(r.night, 1);
    const pvr = plannedVsReal(blocks.filter(b => b.areaId !== 'area-sleep'), records, { from: day, to: day, label: 'day' });
    return { short: r.minutes < 6 * 60, ratio: pvr.planned ? pvr.real / pvr.planned : null };
  }).filter(x => x.ratio != null);
  const avg = (xs: { ratio: number | null }[]) => (xs.length ? Math.round((xs.reduce((a, x) => a + x.ratio!, 0) / xs.length) * 100) : null);
  const shortPct = avg(next.filter(x => x.short)), restPct = avg(next.filter(x => !x.short));

  return (
    <section className="card stack ins-card sleep-ins">
      <div><b>{m.sleep.card}</b><div className="hint">{m.sleep.cardHint}</div></div>
      <div className="sleep-kpis">
        <span><b className="tabular">{fmtDuration(Math.round(s.avgMinutes))}</b> {m.sleep.avg} <span className="muted">/ {fmtDuration(s.target)}</span></span>
        <span><b className="tabular">{clockOf(s.avgBed)}</b> {m.sleep.bedAvg} <span className="muted">{m.sleep.regular(s.bedSpread)}</span></span>
        <span><b className="tabular">{clockOf(s.avgWake)}</b> {m.sleep.wakeAvg} <span className="muted">{m.sleep.regular(s.wakeSpread)}</span></span>
        <span><b className="tabular">{fmtDuration(Math.round(s.debt))}</b> {m.sleep.debt}</span>
      </div>
      <div className="night-chart">
        {s.rows.map(r => (
          <div key={r.night} className="night-row">
            <span className="muted tabular">{dateFromIso(r.night).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</span>
            <div className="night-track">
              <span className="night-target" style={{ left: pct(t.bed) }} aria-hidden />
              <span className="night-target" style={{ left: pct(t.wake) }} aria-hidden />
              <i className={`night-bar${r.minutes < 6 * 60 ? ' short' : ''}`} style={{ left: pct(r.bed), right: `calc(100% - ${pct(r.wake)})` }}
                onMouseMove={hover(`${clockOf(r.bed)} → ${clockOf(r.wake)} · ${fmtDuration(Math.round(r.minutes))}${r.source === 'health' ? ' · watch' : ''}`)} onMouseLeave={leave}>
                {r.stages && <StageBar stages={r.stages} />}
              </i>
            </div>
            <span className="tabular secondary">{fmtDuration(Math.round(r.minutes))}</span>
          </div>
        ))}
        <div className="night-axis tabular muted"><span>20:00</span><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span></div>
      </div>
      {s.stages && (
        <div className="stage-legend">
          {(['deep', 'rem', 'light', 'awake'] as const).map(k => <span key={k}><i className={`st-${k}`} />{m.sleep.stages[k]} <span className="tabular muted">{fmtDuration(Math.round(s.stages![k]))}</span></span>)}
        </div>
      )}
      {shortPct != null && restPct != null && (
        <p className="hint" style={{ margin: 0 }}>{m.sleep.nextDay(shortPct, restPct)}</p>
      )}
    </section>
  );
}
