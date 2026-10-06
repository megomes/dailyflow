'use client';
import { clockOf, sleepSpans, sleepVsPlan } from '@/lib/sleep';
import { useSleeps, useSleepTarget } from './Sleep';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronsUpDown, ListChecks, Minus, Moon, Play, Plus, RefreshCw, Sunrise, X } from 'lucide-react';
import { AreaIcon } from '@/lib/icons';
import { m } from '@/i18n/en';
import { dayGaps, overlapKey, pausedWithin, recEnd, replanRemaining, whatChanged, type ChangeLine, type Conflict, type Span } from '@/lib/actual';
import { track } from '@/lib/analytics';
import { acceptPlanAsReal, addRecord, adoptPlan, applyReplan, saveDayAsTemplate, closeDay, deleteBlock, keepOverlap, lateStart, leaveGapEmpty, patchBlock, setRevisionReason, startDay } from '@/lib/ops';
import { DAY_KEYS, fmtDuration, fmtMin, templateIdForDate } from '@/lib/time';
import type { Area, DayBlock, DayKey, PlanBlock, TimeRecord } from '@/lib/types';
import { Modal } from '../Modal';
import { QuickSwitch } from './QuickSwitch';

export function StartDayCard({ dayId, blocks, templateName, minute }: { dayId: string; blocks: DayBlock[]; templateName: string; minute: number }) {
  const passed = blocks.filter(b => b.end <= minute && !b.fixed).length;
  const late = passed > 0 && minute < 22 * 60;
  return (
    <section className="card startcard">
      <span className="label row"><Sunrise size={13} />{m.day.notStartedTitle}</span>
      <span className="secondary">{m.day.notStartedSub(blocks.length, templateName)}</span>
      {late && <span className="hint">{m.day.lateHint(passed)}</span>}
      <div className="row wrap">
        <button type="button" className="btn sm primary" onClick={() => void startDay(dayId, 'quick')}><Play size={13} />{m.day.start}</button>
        {late && <button type="button" className="btn sm" onClick={() => void lateStart(dayId)}>{m.day.lateStart}</button>}
        <Link href={`/plan?d=${dayId}`} className="btn sm ghost"><ListChecks size={13} />{m.day.plan}</Link>
      </div>
    </section>
  );
}

/**
 * The day started by itself (an activity was started before any plan): planning is still open.
 * Planning now, or keeping the plan as it is, sets the Baseline the day is compared against.
 */
export function NotPlannedCard({ dayId, startedAt }: { dayId: string; startedAt?: string }) {
  const at = startedAt ? new Date(startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <section className="card startcard">
      <span className="label row"><Sunrise size={13} />{m.day.notPlannedTitle}</span>
      <span className="secondary">{m.day.notPlannedSub(at)}</span>
      <div className="row wrap">
        <Link href={`/plan?d=${dayId}`} className="btn sm primary"><ListChecks size={13} />{m.day.plan}</Link>
        <button type="button" className="btn sm ghost" onClick={() => void adoptPlan(dayId, 'quick')}>{m.day.keepPlan}</button>
      </div>
    </section>
  );
}

/** Yesterday not closed (CAP-G6): a simple card with the fast path and the full review. */
export function YesterdayCard({ dayId, blocks, records, empty = [] }: { dayId: string; blocks: DayBlock[]; records: TimeRecord[]; empty?: Span[] }) {
  const [busy, setBusy] = useState(false);
  const tracked = records.reduce((s, r) => s + (recEnd(r, r.start) - r.start - pausedWithin(r)), 0);
  const sleeps = useSleeps();
  const gaps = dayGaps(blocks, records, 28 * 60, 10, [...sleepSpans(dayId, sleeps, 28 * 60), ...empty]).reduce((s, g) => s + g.end - g.start, 0);
  async function quick() {
    setBusy(true);
    const t0 = Date.now();
    await acceptPlanAsReal(dayId, 28 * 60, undefined, 'yesterday_card');
    await closeDay(dayId, undefined, t0);
    setBusy(false);
  }
  return (
    <section className="card startcard yesterday">
      <span className="label row"><Moon size={13} />{m.day.yesterdayTitle}</span>
      <span className="secondary">{m.day.yesterdaySub(fmtDuration(tracked), fmtDuration(gaps))}</span>
      <div className="row wrap">
        <Link href={`/close?d=${dayId}`} className="btn sm primary">{m.day.closeYesterday}</Link>
        <button type="button" className="btn sm" disabled={busy} onClick={() => void quick()}>{m.day.acceptClose}</button>
      </div>
    </section>
  );
}

