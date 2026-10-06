'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, Play, Plus } from 'lucide-react';
import { Timeline } from '@/components/Timeline';
import { ConflictsCard } from '@/components/day/Cards';
import { DayTasks } from '@/components/day/DayTasks';
import { BlockInspector } from '@/components/day/Inspectors';
import { useDay, useOpenTasks } from '@/components/day/useDay';
import { useDraggedTask } from '@/components/tasks/dragState';
import { TaskRow } from '@/components/tasks/TaskRow';
import { m } from '@/i18n/en';
import { capacity, openOverlaps, recEnd } from '@/lib/actual';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { useClock, useIsMobile } from '@/lib/hooks';
import { addBlock, adoptPlan, deleteBlock, patchBlock, scheduleTask, setWake, startDay } from '@/lib/ops';
import { ensureDay } from '@/lib/repo';
import { addDays, dateFromIso, fmtDuration, fmtMin, parseHHMM } from '@/lib/time';

/** Guided planning (E5): Context → Build the day → Conflicts → Start. Every step can be skipped. */
function PlanInner() {
  const params = useSearchParams();
  const { day: today, minute } = useClock();
  const dayId = params.get('d') || today;
  const router = useRouter();
  const d = useDay(dayId);
  const open = useOpenTasks(dayId);
  const isMobile = useIsMobile();
  const dragged = useDraggedTask();
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [t0] = useState(() => Date.now());
  const started = useRef(false);
  const stepRef = useRef(0);
  const yId = addDays(dayId, -1);
  const yDay = useLiveQuery(() => getDB().days.get(yId), [yId]);
  const yRecs = useLiveQuery(() => getDB().timeRecords.where('dayId').equals(yId).toArray(), [yId]);

  useEffect(() => {
    void ensureDay(dayId);
    track('day_planning_started', { mode: 'guided', hour: new Date().getHours(), for: dayId === today ? 'today' : 'other' });
    return () => { if (!started.current) track('planning_abandoned', { stage: stepRef.current }); };
  }, [dayId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stepRef.current = step; track('planning_stage_viewed', { stage: step }); }, [step]);

  const conflicts = useMemo(() => openOverlaps(d.blocks, d.day?.keptOverlaps), [d.blocks, d.day?.keptOverlaps]);
  const overCap = useMemo(() => d.blocks.map(b => ({ b, c: capacity(b, d.tasks) })).filter(x => x.c.over), [d.blocks, d.tasks]);

  if (!d.ready) return <div className="page" />;
  const isToday = dayId === today;
  const label = dateFromIso(dayId).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const carried = open.filter(t => (t.carried?.length ?? 0) > 0);
  const soon = addDays(dayId, 3);
  const deadlines = [...open, ...d.tasks].filter(t => t.due && t.due <= soon && t.status !== 'done');
  const inbox = open.filter(t => t.status === 'inbox');
  const yTracked = (yRecs ?? []).filter(r => !r.deleted).reduce((s, r) => s + (recEnd(r, r.start) - r.start), 0);
  const selBlock = d.blocks.find(b => b.id === sel);
  const wake = d.day?.wakeAt ?? (d.blocks.length ? Math.min(...d.blocks.map(b => b.start)) : 6 * 60);

  async function start() {
    started.current = true;
    if (isToday && d.status === 'unplanned') await startDay(dayId, 'guided', { planning_ms: Date.now() - t0, stage_reached: step });
    // First plan of a day that started implicitly (tracking before planning) becomes its Baseline.
    else if (!(await adoptPlan(dayId, 'guided', { planning_ms: Date.now() - t0, stage_reached: step }))) track('day_planned_ahead', { planning_ms: Date.now() - t0, blocks: d.blocks.length, tasks: d.tasks.length });
    router.push(isToday ? '/' : '/');
  }

  function goto(n: number) {
    if (n > step + 1) for (let s = step + 1; s < n; s++) track('planning_stage_skipped', { stage: s });
    setStep(n);
  }

  const areaMap = d.areaMap;
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <Link href="/" className="back-link" style={{ display: 'inline-flex' }}><ChevronLeft size={18} />{m.today.title}</Link>
          <h1>{isToday ? m.planning.title : m.planning.tomorrow}</h1>
          <div className="sub"><span>{m.planning.forDay(label)}</span>{d.status !== 'unplanned' && <span className={`status-pill s-${d.status}`}>{m.day.status[d.status]}</span>}</div>
        </div>
        <ol className="stepper">
          {m.planning.steps.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : ''}>
              <button type="button" onClick={() => goto(i)}>{i < step ? <Check size={12} /> : <span>{i + 1}</span>}{s}</button>
            </li>
          ))}
        </ol>
      </header>

      {step === 0 && (
        <div className="plan-ctx">
          <section className="card stack">
            <span className="label">{m.planning.wakeTitle}</span>
            <label className="field"><span>{m.planning.wakeAt}</span><input id="plan-wake" className="input tabular" type="time" value={fmtMin(wake)} onChange={e => { const v = parseHHMM(e.target.value); if (v != null) void setWake(dayId, v); }} /></label>
            <span className="hint">{m.planning.wakeHint}</span>
          </section>
          <section className="card stack">
            <span className="label">{yId === today ? m.planning.todayLabel : m.planning.yesterday}</span>
            {yDay ? (
              <>
                <span>{fmtDuration(yTracked)} tracked · <span className={`status-pill s-${yDay.status ?? 'unplanned'}`}>{m.day.status[yDay.status ?? 'unplanned']}</span></span>
                {yDay.reflection?.change && <blockquote className="quote">“{yDay.reflection.change}”</blockquote>}
                {yDay.status !== 'closed' && (yRecs?.length ?? 0) > 0 && <Link href={`/close?d=${yId}`} className="btn sm">{m.day.closeYesterday}</Link>}
              </>
            ) : <span className="hint">—</span>}
          </section>
          <section className="card stack">
            <span className="label">{m.tasks.continue}</span>
            {carried.length === 0 ? <span className="hint">—</span> : <div className="task-list">{carried.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} />)}</div>}
          </section>
          <section className="card stack">
            <span className="label">{m.planning.deadlines}</span>
            {deadlines.length === 0 ? <span className="hint">{m.planning.noDeadlines}</span> : <div className="task-list">{deadlines.map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} />)}</div>}
          </section>
          <section className="card stack">
            <div className="head row"><span className="label">{m.planning.inbox(inbox.length)}</span><span className="spacer" /><Link href="/tasks" className="btn sm ghost">{m.planning.triage}</Link></div>
            {inbox.length === 0 ? <span className="hint">{m.tasks.empty.inbox}</span> : <div className="task-list">{inbox.slice(0, 8).map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} />)}</div>}
          </section>
        </div>
      )}

      {step === 1 && (
        <div className="today">
          <div className="today-side">
            <p className="hint" style={{ margin: 0 }}>{m.planning.buildHint}</p>
            {!isMobile && selBlock && (
              <BlockInspector dayId={dayId} block={selBlock} areas={d.areas} areaMap={areaMap} tasks={d.tasks} revisions={d.revisions} live={false} started={d.status !== 'unplanned'}
                onClose={() => setSel(null)} onPatch={(p, k) => void patchBlock(selBlock.id, p, k)} onDelete={() => { void deleteBlock(selBlock.id); setSel(null); }} />
            )}
            <DayTasks dayId={dayId} tasks={d.tasks} areaMap={areaMap} title={m.planning.buildTitle} />
          </div>
          <Timeline
            columns={[{ id: 'plan', items: [...d.blocks.map(b => ({ ...b, badge: d.tasks.some(t => t.blockId === b.id) ? `${d.tasks.filter(t => t.blockId === b.id).length}` : undefined, badgeTone: capacity(b, d.tasks).over ? 'warn' as const : 'muted' as const }))], editable: true }]}
            areas={areaMap}
            nowMin={isToday ? minute : null}
            selectedId={sel}
            onSelect={id => setSel(id)}
            onCreate={async (_c, s, e) => { const { id } = await addBlock(dayId, { start: s, end: e, title: d.areaMap.get('area-personal')?.name ?? m.inspector.newBlock, areaId: 'area-personal' }); setSel(id); }}
            onChange={(_c, id, s, e, k) => void patchBlock(id, { start: s, end: e }, k === 'move' ? 'move' : 'resize')}
            onDropTask={async (taskId, _c, minute, blockId) => {
              if (blockId && !blockId.startsWith('ev:')) { await scheduleTask(taskId, dayId, blockId, 'planning'); return; }
              const t = await getDB().tasks.get(taskId);
              if (!t) return;
              const { id } = await addBlock(dayId, { start: minute, end: minute + (t.estimate && t.estimate >= 15 ? t.estimate : 60), title: t.title, areaId: t.areaId ?? 'area-personal' });
              await scheduleTask(taskId, dayId, id, 'planning_slot');
            }}
            highlightArea={dragged?.areaId ?? null}
            pxPerMin={isMobile ? 1 : 1.05}
          />
          {isMobile && selBlock && (
            <>
              <div className="sheet-backdrop" onClick={() => setSel(null)} />
              <div className="sheet"><BlockInspector dayId={dayId} block={selBlock} areas={d.areas} areaMap={areaMap} tasks={d.tasks} revisions={d.revisions} live={false} started={d.status !== 'unplanned'}
                onClose={() => setSel(null)} onPatch={(p, k) => void patchBlock(selBlock.id, p, k)} onDelete={() => { void deleteBlock(selBlock.id); setSel(null); }} /></div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="stack narrow">
          <b>{m.planning.conflictsTitle}</b>
          {conflicts.length === 0 && overCap.length === 0 && <span className="ok-line"><Check size={14} />{m.planning.noConflicts}</span>}
          {conflicts.length > 0 && <ConflictsCard dayId={dayId} conflicts={conflicts} />}
          {overCap.map(({ b, c }) => (
            <section key={b.id} className="card conflicts">
              <span className="label row"><AlertTriangle size={13} />{b.title}</span>
              <span>{m.planning.over(b.title, fmtDuration(c.estimated), fmtDuration(c.available))}</span>
              <div className="task-list">{d.tasks.filter(t => t.blockId === b.id && t.status !== 'done').map(t => <TaskRow key={t.id} task={t} areaMap={areaMap} dayId={dayId} />)}</div>
              <div className="row"><button type="button" className="btn sm" onClick={() => void patchBlock(b.id, { end: b.start + c.estimated }, 'resize')}><Plus size={13} />{fmtDuration(c.estimated)}</button></div>
            </section>
          ))}
        </div>
      )}

      {step === 3 && (
        <section className="card stack narrow">
          <b>{m.planning.startTitle}</b>
          <span className="secondary">{m.planning.startSummary(d.blocks.length, d.tasks.length)}</span>
          <div className="mini-plan">
            {d.blocks.map(b => (
              <div key={b.id} className="mini-row" data-color={areaMap.get(b.areaId)?.color ?? 'gray'}>
                <span className="dot" /><span className="tabular muted">{fmtDuration(b.end - b.start)}</span><span>{b.title}</span>
                <span className="muted">{d.tasks.filter(t => t.blockId === b.id).map(t => t.title).join(', ')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="close-nav">
        {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>{m.close.back}</button>}
        <span className="spacer" />
        {step < 3 && <button type="button" className="btn ghost" onClick={() => goto(3)}>{m.close.skip}</button>}
        {step < 3
          ? <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>{m.close.next}</button>
          : <button type="button" className="btn primary" onClick={() => void start()}><Play size={15} />{isToday && d.status === 'unplanned' ? m.day.start : m.planning.done}</button>}
      </div>
    </div>
  );
}

export default function PlanPage() {
  return <Suspense fallback={<div className="page" />}><PlanInner /></Suspense>;
}
