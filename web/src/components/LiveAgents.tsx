'use client';
import { startedMs } from '@/lib/actual';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { useClock } from '@/lib/hooks';
import { endFocus, focusElapsedSec, stopActivity } from '@/lib/ops';
import { dateAtMinute, fmtClock, fmtDuration, fmtMin, minuteOfDay, parseHHMM } from '@/lib/time';
import type { FocusSession, TimeRecord } from '@/lib/types';
import { useLive } from './day/useDay';
import { Modal } from './Modal';

/** Background helpers mounted once in the shell: tab title, forgotten timers, notifications. */
export function LiveAgents() {
  const { running, focus } = useLive();
  return (
    <>
      <TabTitle running={running} focus={focus} />
      <Forgotten running={running} focus={focus} />
      <Notifier focus={focus} />
    </>
  );
}

/** Timer in the tab title (CAP-C4). */
function TabTitle({ running, focus }: { running?: TimeRecord; focus?: FocusSession }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running && !focus) { document.title = 'DailyFlow'; return; }
    const i = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [running, focus]);
  useEffect(() => {
    if (focus && (focus.state === 'running' || focus.state === 'paused')) {
      const el = focusElapsedSec(focus);
      const left = focus.focusMin * 60 - el;
      const clock = focus.focusMin ? (left >= 0 ? fmtClock(left) : `+${fmtClock(-left)}`) : fmtClock(el);
      document.title = `${focus.state === 'paused' ? '⏸ ' : ''}${clock} · ${focus.title}`;
    } else if (running) {
      document.title = `● ${fmtClock((Date.now() - startedMs(running)) / 1000)} · ${running.title}`;
    } else document.title = 'DailyFlow';
  }, [tick, running, focus]);
  return null;
}

/**
 * Forgotten timer (CAP-F6): a focus session long past its planned end, or an activity running
 * for hours past its block, asks “stopped when?”. Checked when the app becomes visible.
 */
function Forgotten({ running, focus }: { running?: TimeRecord; focus?: FocusSession }) {
  const [check, setCheck] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const block = useLiveQuery(async () => (running?.blockId ? getDB().dayBlocks.get(running.blockId) : undefined), [running?.blockId]);
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') setCheck(c => c + 1); };
    document.addEventListener('visibilitychange', on);
    const i = setInterval(() => setCheck(c => c + 1), 60_000);
    return () => { document.removeEventListener('visibilitychange', on); clearInterval(i); };
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setNow(Date.now()); }, [check]); // eslint-disable-line react-hooks/set-state-in-effect

  let kind: 'focus' | 'activity' | null = null;
  let id = '';
  if (focus && focus.state === 'running' && focus.id !== dismissed) {
    const el = focusElapsedSec(focus, now) / 60;
    if ((focus.focusMin && el > focus.focusMin + focus.breakMin + 20) || (!focus.focusMin && el > 180)) { kind = 'focus'; id = focus.id; }
  } else if (running && running.id !== dismissed) {
    const el = (now - startedMs(running)) / 60000;
    const pastBlock = block ? minuteOfDay(running.dayId, new Date(now)) - block.end : el - 120;
    if (el > 90 && pastBlock > 90) { kind = 'activity'; id = running.id; }
  }
  if (!kind) return null;

  const title = kind === 'focus' ? focus!.title : running!.title;
  const startedAt = kind === 'focus' ? Date.parse(focus!.startedAt) : startedMs(running!);
  const plannedEnd = kind === 'focus'
    ? new Date(startedAt + (focus!.focusMin || 60) * 60000 + focus!.pausedMs)
    : block ? dateAtMinute(running!.dayId, block.end) : new Date(startedAt + 60 * 60000);
  const runningFor = fmtDuration((now - startedAt) / 60000);

  async function stopAt(at: Date) {
    const ran = Math.round((now - startedAt) / 60000);
    if (kind === 'focus') await endFocus(id, 'done', at, { stopActivity: true });
    else await stopActivity(id, at);
    track('timer_forgotten_fixed', { kind, running_min: ran, corrected_min: Math.round((at.getTime() - startedAt) / 60000) });
    setDismissed(id);
  }

  return (
    <ForgotModal title={title} runningFor={runningFor} kind={kind} plannedEnd={plannedEnd} startedAt={startedAt}
      onKeep={() => { setDismissed(id); track('timer_forgotten_kept', { kind }); }} onStop={at => void stopAt(at)} />
  );
}

