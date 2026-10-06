'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LayoutTemplate, ListChecks, Moon, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { SyncBadge } from '@/components/AppShell';
import { m } from '@/i18n/en';
import { blockActual, countedPauses, coveredIn, emptyLeft, openOverlaps } from '@/lib/actual';
import { track } from '@/lib/analytics';
import { NEW_BLOCK_MIN } from '@/lib/config';
import { useClock, useIsMobile } from '@/lib/hooks';
import { addBlock, addRecord, deleteBlock, patchBlock, reopenDay, scheduleTask, updateRecord } from '@/lib/ops';
import { getDB } from '@/lib/db';
import { dateAtMinute, fmtDuration, fmtMin, minuteOfDay } from '@/lib/time';
import type { DayBlock, Revision } from '@/lib/types';
import { Timeline, type ChangeKind, type TLColumn, type TLItem } from '../Timeline';
import { blockMenu, recordMenu } from '../menus';
import { cutoffHour } from '@/lib/time';
import { MorningPrompt, NightStrip, SleepSheet, useSleeps, useSleepTarget } from './Sleep';
import { buildNightLayers } from './nightLayers';
import { clockOf, mainSleeps, targetSpan } from '@/lib/sleep';
import { addDays } from '@/lib/time';
import type { TLMark, TLNight } from '../Timeline';
import { useDraggedTask } from '../tasks/dragState';
import { ChangesCard, ConflictsCard, GapsCard, ReasonPrompt, NotPlannedCard, ReplanModal, SaveTemplateModal, StartDayCard } from './Cards';
import { DayTasks } from './DayTasks';
import { BlockInspector, RecordInspector } from './Inspectors';
import { NowCard } from './NowCard';
import { Summary } from './Summary';
import { useDay, useLive } from './useDay';
import { useCalStatus } from './useCalendar';
import { CalendarStatusBanner } from './CalendarCards';

const DEFAULT_AREA = 'area-personal';
export type DayViewMode = 'plan' | 'real' | 'compare';

interface Props {
  dayId: string;
  /** Today: NOW line, live tracking and Now/Next. History: the whole day, editable. */
  live: boolean;
  title: ReactNode;
  sub?: ReactNode;
  /** Extra cards at the top of the side column (yesterday card, check-in…). */
  sideTop?: ReactNode;
  sideBottom?: ReactNode;
  headExtra?: ReactNode;
}

function readMode(): DayViewMode | null {
  try { return (localStorage.getItem('df-view') as DayViewMode | null) ?? null; } catch { return null; }
}

