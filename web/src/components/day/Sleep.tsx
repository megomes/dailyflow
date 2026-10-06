'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Moon, Sunrise, Trash2, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { getDB, getMeta, setMeta } from '@/lib/db';
import { deleteSleep, endSleep, saveSleep, startSleep } from '@/lib/ops';
import { DEFAULT_TARGET, mainSleeps, sleepMinutes, targetMinutes, type SleepTarget } from '@/lib/sleep';
import { addDays, dateAtMinute, fmtClock, fmtDuration, pad2, parseHHMM } from '@/lib/time';
import type { Sleep } from '@/lib/types';
import { Modal } from '../Modal';

/** Every night on this device, live (note #29). */
export function useSleeps() {
  return (useLiveQuery(() => getDB().sleeps.toArray(), []) ?? []).filter(s => !s.deleted);
}

export function useSleepTarget(): SleepTarget {
  const prefs = useLiveQuery(() => getDB().prefs.get('prefs'), []);
  return prefs?.sleepTarget ?? DEFAULT_TARGET;
}

const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Bed and wake clock times → real moments for a night (bed after midnight is the next date; wake comes after bed). */
export function nightMoments(night: string, bed: number, wake: number): { start: Date; end: Date } {
  const bedDay = bed >= 12 * 60 ? night : addDays(night, 1);
  const start = dateAtMinute(bedDay, bed);
  const wakeDay = wake > bed ? bedDay : addDays(bedDay, 1);
  return { start, end: dateAtMinute(wakeDay, wake) };
}

/** Stage proportions as a thin bar (deep / light / REM / awake). */
export function StageBar({ stages }: { stages: NonNullable<Sleep['stages']> }) {
  const total = stages.deep + stages.light + stages.rem + stages.awake || 1;
  return (
    <span className="stage-bar" aria-label={(['deep', 'light', 'rem', 'awake'] as const).map(k => `${m.sleep.stages[k]} ${fmtDuration(stages[k])}`).join(', ')}>
      {(['deep', 'rem', 'light', 'awake'] as const).map(k => <i key={k} className={`st-${k}`} style={{ flexGrow: stages[k] / total }} />)}
    </span>
  );
}

/** The Now card while asleep: a quiet night sky with one big “I'm awake”. */
export function NightCard({ sleep, tick, onFix }: { sleep: Sleep; tick: number; onFix: () => void }) {
  const since = new Date(sleep.start);
  return (
    <section className="card nowcard night-card" aria-label={m.sleep.sleeping}>
      <span className="stars" aria-hidden />
      <span className="label row"><Moon size={13} />{m.sleep.sleeping} · {m.sleep.since(hhmm(since))}</span>
      <div className="big"><span className="night-clock tabular">{fmtClock((tick - since.getTime()) / 1000)}</span></div>
      <p className="hint">{m.sleep.goodNight}</p>
      <div className="row wrap now-actions">
        <button type="button" className="btn primary wake-btn" onClick={() => void endSleep(sleep.id)}><Sunrise size={15} />{m.sleep.awake}</button>
        <button type="button" className="btn sm ghost" onClick={onFix}>{m.sleep.fix}</button>
      </div>
    </section>
  );
}

/** Add or fix a night by hand: bedtime and wake-up for that night. */
export function SleepSheet({ sleep, night, onClose, tonight = false }: { sleep: Sleep | null; night: string; onClose: () => void; /** Tonight's night: you have not woken up yet, so no wake-up time is asked (note #40). */ tonight?: boolean }) {
  const target = useSleepTarget();
  const start = sleep ? new Date(sleep.start) : null;
  const end = sleep?.end ? new Date(sleep.end) : null;
  const [bed, setBed] = useState(start ? hhmm(start) : tonight ? hhmm(new Date()) : `${pad2(Math.floor(target.bed / 60))}:${pad2(target.bed % 60)}`);
  const [wake, setWake] = useState(end ? hhmm(end) : sleep || tonight ? '' : hhmm(new Date()));
  const askWake = !tonight || !!end;
  const b = parseHHMM(bed), w = wake ? parseHHMM(wake) : null;
  const moments = b != null ? nightMoments(sleep?.night ?? night, b, w ?? b + 1) : null;
  const length = moments && w != null ? (moments.end.getTime() - moments.start.getTime()) / 60000 : null;

  async function save() {
    if (!moments) return;
    // A new night with no wake-up yet is “going to sleep”: stops what is running, then the night stays open.
    if (!sleep && w == null) await startSleep(moments.start);
    else await saveSleep(sleep?.id ?? null, moments.start, w != null ? moments.end : null);
    onClose();
  }
  return (
    <Modal onClose={onClose} label={sleep ? m.sleep.sheetTitle : m.sleep.newTitle}>
      <div className="head"><b><Moon size={14} /> {sleep ? m.sleep.sheetTitle : m.sleep.newTitle}</b><button type="button" className="btn icon sm ghost" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
      <div className="sleep-form">
        <label className="field"><span>{m.sleep.bed}</span><input id="sleep-bed" className="input tabular" type="time" value={bed} onChange={e => setBed(e.target.value)} /></label>
        {askWake && <label className="field"><span>{m.sleep.wake}</span><input id="sleep-wake" className="input tabular" type="time" value={wake} onChange={e => setWake(e.target.value)} placeholder={m.sleep.stillAsleep} /></label>}
      </div>
      <p className="hint">
        {tonight && !end ? m.sleep.goingToSleepHint : length != null ? m.sleep.duration(fmtDuration(Math.round(length)), fmtDuration(targetMinutes(target))) : m.sleep.stillAsleep}
        {sleep ? ` · ${sleep.source === 'health' ? m.sleep.fromWatch : m.sleep.manual}` : ''}
      </p>
      {sleep?.stages && <StageBar stages={sleep.stages} />}
      <div className="row">
        {sleep && <button type="button" className="btn sm ghost danger" onClick={() => { void deleteSleep(sleep.id); onClose(); }}><Trash2 size={13} />{m.sleep.delete}</button>}
        <span className="spacer" />
        <button type="button" className="btn sm primary" disabled={!moments || (length != null && (length <= 0 || length > 20 * 60))} onClick={() => void save()}>{m.sleep.save}</button>
      </div>
    </Modal>
  );
}