function ForgotModal({ title, runningFor, kind, plannedEnd, startedAt, onKeep, onStop }: {
  title: string; runningFor: string; kind: 'focus' | 'activity'; plannedEnd: Date; startedAt: number; onKeep: () => void; onStop: (at: Date) => void;
}) {
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const [custom, setCustom] = useState(hhmm(plannedEnd));
  function stopCustom() {
    const mins = parseHHMM(custom);
    if (mins == null) return;
    const d = new Date(startedAt);
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    if (d.getTime() < startedAt) d.setDate(d.getDate() + 1);
    onStop(new Date(Math.min(d.getTime(), Date.now())));
  }
  return (
    <Modal onClose={onKeep} label={m.focus.forgotTitle}>
      <b>{kind === 'focus' ? m.focus.forgotTitle : m.activity.stillDoing(title, runningFor)}</b>
      {kind === 'focus' && <span className="secondary">{m.focus.forgotSub(title, runningFor)}</span>}
      <div className="row wrap">
        <button type="button" className="btn primary sm" onClick={() => onStop(plannedEnd)}>{m.focus.forgotStopPlanned(fmtMin(plannedEnd.getHours() * 60 + plannedEnd.getMinutes()))}</button>
        <button type="button" className="btn sm" onClick={onKeep}>{kind === 'focus' ? m.focus.forgotStillGoing : m.activity.stillGoing}</button>
      </div>
      <div className="row">
        <span className="hint">{m.focus.forgotStopAt}</span>
        <input className="input tabular" type="time" style={{ width: 120 }} value={custom} onChange={e => setCustom(e.target.value)} />
        <button type="button" className="btn sm" onClick={stopCustom}>{m.focus.forgotSave}</button>
      </div>
    </Modal>
  );
}

async function notify(title: string, body?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/icon-192.png', tag: 'dailyflow' });
    else new Notification(title, { body, icon: '/icon-192.png' });
    track('notification_shown', { kind: title.slice(0, 20) });
  } catch { /* not allowed here */ }
}

/** Optional notifications (CAP-K5): end of focus/break and the next block, while the app is open. */
function Notifier({ focus }: { focus?: FocusSession }) {
  const prefs = useLiveQuery(() => getDB().prefs.get('prefs'), []);
  const { day, minute } = useClock();
  const nextBlock = useLiveQuery(async () => {
    const rows = await getDB().dayBlocks.where('dayId').equals(day).toArray();
    return rows.filter(b => !b.deleted && b.start > minute).sort((a, b) => a.start - b.start)[0];
  }, [day, Math.floor(minute)]);

  useEffect(() => {
    if (!prefs?.notifyFocus || !focus) return;
    let ms: number | null = null, text = '';
    if (focus.state === 'running' && focus.focusMin) { ms = (focus.focusMin * 60 - focusElapsedSec(focus)) * 1000; text = m.focus.notifyEnd(focus.title); }
    else if (focus.state === 'done' && focus.breakStartedAt && !focus.breakEndedAt) { ms = Date.parse(focus.breakStartedAt) + focus.breakMin * 60000 - Date.now(); text = m.focus.notifyBreak; }
    if (ms == null || ms < 0) return;
    const t = setTimeout(() => void notify(text), ms);
    return () => clearTimeout(t);
  }, [prefs?.notifyFocus, focus]);

  useEffect(() => {
    if (!prefs?.notifyBlocks || !nextBlock) return;
    const ms = dateAtMinute(day, nextBlock.start).getTime() - Date.now();
    if (ms < 0 || ms > 6 * 3600_000) return;
    const t = setTimeout(() => void notify(`${m.today.now}: ${nextBlock.title}`, `${fmtMin(nextBlock.start)}–${fmtMin(nextBlock.end)}`), ms);
    return () => clearTimeout(t);
  }, [prefs?.notifyBlocks, nextBlock, day]);
  return null;
}