export function changeText(c: ChangeLine, areaMap: Map<string, Area>): string {
  const an = (id: string) => areaMap.get(id)?.name ?? m.close.unplanned;
  switch (c.kind) {
    case 'area': return m.day.area(an(c.areaId), fmtDuration(c.planned), fmtDuration(c.actual), c.delta);
    case 'moved': return m.day.moved(c.title, fmtMin(c.from), fmtMin(c.to));
    case 'resized': return m.day.resized(c.title, fmtDuration(c.from), fmtDuration(c.to));
    case 'added': return m.day.added(c.title, fmtMin(c.start), fmtDuration(c.minutes));
    case 'removed': return m.day.removed(c.title, fmtMin(c.start), fmtDuration(c.minutes));
  }
}

/** One line of “What changed today”, drawn (note #47): an area is a planned bar against a real bar; a plan change is an icon and the before → after. */
function ChangeRow({ c, areaMap, scale }: { c: ChangeLine; areaMap: Map<string, Area>; scale: number }) {
  const area = 'areaId' in c ? areaMap.get(c.areaId) : undefined;
  const color = area?.color ?? 'gray';
  if (c.kind === 'area') {
    const skipped = c.actual === 0;
    return (
      <li className={`chg area ${c.delta > 0 ? 'up' : 'down'}`} data-color={color}>
        <span className="chg-ico">{area ? <AreaIcon name={area.icon} size={15} /> : <Minus size={15} />}</span>
        <div className="chg-body">
          <div className="chg-head">
            <b>{area?.name ?? m.close.unplanned}</b>
            <span className="chg-delta tabular">{skipped ? m.day.skipped : `${c.delta > 0 ? '+' : '−'}${fmtDuration(Math.abs(c.delta))}`}</span>
          </div>
          <div className="chg-bars" aria-hidden>
            <span className="bar plan" style={{ width: `${Math.max(3, (c.planned / scale) * 100)}%` }} />
            <span className="bar real" style={{ width: `${Math.max(c.actual ? 3 : 0, (c.actual / scale) * 100)}%` }} />
          </div>
          <div className="chg-sub tabular"><span>{m.day.planned} {fmtDuration(c.planned)}</span><span>{m.day.actual} {fmtDuration(c.actual)}</span></div>
        </div>
      </li>
    );
  }
  const Icon = c.kind === 'moved' ? ArrowRight : c.kind === 'resized' ? ChevronsUpDown : c.kind === 'added' ? Plus : Minus;
  const detail = c.kind === 'moved' ? `${fmtMin(c.from)} → ${fmtMin(c.to)}`
    : c.kind === 'resized' ? `${fmtDuration(c.from)} → ${fmtDuration(c.to)}`
    : `${fmtMin(c.start)} · ${fmtDuration(c.minutes)}`;
  return (
    <li className={`chg plan ${c.kind}`} data-color={color}>
      <span className="chg-ico"><Icon size={15} /></span>
      <div className="chg-body">
        <div className="chg-head"><b>{c.title}</b><span className="chg-tag">{m.day.kinds[c.kind]}</span></div>
        <div className="chg-sub tabular"><span>{detail}</span></div>
      </div>
    </li>
  );
}

/** “What changed today” (VIS-CAMADAS): plain-language differences, biggest first. */
export function ChangesCard({ dayId, baseline, blocks, records, until, areaMap, plannedWake }: { dayId: string; baseline?: PlanBlock[]; blocks: DayBlock[]; records: TimeRecord[]; until: number; areaMap: Map<string, Area>; plannedWake?: number }) {
  const [all, setAll] = useState(false);
  const sleeps = useSleeps();
  const target = useSleepTarget();
  const sleepLines = sleepVsPlan(dayId, sleeps, target, plannedWake);
  const lines = whatChanged(baseline, blocks, records, until);
  const shown = all ? lines : lines.slice(0, 4);
  // One scale for every area bar, so a 2h gap looks twice as big as a 1h one.
  const scale = Math.max(30, ...lines.map(c => (c.kind === 'area' ? Math.max(c.planned, c.actual) : 0)));
  return (
    <section className="card changes">
      <span className="label">{m.day.changesTitle}</span>
      {lines.length === 0 && sleepLines.length === 0 ? <span className="hint">{m.day.changesEmpty}</span> : (
        <ul>
          {sleepLines.map(s => (
            <li key={s.kind} className="plan sleep-line"><Moon size={12} />{m.sleep.vsPlan(s.kind, Math.abs(s.delta), s.delta > 0, clockOf(s.actual), clockOf(s.planned))}</li>
          ))}
          {shown.map((c, i) => <ChangeRow key={i} c={c} areaMap={areaMap} scale={scale} />)}
        </ul>
      )}
      {lines.length > 4 && <button type="button" className="btn sm ghost" onClick={() => { setAll(!all); if (!all) track('changes_expanded', { lines: lines.length }); }}>{all ? m.day.less : m.day.more(lines.length - 4)}</button>}
    </section>
  );
}

