'use client';
import { sleepSpans } from '@/lib/sleep';
import { useSleeps, useSleepTarget } from '@/components/day/Sleep';
import { buildNightLayers } from '@/components/day/nightLayers';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { Timeline, type TLItem } from '@/components/Timeline';
import { QuickSwitch } from '@/components/day/QuickSwitch';
import { RecordInspector } from '@/components/day/Inspectors';
import { Summary } from '@/components/day/Summary';
import { useDay } from '@/components/day/useDay';
import { m } from '@/i18n/en';
import { dayGaps, type Span } from '@/lib/actual';
import { track } from '@/lib/analytics';
import { useClock, useIsMobile } from '@/lib/hooks';
import { acceptPlanAsReal, addRecord, closeDay, toggleTaskDone, updateRecord } from '@/lib/ops';
import { dateFromIso, fmtDuration, fmtMin } from '@/lib/time';

function ClosePageInner() {
  const dayId = useSearchParams().get('d') ?? '';
  const router = useRouter();
  const d = useDay(dayId);
  const { day: today, minute } = useClock();
  const isMobile = useIsMobile();
  const [step, setStep] = useState(0);
  const [t0] = useState(() => Date.now());
  const [sel, setSel] = useState<string | null>(null);
  const [picking, setPicking] = useState<Span | null>(null);
  const [energy, setEnergy] = useState<number | undefined>();
  const [wentWell, setWentWell] = useState('');
  const [change, setChange] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { track('day_close_started', { day: dayId, days_ago: dayId === today ? 0 : 1 }); }, [dayId, today]);

  const until = dayId === today ? minute : 28 * 60;
  const sleeps = useSleeps();
  const sleepTarget = useSleepTarget();
  const gaps = useMemo(() => dayGaps(d.blocks, d.records, until, 5, sleepSpans(dayId, sleeps, until)), [d.blocks, d.records, until, sleeps, dayId]);
  const gapMin = gaps.reduce((s, g) => s + g.end - g.start, 0);

  if (!d.ready) return <div className="page" />;
  const label = dateFromIso(dayId).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const openTasks = d.tasks.filter(t => t.status !== 'done');
  const doneTasks = d.tasks.filter(t => t.status === 'done');

  async function finish() {
    setBusy(true);
    const reflection = energy || wentWell.trim() || change.trim() ? { energy, wentWell: wentWell.trim() || undefined, change: change.trim() || undefined } : undefined;
    await closeDay(dayId, reflection, t0);
    track('close_steps', { steps_completed: step + 1, gaps_left_min: gapMin });
    router.push(dayId === today ? '/' : `/day?d=${dayId}`);
  }

  const realItems: TLItem[] = d.records.map(r => ({ id: r.id, start: r.start, end: r.end ?? Math.max(r.start + 1, until), title: r.title, areaId: r.areaId, variant: r.end == null ? 'running' : 'real' }));
  const selRec = d.records.find(r => r.id === sel);
  const sky = buildNightLayers(dayId, sleeps, sleepTarget, d.day?.wakeAt, until);

  return (
    <div className="page close-page">
      <header className="page-head">
        <div>
          <Link href={dayId === today ? '/' : `/day?d=${dayId}`} className="back-link" style={{ display: 'inline-flex' }}><ChevronLeft size={18} />{dayId === today ? m.today.title : label}</Link>
          <h1>{m.close.title}</h1>
          <div className="sub"><span>{label}</span></div>
        </div>
        <ol className="stepper">
          {m.close.steps.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''}>
              <button type="button" onClick={() => setStep(i)}>{i < step ? <Check size={12} /> : <span>{i + 1}</span>}{s}</button>
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <div className="close-grid">
          <div className="close-side">
            <section className="card stack">
              <b>{m.close.realTitle}</b>
              <span className="hint">{m.close.realHint}</span>
              {gaps.length === 0 ? <span className="ok-line"><Check size={14} />{m.close.noGaps}</span> : (
                <>
                  <span className="label">{m.close.gaps(gaps.length, fmtDuration(gapMin))}</span>
                  {gaps.map(g => (
                    <div key={g.start} className="gap-row">
                      <span className="tabular">{fmtMin(g.start)}–{fmtMin(g.end)} <span className="muted">· {fmtDuration(g.end - g.start)}</span></span>
                      <span className="row">
                        <button type="button" className="btn sm" onClick={() => void acceptPlanAsReal(dayId, until, g, 'close')}>{m.record.fromPlan}</button>
                        <button type="button" className="btn sm ghost" onClick={() => setPicking(g)}>{m.record.other}</button>
                      </span>
                    </div>
                  ))}
                  <button type="button" className="btn primary sm" onClick={() => void acceptPlanAsReal(dayId, until, undefined, 'close')}>{m.close.acceptAll}</button>
                </>
              )}
            </section>
            {!isMobile && selRec && <RecordInspector record={selRec} areas={d.areas} closed={false} onClose={() => setSel(null)} />}
          </div>
          <Timeline
            columns={[
              { id: 'plan', label: m.day.cols.plan, items: d.blocks.map(b => ({ ...b, variant: 'ghost' as const })), editable: false, nights: sky.planNights, marks: sky.planMarks },
              { id: 'real', label: m.day.cols.real, items: realItems, editable: true, nights: sky.realNights, marks: sky.realMarks },
            ]}
            areas={d.areaMap}
            nowMin={dayId === today ? minute : null}
            selectedId={sel}
            onSelect={id => setSel(id)}
            onCreate={(c, s, e) => { if (c === 'real') { const p = d.blocks.find(b => b.start <= s && s < b.end); void addRecord(dayId, { start: s, end: e, areaId: p?.areaId ?? 'area-personal', title: p?.title ?? '', blockId: p?.id }, 'close'); } }}
            onChange={(_c, id, s, e) => { const r = d.records.find(x => x.id === id); if (r) void updateRecord(id, r.end == null ? { start: s } : { start: s, end: e }, 'close_drag'); }}
            pxPerMin={isMobile ? 0.8 : 0.9}
          />
          {isMobile && selRec && (
            <>
              <div className="sheet-backdrop" onClick={() => setSel(null)} />
              <div className="sheet">{<RecordInspector record={selRec} areas={d.areas} closed={false} onClose={() => setSel(null)} />}</div>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <section className="card stack narrow">
          <b>{m.close.tasksTitle}</b>
          <span className="hint">{m.close.tasksHint}</span>
          {d.tasks.length === 0 ? <span className="secondary">{m.close.noTasks}</span> : (
            <div className="task-list">
              {[...openTasks, ...doneTasks].map(t => (
                <label key={t.id} className={`task-row${t.status === 'done' ? ' is-done' : ''}`} data-color={d.areaMap.get(t.areaId ?? '')?.color ?? 'gray'}>
                  <input type="checkbox" checked={t.status === 'done'} onChange={() => void toggleTaskDone(t.id)} />
                  <span className="task-title"><span>{t.title}</span></span>
                  <span className="task-meta muted">{t.status === 'done' ? m.tasks.lists.done : m.tasks.lists.backlog}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="card stack narrow">
          <b>{m.close.reflectTitle}</b>
          <div className="field"><span>{m.close.energy}</span>
            <div className="row">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" className="chip" aria-pressed={energy === n} onClick={() => setEnergy(energy === n ? undefined : n)}>{n}</button>)}</div>
          </div>
          <label className="field"><span>{m.close.wentWell}</span><textarea className="input" value={wentWell} onChange={e => setWentWell(e.target.value)} /></label>
          <label className="field"><span>{m.close.change}</span><textarea className="input" value={change} onChange={e => setChange(e.target.value)} /></label>
        </section>
      )}

      {step === 3 && <Summary d={d} until={until} />}

      <div className="close-nav">
        {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>{m.close.back}</button>}
        <span className="spacer" />
        {step === 2 && <button type="button" className="btn ghost" onClick={() => setStep(3)}>{m.close.skip}</button>}
        {step < 3
          ? <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>{m.close.next}</button>
          : <button type="button" className="btn primary" disabled={busy || d.status === 'closed'} onClick={() => void finish()}><Check size={15} />{m.close.finish}</button>}
      </div>
      {picking && (
        <QuickSwitch areas={d.areas} title={`${fmtMin(picking.start)}–${fmtMin(picking.end)}`} onClose={() => setPicking(null)}
          onPick={(areaId, title) => { void addRecord(dayId, { start: picking.start, end: picking.end, areaId, title }, 'close'); track('gap_filled', { method: 'area', gap_min: picking.end - picking.start }); setPicking(null); }} />
      )}
    </div>
  );
}

export default function ClosePage() {
  return <Suspense fallback={<div className="page" />}><ClosePageInner /></Suspense>;
}
