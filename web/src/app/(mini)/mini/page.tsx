'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Pause, Play, SkipForward, Square, Timer, X } from 'lucide-react';
import { useDay, useLive } from '@/components/day/useDay';
import { useSecond } from '@/components/day/NowCard';
import { m } from '@/i18n/en';
import { activeSec, isPaused, leftInBlock, startedMs } from '@/lib/actual';
import { activityTasks } from '@/lib/activityTasks';
import { track } from '@/lib/analytics';
import { nowNext } from '@/lib/dayLogic';
import { desktop } from '@/lib/desktop';
import { useClock } from '@/lib/hooks';
import { AreaIcon } from '@/lib/icons';
import { endFocus, focusElapsedSec, pauseActivity, pauseFocus, PRESETS, resumeActivity, resumeFocus, startActivity, startFocus, stopActivity, toggleTaskDone } from '@/lib/ops';
import { fmtClock, fmtDuration, fmtMin } from '@/lib/time';
import type { Area } from '@/lib/types';

const noopSub = () => () => {};
const RING = { width: 68, height: 68 };
const PILL = { width: 340, height: 76 };
const CARD = { width: 340, height: 360 };

/** CSS color of an area (the tray icon is drawn on a canvas, outside CSS). */
function cssColor(key: string | undefined) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--c-${key ?? 'gray'}`).trim() || '#8E8E93';
}

/** Tray / menu-bar icon: a progress ring in the area's color, filled center while something runs. */
function trayIcon(color: string, progress: number, live: boolean): string {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.lineCap = 'round';
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(160,160,166,.35)';
  g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = color;
  g.beginPath(); g.arc(32, 32, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, Math.min(1, progress))); g.stroke();
  g.fillStyle = live ? color : 'rgba(160,160,166,.8)';
  g.beginPath(); g.arc(32, 32, live ? 11 : 7, 0, Math.PI * 2); g.fill();
  return c.toDataURL('image/png');
}

/**
 * Note #20 — Now / Next on the computer. A pill that floats in a corner (desktop companion) and opens
 * into a small card: what is on now with its timer, what comes next, the to-dos of now, one-tap actions.
 */
export default function MiniPage() {
  const { day, minute } = useClock();
  const d = useDay(day);
  const { running, alongside, focus } = useLive();
  const tick = useSecond(true);
  const [open, setOpen] = useState(false);
  // The shell bridge only exists in the desktop app; the server render sees none (no hydration mismatch).
  const shell = useSyncExternalStore(noopSub, desktop, () => undefined);
  // Collapsed to the ring, growing on hover (note #32). Only shells that report hover (desktop 1.1+); older ones keep the pill.
  const collapsible = !!shell?.onHover;
  const [hover, setHover] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [ringed, setRinged] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('mw-root');
    track('mini_opened', { shell: !!desktop() });
  }, []);
  useEffect(() => {
    if (!shell?.onHover) return;
    return shell.onHover(inside => {
      if (inside) setSide(window.screenX + window.outerWidth / 2 > window.screen.width / 2 ? 'right' : 'left');
      setHover(inside);
    });
  }, [shell]);
  const want: 'ring' | 'pill' | 'card' = open ? 'card' : !collapsible || hover ? 'pill' : 'ring';
  const expanded = want !== 'ring';
  // Grow the window first, then animate the page; shrink after the page has folded (fast both ways).
  useEffect(() => {
    if (want !== 'ring') return;
    const t = setTimeout(() => setRinged(true), 160);
    return () => { clearTimeout(t); setRinged(false); };
  }, [want]);
  const winMode: 'ring' | 'pill' | 'card' = want === 'ring' && !ringed ? 'pill' : want;
  useEffect(() => { shell?.setSize(winMode === 'card' ? CARD : winMode === 'pill' ? PILL : RING); }, [winMode, shell]);

  const nn = nowNext(d.blocks, minute);
  const now = nn.now, next = nn.next;
  const subject = running ?? null;
  const area: Area | undefined = d.areaMap.get((subject ?? now)?.areaId ?? '');
  const title = subject ? subject.title || area?.name || '' : now ? now.title : m.mini.free;
  const elapsedSec = subject ? activeSec(subject, tick) : 0;
  const paused = !!subject && isPaused(subject);
  const onFocus = !!focus && (focus.state === 'running' || focus.state === 'paused');
  const focusSec = onFocus ? focusElapsedSec(focus!, tick) : 0;
  const focusLeft = onFocus && focus!.focusMin ? focus!.focusMin * 60 - focusSec : null;
  // Over the plan: the running block went past its planned end.
  const runBlock = subject?.blockId ? d.blocks.find(b => b.id === subject.blockId) : undefined;
  const over = runBlock && minute > runBlock.end ? Math.round(minute - runBlock.end) : 0;
  // The same two facts everywhere: how long at it, and how long is left in its block (note #34).
  const left = subject ? leftInBlock(subject, d.blocks, minute, now) : null;
  const leftTxt = left == null ? '' : left < 0 ? m.mini.over(fmtDuration(Math.max(1, Math.round(-left)))) : m.mini.left(fmtDuration(Math.max(1, Math.round(left))));
  const offPlan = !!subject && !!now && subject.blockId !== now.id;
  const soon = !!next && nn.untilNext <= 5 && nn.untilNext > 0;
  const progress = onFocus && focus!.focusMin ? focusSec / (focus!.focusMin * 60) : now ? nn.progress : 0;

  const ctxArea = subject?.areaId ?? now?.areaId;
  const ctxBlock = subject ? subject.blockId : now?.id;
  const todos = ctxArea ? activityTasks({ areaId: ctxArea, blockId: ctxBlock }, day, d.tasks, d.blocks, 4).today : [];

  // Tray icon + title: the area ring and the timer (menu bar on Mac, tooltip on Windows).
  const time = focusLeft != null ? fmtDuration(Math.max(0, Math.ceil(focusLeft / 60))) : subject ? fmtDuration(Math.floor(elapsedSec / 60)) : '';
  const trayKey = `${area?.color}|${Math.round(progress * 40)}|${!!subject}|${title}|${time}|${leftTxt}|${paused}|${next?.id}|${shell ? 1 : 0}`;
  const lastTray = useRef('');
  useEffect(() => {
    if (!shell || lastTray.current === trayKey) return;
    lastTray.current = trayKey;
    shell.setTray({
      title: subject ? `${title} · ${time}${leftTxt ? ` · ${leftTxt}` : ''}` : now ? title : '',
      tooltip: [
        subject ? `${paused ? '⏸' : '▶'} ${title} · ${fmtClock(elapsedSec)}${leftTxt ? ` · ${leftTxt}` : ''}` : now ? `${title} · ${fmtMin(now.start)}–${fmtMin(now.end)}` : m.mini.free,
        next ? `${m.today.next}: ${next.title} ${fmtMin(next.start)}` : '',
      ].filter(Boolean).join('\n'),
      icon: trayIcon(cssColor(area?.color), progress || (subject ? 1 : 0), !!subject),
    });
  }, [trayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d.ready) return <main className="mw mw-closed" aria-busy="true" />;

  const startNow = () => now && startActivity(day, { areaId: now.areaId, title: now.title, blockId: now.id, source: 'live' });
  const startNext = () => next && startActivity(day, { areaId: next.areaId, title: next.title, blockId: next.id, source: 'live' });
  const state = onFocus ? 'focus' : subject ? (paused ? 'paused' : over ? 'over' : 'live') : now ? 'idle' : 'free';
  const hot = !!subject && (soon || over > 0);

  return (
    <main className={`mw ${open ? 'mw-open' : 'mw-closed'}${expanded ? '' : ' mw-ring-only'} mw-${side} s-${state}${soon ? ' soon' : ''}`} data-color={area?.color ?? 'gray'}>
      <div className="mw-bar">
        <div className="mw-ring" style={{ ['--p' as string]: Math.max(0, Math.min(1, progress)) }} aria-hidden>
          <span className="mw-ring-in">{area ? <AreaIcon name={area.icon} size={15} /> : null}</span>
        </div>
        <div className="mw-main">
          <div className="mw-title">
            {subject && <span className="live-dot" aria-label={m.activity.doing} />}
            <span className="mw-name">{title}</span>
            {offPlan && <span className="mw-tag">{m.activity.offPlan}</span>}
          </div>
          <div className="mw-sub tabular">
            {state === 'focus' && <span className="mw-time"><Timer size={11} />{fmtClock(focusLeft != null ? Math.max(0, focusLeft) : focusSec)}{focus!.state === 'paused' ? ` · ${m.mini.paused}` : ''}</span>}
            {state === 'live' && <><span className="mw-time">{fmtClock(elapsedSec)}</span>{leftTxt && <span>{leftTxt}</span>}</>}
            {state === 'over' && <><span className="mw-time">{fmtClock(elapsedSec)}</span><span className="mw-over">{leftTxt || m.mini.over(fmtDuration(over))}</span></>}
            {state === 'paused' && <><span className="mw-time"><Pause size={11} />{fmtClock(elapsedSec)}</span><span className="mw-over">{m.mini.pausedNow}</span></>}
            {state === 'idle' && now && <span>{fmtMin(now.start)}–{fmtMin(now.end)} · {m.mini.left(fmtDuration(Math.round(nn.remaining)))}</span>}
            {state === 'free' && <span>{next ? m.mini.nextAt(next.title, fmtMin(next.start)) : m.mini.nothing}</span>}
            {next && state !== 'free' && <span className={`mw-next${soon ? ' soon' : ''}`}>→ {next.title} {soon ? m.mini.inMin(Math.max(1, Math.round(nn.untilNext))) : fmtMin(next.start)}</span>}
          </div>
        </div>
        <div className="mw-actions">
          {state === 'focus' ? (
            focus!.state === 'paused'
              ? <button type="button" className="mw-btn" title={m.mini.resume} onClick={() => void resumeFocus(focus!.id)}><Play size={15} /></button>
              : <button type="button" className="mw-btn" title={m.mini.pause} onClick={() => void pauseFocus(focus!.id)}><Pause size={15} /></button>
          ) : subject ? (
            <>
              {paused
                ? <button type="button" className="mw-btn hot" title={m.activity.resume} onClick={() => void resumeActivity(subject.id)}><Play size={15} /></button>
                : <button type="button" className="mw-btn" title={m.activity.pause} onClick={() => void pauseActivity(subject.id)}><Pause size={14} /></button>}
              {hot && next && !paused
                ? <button type="button" className="mw-btn hot" title={m.mini.switchTo(next.title)} onClick={() => void startNext()}><SkipForward size={15} /></button>
                : <button type="button" className="mw-btn" title={m.activity.stop} onClick={() => void stopActivity(subject.id)}><Square size={13} /></button>}
            </>
          ) : now ? (
            <button type="button" className="mw-btn hot" title={m.activity.start} onClick={() => void startNow()}><Play size={15} /></button>
          ) : null}
          <button type="button" className="mw-btn ghost" title={open ? m.mini.less : m.mini.more} aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button>
        </div>
      </div>

      {open && (
        <div className="mw-card">
          {now && offPlan && (
            <div className="mw-plan"><span className="muted">{m.mini.planSays}</span><b>{now.title}</b>
              <button type="button" className="btn sm" onClick={() => void startNow()}>{m.activity.switchNow}</button></div>
          )}
          <div className="mw-row-actions">
            {subject ? <>
              {paused
                ? <button type="button" className="btn sm primary" onClick={() => void resumeActivity(subject.id)}><Play size={12} />{m.activity.resume}</button>
                : <button type="button" className="btn sm" onClick={() => void pauseActivity(subject.id)}><Pause size={12} />{m.activity.pause}</button>}
              <button type="button" className="btn sm" onClick={() => void stopActivity(subject.id)}><Square size={12} />{m.activity.stop}</button></>
              : now && <button type="button" className="btn sm primary" onClick={() => void startNow()}><Play size={12} />{m.activity.start}</button>}
            {onFocus
              ? <button type="button" className="btn sm" onClick={() => void endFocus(focus!.id, 'done', undefined, { startBreak: true })}>{m.mini.finishFocus}</button>
              : (subject || now) && <button type="button" className="btn sm" onClick={() => void startFocus(day, { preset: PRESETS[0], blockId: ctxBlock, areaId: ctxArea!, title })}><Timer size={12} />{m.mini.focus}</button>}
            {next && <button type="button" className="btn sm ghost" onClick={() => void startNext()}><SkipForward size={12} />{m.mini.startNext}</button>}
          </div>
          {alongside.length > 0 && (
            <div className="mw-also">{alongside.map(r => (
              <span key={r.id} className="pill" data-color={d.areaMap.get(r.areaId)?.color}>{m.activity.also} {r.title} · {fmtClock((tick - startedMs(r)) / 1000)}
                <button type="button" aria-label={m.activity.stop} onClick={() => void stopActivity(r.id)}><X size={10} /></button></span>
            ))}</div>
          )}
          <div className="mw-todos">
            <span className="label">{m.mini.todos}</span>
            {todos.length === 0 ? <span className="muted">{m.mini.noTodos}</span> : todos.map(t => (
              <label key={t.id} className={`mw-todo${t.status === 'done' ? ' done' : ''}`}>
                <input type="checkbox" checked={t.status === 'done'} onChange={() => void toggleTaskDone(t.id)} />
                <span>{t.title}</span>
                {t.estimate ? <span className="muted tabular">{fmtDuration(t.estimate)}</span> : null}
              </label>
            ))}
          </div>
          {next && (
            <div className="mw-nextcard" data-color={d.areaMap.get(next.areaId)?.color}>
              <span className="dot" /><span className="muted">{m.today.next}</span><b>{next.title}</b>
              <span className="muted tabular">{fmtMin(next.start)}–{fmtMin(next.end)} · {m.mini.inDur(fmtDuration(Math.round(nn.untilNext)))}</span>
            </div>
          )}
          <button type="button" className="btn sm ghost mw-openapp" onClick={() => (shell ? shell.openApp('/') : window.open('/', '_blank'))}><ExternalLink size={12} />{m.mini.openApp}</button>
        </div>
      )}
    </main>
  );
}