const msSince = (t: number) => Date.now() - t;

/** Overlap detected (US-REPLAN-001) with the four actions. */
export function ConflictsCard({ dayId, conflicts }: { dayId: string; conflicts: Conflict[] }) {
  const [t0] = useState(() => Date.now());
  const open = conflicts;
  const key = open[0] ? `${open[0].a.id}|${open[0].b.id}` : '';
  useEffect(() => { if (key) track('conflict_detected', { kind: 'overlap' }); }, [key]);
  if (!open.length) return null;
  const c = open[0];
  const done = (action: string) => track('conflict_resolved', { kind: 'overlap', action, ms_to_resolve: msSince(t0) });
  return (
    <section className="card conflicts">
      <span className="label row"><AlertTriangle size={13} />{m.day.conflicts}{open.length > 1 ? ` · ${open.length}` : ''}</span>
      <span>{m.day.conflict(c.a.title, c.b.title, fmtDuration(c.minutes))}</span>
      <div className="row wrap">
        <button type="button" className="btn sm" onClick={() => { void patchBlock(c.b.id, { start: c.a.end, end: c.a.end + (c.b.end - c.b.start) }, 'move'); done('move'); }}>{m.day.moveAfter(c.b.title)}</button>
        <button type="button" className="btn sm" onClick={() => { void patchBlock(c.a.id, { end: Math.max(c.a.start + 10, c.b.start) }, 'resize'); done('shorten'); }}>{m.day.shorten(c.a.title)}</button>
        <button type="button" className="btn sm ghost" onClick={() => { void deleteBlock(c.b.id); done('remove'); }}>{m.day.removeB(c.b.title)}</button>
        <button type="button" className="btn sm ghost" onClick={() => { void keepOverlap(dayId, overlapKey(c.a, c.b)); done('keep'); }}>{m.day.keepBoth}</button>
      </div>
    </section>
  );
}

/** Optional reason for the latest plan change (CAP-D5): one tap or ignore. */
export function ReasonPrompt({ revId, label, onDone }: { revId: string; label: string; onDone: () => void }) {
  const [other, setOther] = useState(false);
  const [text, setText] = useState('');
  const pick = (r: string) => { void setRevisionReason(revId, r); onDone(); };
  return (
    <section className="card reason">
      <div className="head"><span className="label">{label}</span><button type="button" className="btn icon sm ghost" onClick={onDone} aria-label="Dismiss"><X size={14} /></button></div>
      <span className="hint">{m.day.why}</span>
      {other ? (
        <form className="row" onSubmit={e => { e.preventDefault(); if (text.trim()) pick(text.trim()); }}>
          <input className="input" autoFocus value={text} onChange={e => setText(e.target.value)} />
          <button type="submit" className="btn sm">OK</button>
        </form>
      ) : (
        <div className="row wrap">
          {m.day.reasons.map(r => <button key={r} type="button" className="chip" onClick={() => pick(r)}>{r}</button>)}
          <button type="button" className="chip" onClick={() => setOther(true)}>{m.day.reasonOther}</button>
        </div>
      )}
    </section>
  );
}