export function DayView({ dayId, live, title, sub, sideTop, sideBottom, headExtra }: Props) {
  const d = useDay(dayId);
  const calStatus = useCalStatus();
  const { running, alongside, focus } = useLive();
  const { minute: clockMin } = useClock();
  const isMobile = useIsMobile();
  const dragged = useDraggedTask();
  const [mode, setModeState] = useState<DayViewMode | null>(readMode);
  const [sel, setSel] = useState<{ id: string; col: string } | null>(null);
  const [reason, setReason] = useState<{ revId: string; label: string } | null>(null);
  const [mismatch, setMismatch] = useState<{ taskId: string; title: string; target?: DayBlock; blockId: string; taskArea: string; blockArea: string } | null>(null);
  const [replan, setReplan] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);
  const prefs = useLiveQuery(() => getDB().prefs.get('prefs'), []);
  const sleeps = useSleeps();
  const sleepTarget = useSleepTarget();
  const [sleepNight, setSleepNight] = useState<string | null>(null);
  const density = prefs?.density === 'compact' ? 0.75 : prefs?.density === 'roomy' ? 1.6 : 1;
  const scrolled = useRef(false);

  const started = d.status !== 'unplanned';
  const view: DayViewMode = mode ?? (started ? 'real' : 'plan');
  function setMode(v: DayViewMode) {
    setModeState(v);
    try { localStorage.setItem('df-view', v); } catch { /* private mode */ }
    track(v === 'compare' ? 'compare_viewed' : 'day_view_changed', { mode: v, live });
  }

  const nowMin = live ? clockMin : null;
  const until = live ? clockMin : 28 * 60;

  // Scroll so the NOW line sits in the upper third, once per visit.
  useEffect(() => {
    if (scrolled.current || !d.ready || !live) return;
    scrolled.current = true;
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-now]');
      if (el && window.matchMedia('(min-width: 821px)').matches) {
        // Desktop: the timeline scrolls in its own column (the page itself does not scroll).
        const wrap = el.closest<HTMLElement>('.tl-wrap');
        if (wrap) wrap.scrollTop += el.getBoundingClientRect().top - wrap.getBoundingClientRect().top - wrap.clientHeight * 0.3;
      }
    });
  }, [d.ready, live]);

  const conflicts = useMemo(() => openOverlaps(d.blocks, d.day?.keptOverlaps), [d.blocks, d.day?.keptOverlaps]);

  const columns: TLColumn[] = useMemo(() => {
    const showDiff = started && view !== 'plan';
    const planItems: TLItem[] = d.blocks.map(b => {
      // A planned Sleep block reads as the night it is, not as one more block (note #29).
      const item: TLItem = { ...b, ...(b.areaId === 'area-sleep' ? { variant: 'night' as const } : {}) };
      const myTasks = d.tasks.filter(t => t.blockId === b.id);
      // Only recorded time is judged, and only once the block is over (no record ≠ skipped; a block
      // under way is not skipped yet). Until then the corner shows its to-dos.
      const covered = showDiff && b.end <= until ? coveredIn({ start: b.start, end: b.end }, d.records, until) : 0;
      if (covered >= 5) {
        const { same } = blockActual(b, d.records, until);
        if (same === 0) { item.badge = m.day.skipped; item.badgeTone = 'warn'; }
        else if (covered - same >= 15) { item.badge = `−${fmtDuration(covered - same)}`; item.badgeTone = 'warn'; }
      }
      if (!item.badge && myTasks.length) {
        const est = myTasks.filter(t => t.status !== 'done').reduce((s, t) => s + (t.estimate ?? 0), 0);
        const done = myTasks.filter(t => t.status === 'done').length;
        item.badge = `${done}/${myTasks.length}`;
        item.badgeTone = est > b.end - b.start ? 'warn' : 'muted';
      }
      return item;
    });
    const realItems: TLItem[] = d.records.map(r => ({
      id: r.id, start: r.start, end: r.end ?? Math.max(r.start + 1, until), title: r.title, areaId: r.areaId,
      variant: r.end == null ? 'running' : 'real',
    }));
    // Pauses (10 min or more) are striped holes inside the activity (note #33).
    const base = dateAtMinute(dayId, 0).getTime();
    for (const r of realItems) {
      const rec = d.records.find(x => x.id === r.id);
      const holes = countedPauses(rec ?? {}, base + until * 60000).map(p => ({ start: Math.max(r.start, (p.from - base) / 60000), end: Math.min(r.end, ((p.to ?? base + until * 60000) - base) / 60000) })).filter(h => h.end > h.start);
      if (holes.length) r.holes = holes;
    }
    const empties = emptyLeft(d.day?.emptySpans, d.records, until);
    const { realNights, realMarks, planNights, planMarks } = buildNightLayers(dayId, sleeps, sleepTarget, d.day?.wakeAt, until);
    if (view === 'plan') return [{ id: 'plan', items: planItems, editable: true, nights: planNights, marks: planMarks }];
    if (view === 'real') return [
      { id: 'plan', label: m.day.cols.plan, items: planItems, editable: true, nights: planNights, marks: planMarks },
      { id: 'real', label: m.day.cols.real, items: realItems, editable: true, nights: realNights, marks: realMarks, empties },
    ];
    return [
      { id: 'baseline', label: m.day.cols.baseline, items: (d.day?.baseline ?? []).map(b => ({ ...b, variant: 'ghost' as const })), editable: false },
      { id: 'plan', label: m.day.cols.final, items: planItems, editable: true, nights: planNights, marks: planMarks },
      { id: 'real', label: m.day.cols.real, items: realItems, editable: true, nights: realNights, marks: realMarks, empties },
    ];
  }, [d.blocks, d.records, d.tasks, d.day?.baseline, view, started, until, sleeps, sleepTarget, dayId, d.day?.wakeAt, d.day?.emptySpans]);

  function afterRevision(revId: string | null, label: string) {
    if (revId) setReason({ revId, label });
  }

  async function onCreate(col: string, start: number, end: number) {
    if (col === 'plan') {
      // Named after its area until renamed (note #21).
      const title = d.areaMap.get(DEFAULT_AREA)?.name ?? m.inspector.newBlock;
      const { id, revId } = await addBlock(dayId, { start, end, title, areaId: DEFAULT_AREA });
      track('block_created', { area: DEFAULT_AREA, duration_min: end - start, from_template: false, surface: 'timeline' });
      setSel({ id, col: 'plan' });
      afterRevision(revId, `${m.day.revKinds.add}: ${title}`);
    } else if (col === 'real') {
      const plan = d.blocks.find(b => b.start <= start && start < b.end);
      const rec = await addRecord(dayId, { start, end, areaId: plan?.areaId ?? DEFAULT_AREA, title: plan?.title ?? '', blockId: plan?.id }, 'manual');
      setSel({ id: rec.id, col: 'real' });
    }
  }

  async function onChange(col: string, id: string, start: number, end: number, kind: ChangeKind) {
    if (col === 'real') {
      const r = d.records.find(x => x.id === id);
      if (!r) return;
      await updateRecord(id, r.end == null ? { start } : { start, end }, kind);
      return;
    }
    const b = d.blocks.find(x => x.id === id);
    if (!b) return;
    const revKind: Revision['kind'] = kind === 'move' ? 'move' : 'resize';
    const revId = await patchBlock(id, { start, end }, revKind);
    if (kind === 'move') track('block_moved', { delta_min: start - b.start, from_template: !!b.fromTemplate, area: b.areaId, started });
    else track('block_resized', { delta_min: (end - start) - (b.end - b.start), edge: kind, from_template: !!b.fromTemplate, area: b.areaId, started });
    afterRevision(revId, `${b.title} ${fmtMin(start)}–${fmtMin(end)}`);
  }

  async function onPatchBlock(b: DayBlock, patch: Partial<DayBlock>, kind: Revision['kind']) {
    const revId = await patchBlock(b.id, patch, kind);
    if (kind === 'rename') track('block_renamed', { from_template: !!b.fromTemplate, area: b.areaId });
    else if (kind === 'area') track('block_area_changed', { from: b.areaId, to: patch.areaId, from_template: !!b.fromTemplate });
    else if (kind === 'fixed') track('block_fixed_toggled', { fixed: !!patch.fixed });
    else track(kind === 'move' ? 'block_moved' : 'block_resized', { from_template: !!b.fromTemplate, area: b.areaId, surface: 'inspector' });
    if (kind !== 'fixed' && kind !== 'rename') afterRevision(revId, `${b.title}: ${m.day.revKinds[kind]}`);
  }

  async function onDeleteBlock(b: DayBlock) {
    setSel(null);
    const revId = await deleteBlock(b.id);
    track('block_deleted', { area: b.areaId, duration_min: b.end - b.start, from_template: !!b.fromTemplate });
    afterRevision(revId, `${m.day.revKinds.remove}: ${b.title}`);
  }

  async function onDropTask(taskId: string, _col: string, minute: number, dropOn?: string) {
    const blockId = dropOn?.startsWith('ev:') ? undefined : dropOn;
    const task = await getDB().tasks.get(taskId);
    if (!task) return;
    if (blockId) {
      const b = d.blocks.find(x => x.id === blockId);
      await scheduleTask(taskId, dayId, blockId, 'drag');
      if (b && task.areaId && task.areaId !== b.areaId) {
        const target = d.blocks.find(x => x.areaId === task.areaId && x.end > (nowMin ?? 0));
        track('task_area_mismatch', { has_target: !!target });
        setMismatch({ taskId, title: task.title, target, blockId, taskArea: d.areaMap.get(task.areaId)?.name ?? '', blockArea: d.areaMap.get(b.areaId)?.name ?? '' });
      }
      return;
    }
    // Task → empty slot: a block for it (spec §71).
    const len = task.estimate && task.estimate >= 15 ? task.estimate : 60;
    const { id, revId } = await addBlock(dayId, { start: minute, end: minute + len, title: task.title, areaId: task.areaId ?? DEFAULT_AREA });
    await scheduleTask(taskId, dayId, id, 'slot');
    afterRevision(revId, `${m.day.revKinds.add}: ${task.title}`);
  }

  // Keyboard: B new block, Esc deselect, Delete removes the selected block/record.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal')) return;
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        const base = nowMin != null ? Math.ceil(nowMin / 30) * 30 : 9 * 60;
        void onCreate('plan', base, base + NEW_BLOCK_MIN);
        return;
      }
      if (!sel) return;
      if (e.key === 'Escape') setSel(null);
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const b = d.blocks.find(x => x.id === sel.id);
        if (b) void onDeleteBlock(b);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!d.ready) return <div className="page" />;

  const selBlock = sel?.col === 'plan' ? d.blocks.find(b => b.id === sel.id) : undefined;
  const selRec = sel?.col === 'real' ? d.records.find(r => r.id === sel.id) : undefined;
  const inspector = selBlock ? (
    <BlockInspector key={selBlock.id} dayId={dayId} block={selBlock} areas={d.areas} areaMap={d.areaMap} tasks={d.tasks} revisions={d.revisions}
      live={live} started={started} running={running} onClose={() => setSel(null)}
      onPatch={(p, k) => void onPatchBlock(selBlock, p, k)} onDelete={() => void onDeleteBlock(selBlock)} />
  ) : selRec ? (
    <RecordInspector key={selRec.id} record={selRec} areas={d.areas} closed={d.status === 'closed'} onClose={() => setSel(null)} />
  ) : null;

  const templateName = m.templates.names[d.day?.templateId ?? ''] ?? '';
  const after = (
    <>
          <DayTasks dayId={dayId} tasks={d.tasks} areaMap={d.areaMap} showBacklog={live} />
          {started && <ChangesCard dayId={dayId} plannedWake={d.day?.wakeAt} baseline={d.day?.baseline} blocks={d.blocks} records={d.records} until={until} areaMap={d.areaMap} />}
          {!live && (d.records.length > 0 || d.status === 'closed') && <Summary d={d} until={until} />}
          {!live && d.revisions.length > 0 && (
            <section className="card stack">
              <span className="label">{m.day.history} · {d.revisions.length}</span>
              <ol className="rev-list">
                {d.revisions.map(r => (
                  <li key={r.id}><span className="tabular muted">{new Date(r.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    <span>{m.day.revKinds[r.kind]} · {r.title}{r.before && r.after && (r.before.start !== r.after.start || r.before.end !== r.after.end) ? ` ${fmtMin(r.before.start)}–${fmtMin(r.before.end)} → ${fmtMin(r.after.start)}–${fmtMin(r.after.end)}` : ''}</span>
                    {r.reason && <span className="pill" data-color="blue">{r.reason}</span>}</li>
                ))}
              </ol>
            </section>
          )}
          {sideBottom}
    </>
  );

  return (
    <div className="page day-page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          <div className="sub">
            {sub}
            {templateName && <><span>·</span><span>{m.today.template(templateName)}</span></>}
            <span className={`status-pill s-${d.status}`}>{m.day.status[d.status]}</span>
          </div>
        </div>
        <div className="row wrap head-actions">
          <span className="sheet-only"><SyncBadge /></span>
          {headExtra}
          <div className="seg" role="group" aria-label="View">
            {(['plan', 'real', 'compare'] as const).map(v => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setMode(v)}>{m.day.views[v]}</button>
            ))}
          </div>
          {/* Planning is for a day without a plan yet; once it has one (Baseline), changes go through Replan. */}
          {live && d.status !== 'closed' && !d.day?.baseline && (
            <Link href={`/plan?d=${dayId}`} className="btn sm ghost" title={m.day.plan}><ListChecks size={14} /><span className="desk-only">{m.day.plan}</span></Link>
          )}
          {live && d.status === 'active' && (
            <button type="button" className="btn sm" onClick={() => setReplan(true)} title={m.day.replan}><RefreshCw size={14} /><span className="desk-only">{m.day.replan}</span></button>
          )}
          {d.status === 'active' && <Link href={`/close?d=${dayId}`} className="btn sm"><Moon size={14} />{m.day.close}</Link>}
          {view === 'plan' && d.blocks.length > 0 && (
            <button type="button" className="btn sm ghost" onClick={() => setSaveTpl(true)} title={m.day.saveTemplate}><LayoutTemplate size={14} /><span className="desk-only">{m.day.saveTemplate}</span></button>
          )}
          {d.status === 'closed' && <button type="button" className="btn sm" onClick={() => void reopenDay(dayId)}><RotateCcw size={14} />{m.day.reopen}</button>}
          <button type="button" className="btn sm" onClick={() => { const base = nowMin != null ? Math.ceil(nowMin / 30) * 30 : 9 * 60; void onCreate('plan', base, base + NEW_BLOCK_MIN); }}>
            <Plus size={15} />{m.today.addBlock}
          </button>
        </div>
      </header>
      {sleepNight && <SleepSheet key={sleepNight} sleep={mainSleeps(sleeps).get(sleepNight) ?? null} night={sleepNight} tonight={sleepNight === dayId} onClose={() => setSleepNight(null)} />}
      <div className="today">
        <div className="today-side">
          {sideTop}
          {live && d.status === 'active' && d.day?.startMode === 'implicit' && <NotPlannedCard dayId={dayId} startedAt={d.day.startedAt} />}
          {live && d.status === 'unplanned' && <StartDayCard dayId={dayId} blocks={d.blocks} templateName={templateName} minute={clockMin} />}
          {live && <MorningPrompt dayId={dayId} minute={clockMin} />}
          {live && <NowCard dayId={dayId} minute={clockMin} blocks={d.blocks} tasks={d.tasks} areas={d.areas} areaMap={d.areaMap} running={running} alongside={alongside} focus={focus} />}
          {reason && <ReasonPrompt key={reason.revId} revId={reason.revId} label={reason.label} onDone={() => setReason(null)} />}
          {mismatch && (
            <section className="card reason">
              <span>{m.day.mismatch(mismatch.title, mismatch.taskArea, mismatch.blockArea)}</span>
              <div className="row wrap">
                {mismatch.target && (
                  <button type="button" className="btn sm" onClick={() => { void scheduleTask(mismatch.taskId, dayId, mismatch.target!.id, 'mismatch'); track('task_area_mismatch_resolved', { action: 'move' }); setMismatch(null); }}>
                    {m.day.moveTo(mismatch.taskArea, fmtMin(mismatch.target.start))}
                  </button>
                )}
                <button type="button" className="btn sm ghost" onClick={() => { track('task_area_mismatch_resolved', { action: 'keep' }); setMismatch(null); }}>{m.day.keepHere}</button>
              </div>
            </section>
          )}
          {(started || d.records.length > 0) && <GapsCard dayId={dayId} blocks={d.blocks} records={d.records} areas={d.areas} until={until} empty={d.day?.emptySpans} />}
          {live && <CalendarStatusBanner problems={calStatus.results.filter(r => r.error)} />}
          {conflicts.length > 0 && <ConflictsCard dayId={dayId} conflicts={conflicts} />}
          {!isMobile && inspector}
          {!isMobile && after}
          {/* Last night / Tonight: the end of Today's left column (note #39). */}
          <NightStrip dayId={dayId} side />

        </div>
        <Timeline
          columns={columns}
          onMark={mk => setSleepNight(mk.night ?? null)}
          areas={d.areaMap}
          nowMin={nowMin}
          selectedId={sel?.id ?? null}
          onSelect={(id, col) => { setSel(id ? { id, col: col ?? 'plan' } : null); }}
          onItemMenu={(id, col) => {
            if (col === 'plan') {
              const b = d.blocks.find(x => x.id === id);
              return b ? blockMenu(b, { dayId, live, areas: d.areas, edit: () => setSel({ id, col }), patch: (p, k) => onPatchBlock(b, p, k), remove: () => onDeleteBlock(b) }) : null;
            }
            const r = d.records.find(x => x.id === id);
            return r ? recordMenu(r, { dayId, live, areas: d.areas, blocks: d.blocks, edit: () => setSel({ id, col: 'real' }) }) : null;
          }}
          onCreate={(c, s, e) => void onCreate(c, s, e)}
          onChange={(c, id, s, e, k) => void onChange(c, id, s, e, k)}
          onDropTask={(t, c, mi, b) => void onDropTask(t, c, mi, b)}
          highlightArea={dragged?.areaId ?? null}
          pxPerMin={(isMobile ? 1 : 1.15) * density}
        />
        {isMobile && <div className="today-after">{after}</div>}
      </div>
      {isMobile && inspector && (
        <>
          <div className="sheet-backdrop" onClick={() => setSel(null)} />
          <div className="sheet" role="dialog" aria-label={m.inspector.title}>{inspector}</div>
        </>
      )}
      {saveTpl && <SaveTemplateModal dayId={dayId} count={d.blocks.length} onClose={() => setSaveTpl(false)} />}
      {replan && <ReplanModal dayId={dayId} blocks={d.blocks} records={d.records} minute={clockMin} onClose={() => setReplan(false)} />}
    </div>
  );
}
