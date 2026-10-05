'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { diffEvents, externalConflicts, splitAround, type SeenEvent } from '@/lib/calendar/conflicts';
import { getDB, getMeta, setMeta } from '@/lib/db';
import { addBlock, deleteBlock, patchBlock, recordRevision } from '@/lib/ops';
import { save } from '@/lib/repo';
import { fmtDuration, fmtMin } from '@/lib/time';
import type { Area, CalClass, DayBlock } from '@/lib/types';
import { AreaPicker } from './Inspectors';
import type { DayEvent } from './useCalendar';

const CLASSES: CalClass[] = ['commitment', 'awareness', 'hidden'];

/** Calendar event details with the per-event classification exception (CAP-J3). */
export function EventInspector({ dayId, ev, areas, onClose }: { dayId: string; ev: DayEvent; areas: Area[]; onClose: () => void }) {
  const [area, setArea] = useState('area-work');
  async function classify(c: CalClass) {
    await save('cal_override', { id: ev.id, classification: c, updatedAt: '' });
    track('calendar_event_classified', { from: ev.cls, to: c, scope: 'event' });
    if (c === 'hidden') onClose();
  }
  async function toBlock() {
    await addBlock(dayId, { start: ev.start, end: ev.end, title: ev.title, areaId: area, fixed: true, fromEvent: ev.id });
    track('calendar_event_to_block', { minutes: ev.end - ev.start });
    onClose();
  }
  return (
    <div className="card inspector">
      <div className="head"><span className="label row"><CalendarDays size={12} />{ev.calendar?.name ?? m.calendars.event}</span>
        <button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <b>{ev.title}</b>
      <span className="secondary tabular">{fmtMin(ev.start)}–{fmtMin(ev.end)} · {fmtDuration(ev.end - ev.start)}{ev.location ? ` · ${ev.location}` : ''}</span>
      {ev.status === 'tentative' && <span className="hint">{m.calendars.tentative}</span>}
      <div className="field"><span>{m.calendars.classification}</span>
        <div className="seg">{CLASSES.map(c => <button key={c} type="button" aria-pressed={ev.cls === c} onClick={() => void classify(c)}>{m.calendars.classes[c]}</button>)}</div>
        <span className="hint">{m.calendars.onlyThisEvent}</span>
      </div>
      <AreaPicker areas={areas} value={area} onPick={setArea} />
      <div className="row"><button type="button" className="btn sm" onClick={() => void toBlock()}>{m.calendars.makeBlock}</button></div>
    </div>
  );
}

/** A meeting over a block (CAP-D2): shorten, split around, move after, or keep. */
export function ExternalConflictsCard({ events, blocks }: { events: DayEvent[]; blocks: DayBlock[] }) {
  const [kept, setKept] = useState<string[]>([]);
  const list = externalConflicts(events, blocks).filter(c => !kept.includes(`${c.eventId}|${c.block.id}`));
  const key = list[0] ? `${list[0].eventId}|${list[0].block.id}` : '';
  useEffect(() => { if (key) track('external_conflict_detected', {}); }, [key]);
  if (!list.length) return null;
  const c = list[0];
  const b = c.block as DayBlock;
  const done = (action: string) => track('external_conflict_resolved', { action });
  async function split() {
    const parts = splitAround(b, c);
    if (!parts.length) { await deleteBlock(b.id); done('remove'); return; }
    await patchBlock(b.id, parts[0], 'resize');
    if (parts[1]) await addBlock(b.dayId, { ...parts[1], title: b.title, areaId: b.areaId, ...(b.fixed ? { fixed: true } : {}) });
    done('split');
  }
  return (
    <section className="card conflicts">
      <span className="label row"><AlertTriangle size={13} />{m.calendars.conflictTitle}{list.length > 1 ? ` · ${list.length}` : ''}</span>
      <span>{m.calendars.conflict(c.title, `${fmtMin(c.start)}–${fmtMin(c.end)}`, b.title)}</span>
      <div className="row wrap">
        <button type="button" className="btn sm" onClick={() => void split()}>{m.calendars.split(b.title)}</button>
        {c.start > b.start && <button type="button" className="btn sm" onClick={() => { void patchBlock(b.id, { end: c.start }, 'resize'); done('shorten'); }}>{m.calendars.endAt(fmtMin(c.start))}</button>}
        <button type="button" className="btn sm ghost" onClick={() => { void patchBlock(b.id, { start: c.end, end: c.end + (b.end - b.start) }, 'move'); done('move'); }}>{m.day.moveAfter(b.title)}</button>
        <button type="button" className="btn sm ghost" onClick={() => { setKept(k => [...k, `${c.eventId}|${b.id}`]); done('keep'); }}>{m.day.keepBoth}</button>
      </div>
    </section>
  );
}