/** Morning, nothing recorded for last night and nothing open: ask once, prefilled with the target and now. */
export function MorningPrompt({ dayId, minute }: { dayId: string; minute: number }) {
  const sleeps = useSleeps();
  const dismissed = useLiveQuery(() => getMeta<string>('sleepPromptSkipped', ''), []);
  const [open, setOpen] = useState(false);
  const night = addDays(dayId, -1);
  const has = mainSleeps(sleeps).has(night) || sleeps.some(s => !s.end);
  if (has || minute >= 13 * 60 || dismissed === dayId || dismissed === undefined) return null;
  return (
    <section className="card morning-card">
      <span className="label row"><Sunrise size={13} />{m.sleep.morningTitle}</span>
      <p className="hint" style={{ margin: 0 }}>{m.sleep.morningHint}</p>
      <div className="row wrap">
        <button type="button" className="btn sm primary" onClick={() => setOpen(true)}><Moon size={13} />{m.sleep.newTitle}</button>
        <button type="button" className="btn sm ghost" onClick={() => void setMeta('sleepPromptSkipped', dayId)}>{m.sleep.skip}</button>
      </div>
      {open && <SleepSheet sleep={null} night={night} onClose={() => setOpen(false)} />}
    </section>
  );
}

/** Labels for the timeline's sleep bands. */
export function bandTitle(s: Sleep, part: 'morning' | 'night', now = Date.now()): string {
  const start = new Date(s.start), end = s.end ? new Date(s.end) : null;
  const dur = fmtDuration(Math.round(sleepMinutes(s, now)));
  if (part === 'morning' && end) return m.sleep.woke(hhmm(end), dur);
  if (end) return m.sleep.slept(hhmm(start), hhmm(end), dur);
  return m.sleep.asleepAt(hhmm(start));
}

/** Last night and tonight as a thin sky strip above the day, outside the plan; always there to log or fix bed and wake times (note #29). */
export function NightStrip({ dayId, side = false }: { dayId: string; side?: boolean }) {
  const sleeps = useSleeps();
  const [sheet, setSheet] = useState<{ sleep: Sleep | null; night: string } | null>(null);
  const nights = mainSleeps(sleeps);
  const lastNight = addDays(dayId, -1);
  const chips: { key: string; which: 'last' | 'tonight'; night: string; s: Sleep | null }[] = [
    { key: 'last', which: 'last', night: lastNight, s: nights.get(lastNight) ?? null },
    { key: 'tonight', which: 'tonight', night: dayId, s: nights.get(dayId) ?? null },
  ];
  return (
    <div className={`night-strip${side ? ' side' : ''}`}>
      {chips.map(({ key, which, night, s }) => (
        <button key={key} type="button" className={`night-chip ${which}${s ? '' : ' empty'}`} onClick={() => setSheet({ sleep: s, night })}>
          <span className="stars" aria-hidden />
          <Moon size={13} />
          <b>{which === 'last' ? m.sleep.lastNight : m.sleep.tonight}</b>
          {s ? (
            <>
              <span className="tabular">{s.end ? `${hhmm(new Date(s.start))} → ${hhmm(new Date(s.end))}` : m.sleep.asleepAt(hhmm(new Date(s.start)))}</span>
              {s.end && <span className="tabular muted">{fmtDuration(Math.round(sleepMinutes(s)))}</span>}
              {s.stages && <StageBar stages={s.stages} />}
            </>
          ) : <span className="muted">{which === 'last' ? m.sleep.addLast : m.sleep.addTonight}</span>}
          <span className="chip-edit">{s ? m.sleep.edit : m.sleep.add}</span>
        </button>
      ))}
      {sheet && <SleepSheet key={sheet.sleep?.id ?? sheet.night} sleep={sheet.sleep} night={sheet.night} tonight={sheet.night === dayId} onClose={() => setSheet(null)} />}
    </div>
  );
}