/** Replan remaining day (CAP-D3): preview the deterministic proposal, then apply as one revision. */
export function ReplanModal({ dayId, blocks, records, minute, onClose }: { dayId: string; blocks: DayBlock[]; records: TimeRecord[]; minute: number; onClose: () => void }) {
  const [removeDropped, setRemoveDropped] = useState(false);
  const proposal = replanRemaining(blocks, records, minute, 24 * 60);
  const byId = new Map(blocks.map(b => [b.id, b]));
  return (
    <Modal onClose={() => { track('replan_remaining_used', { accepted: false }); onClose(); }} label={m.day.replanTitle}>
      <div className="head"><b className="row"><RefreshCw size={15} />{m.day.replanTitle}</b><button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <p className="hint" style={{ margin: 0 }}>{m.day.replanHint}</p>
      {proposal.moves.length === 0 && proposal.dropped.length === 0 ? <p>{m.day.replanNothing}</p> : (
        <>
          {proposal.moves.length > 0 && <span className="label">{m.day.replanMoves(proposal.moves.length)}</span>}
          <ul className="replan-list">
            {proposal.moves.map(mv => { const b = byId.get(mv.id)!; return <li key={mv.id} className="tabular"><b>{b.title}</b> {fmtMin(b.start)} → {fmtMin(mv.start)}–{fmtMin(mv.end)}</li>; })}
          </ul>
          {proposal.dropped.length > 0 && (
            <>
              <span className="label">{m.day.replanDrop(proposal.dropped.length)}</span>
              <ul className="replan-list">{proposal.dropped.map(id => <li key={id}>{byId.get(id)?.title}</li>)}</ul>
              <label className="row"><input type="checkbox" checked={removeDropped} onChange={e => setRemoveDropped(e.target.checked)} />{m.day.replanRemoveDropped}</label>
            </>
          )}
          <div className="row"><button type="button" className="btn primary sm" onClick={async () => { await applyReplan(dayId, proposal, removeDropped); onClose(); }}>{m.day.replanApply}</button></div>
        </>
      )}
    </Modal>
  );
}

/** Untracked time, newest first, with the one-tap fixes: as planned, or pick what it was (US-TIME-008). */
export function GapsCard({ dayId, blocks, records, areas, until, empty = [] }: { dayId: string; blocks: DayBlock[]; records: TimeRecord[]; areas: Area[]; until: number; empty?: Span[] }) {
  const [picking, setPicking] = useState<Span | null>(null);
  const sleeps = useSleeps();
  const gaps = dayGaps(blocks, records, until, 15, [...sleepSpans(dayId, sleeps, until), ...empty]).reverse();
  if (!gaps.length) return null;
  const total = gaps.reduce((s, g) => s + g.end - g.start, 0);
  const shown = gaps.slice(0, 2);
  return (
    <section className="card gaps">
      <div className="head"><span className="label">{m.record.noRecord}</span><span className="hint tabular">{fmtDuration(total)}</span></div>
      {shown.map(g => (
        <div key={g.start} className="gap-row">
          <span className="tabular">{fmtMin(g.start)}–{fmtMin(g.end)} <span className="muted">· {fmtDuration(g.end - g.start)}</span></span>
          <span className="row">
            <button type="button" className="btn sm" onClick={() => void acceptPlanAsReal(dayId, until, g, 'gaps_card')}>{m.record.fromPlan}</button>
            <button type="button" className="btn sm ghost" onClick={() => setPicking(g)}>{m.record.other}</button>
            <button type="button" className="btn icon sm ghost" aria-label={m.close.leaveEmpty} title={m.close.leaveEmpty} onClick={() => void leaveGapEmpty(dayId, g)}><X size={13} /></button>
          </span>
        </div>
      ))}
      {gaps.length > 1 && (
        <button type="button" className="btn sm ghost" onClick={() => void acceptPlanAsReal(dayId, until, undefined, 'gaps_card_all')}>{m.record.allAsPlanned(gaps.length)}</button>
      )}
      {picking && (
        <QuickSwitch areas={areas} title={`${fmtMin(picking.start)}–${fmtMin(picking.end)}`} onClose={() => setPicking(null)}
          onPick={(areaId, title) => { void addRecord(dayId, { start: picking.start, end: picking.end, areaId, title }, 'manual'); track('gap_filled', { method: 'area', gap_min: picking.end - picking.start }); setPicking(null); }} />
      )}
    </section>
  );
}

/** Save the day as a weekday template (E12, Q-23). */
export function SaveTemplateModal({ dayId, count, onClose }: { dayId: string; count: number; onClose: () => void }) {
  const [tid, setTid] = useState<DayKey>(templateIdForDate(dayId));
  const [done, setDone] = useState<number | null>(null);
  return (
    <Modal onClose={onClose} label={m.day.saveTemplate}>
      <div className="head"><b>{m.day.saveTemplate}</b><button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      {done != null ? <p>{m.day.savedTemplate(done, m.templates.names[tid])}</p> : (
        <>
          <p className="hint" style={{ margin: 0 }}>{m.day.saveTemplateHint(count)}</p>
          <div className="seg">{DAY_KEYS.map(k => <button key={k} type="button" aria-pressed={tid === k} onClick={() => setTid(k)}>{m.templates.short[k]}</button>)}</div>
          <div className="row"><button type="button" className="btn primary sm" onClick={async () => setDone(await saveDayAsTemplate(dayId, tid))}>{m.templates.copyConfirm('this day', m.templates.names[tid])}</button></div>
        </>
      )}
    </Modal>
  );
}