/** All-day events and Awareness events of the day (not on the timeline). */
export function CalendarDayCard({ events }: { events: { allDay: DayEvent[]; timed: DayEvent[] } }) {
  const aware = events.timed.filter(e => e.cls === 'awareness' || e.free);
  if (!events.allDay.length && !aware.length) return null;
  return (
    <section className="card stack">
      <span className="label row"><CalendarDays size={12} />{m.calendars.alsoToday}</span>
      {events.allDay.length > 0 && <div className="allday">{events.allDay.map(e => <span key={e.id} className="pill" data-color="indigo">{e.title}</span>)}</div>}
      {aware.length > 0 && <ul className="cal-list">{aware.map(e => <li key={e.id} className="aware"><span className="tabular muted">{fmtMin(e.start)}</span><span>{e.title}</span></li>)}</ul>}
    </section>
  );
}

/**
 * Turns calendar changes into plan revisions (CAP-D2, US-CAL-006/007): after Start day, a new,
 * moved or cancelled commitment is recorded with reason “Calendar”. Snapshot per day in meta.
 */
export function CalendarWatcher({ dayId, started, commitments }: { dayId: string; started: boolean; commitments: DayEvent[] }) {
  const sig = commitments.map(e => `${e.id}@${e.start}-${e.end}`).join('|');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cur: Record<string, SeenEvent> = Object.fromEntries(commitments.map(e => [e.id, { title: e.title, start: e.start, end: e.end }]));
      const key = `calSeen:${dayId}`;
      const prev = await getMeta<Record<string, SeenEvent> | null>(key, null);
      if (cancelled) return;
      await setMeta(key, cur);
      if (!prev || !started) return;
      const d = diffEvents(prev, cur);
      const snap = (id: string, e: SeenEvent) => ({ id, start: e.start, end: e.end, title: e.title, areaId: '' });
      for (const id of d.added) await recordRevision(dayId, 'external', null, snap(id, cur[id]), { reason: 'Calendar', title: `${m.calendars.newMeeting}: ${cur[id].title}` });
      for (const id of d.changed) await recordRevision(dayId, 'external', snap(id, prev[id]), snap(id, cur[id]), { reason: 'Calendar', title: `${m.calendars.moved}: ${cur[id].title}` });
      for (const id of d.removed) await recordRevision(dayId, 'external', snap(id, prev[id]), null, { reason: 'Calendar', title: `${m.calendars.cancelled}: ${prev[id].title}` });
      const n = d.added.length + d.changed.length + d.removed.length;
      if (n) track('external_event_changed_applied', { added: d.added.length, changed: d.changed.length, removed: d.removed.length });
      // A cancelled meeting frees the block made from it.
      for (const id of d.removed) {
        const blocks = (await getDB().dayBlocks.where('dayId').equals(dayId).toArray()).filter(b => b.fromEvent === id && !b.deleted);
        for (const b of blocks) await deleteBlock(b.id);
      }
    })();
    return () => { cancelled = true; };
  }, [dayId, started, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Visible sync problems (CAP-J6): never fail silently. */
export function CalendarStatusBanner({ problems }: { problems: { account: string; error?: string }[] }) {
  if (!problems.length) return null;
  return (
    <div className="cal-banner" role="status">
      <AlertTriangle size={14} />
      <span>{m.calendars.problem(problems.map(p => p.account.split(':')[1] ?? p.account).join(', '), problems.some(p => p.error === 'reauth'))}</span>
      <Link href="/settings/calendars" className="btn sm">{m.calendars.fix}</Link>
    </div>
  );
}
