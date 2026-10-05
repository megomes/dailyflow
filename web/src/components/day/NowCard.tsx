'use client';
import { useEffect, useState } from 'react';
import { Coffee, Pause, Play, Plus, Square, Timer, Zap } from 'lucide-react';
import { m } from '@/i18n/en';
import { nowNext } from '@/lib/dayLogic';
import { AreaIcon } from '@/lib/icons';
import { endBreak, endFocus, extendFocus, focusElapsedSec, pauseFocus, PRESETS, resumeFocus, startActivity, startFocus, stopActivity, toggleTaskDone, type Preset } from '@/lib/ops';
import { fmtClock, fmtDuration, fmtMin } from '@/lib/time';
import type { Area, DayBlock, FocusSession, Task, TimeRecord } from '@/lib/types';
import { getMeta, setMeta } from '@/lib/db';
import { QuickSwitch } from './QuickSwitch';

/** Ticks every second while mounted (timers). */
export function useSecond(active = true) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(i);
  }, [active]);
  return t;
}

interface Props {
  dayId: string;
  minute: number;
  blocks: DayBlock[];
  tasks: Task[];
  areas: Area[];
  areaMap: Map<string, Area>;
  running: TimeRecord | undefined;
  focus: FocusSession | undefined;
}

/** Now card in live mode: the running activity (or focus timer), else the current block with Start. */
export function NowCard({ dayId, minute, blocks, tasks, areas, areaMap, running, focus }: Props) {
  const { now, next, remaining, progress, untilNext } = nowNext(blocks, minute);
  const [switching, setSwitching] = useState(false);
  const [presetId, setPresetId] = useState('25/5');
  const [choosing, setChoosing] = useState(false);
  const [free, setFree] = useState('');
  const tick = useSecond(!!running || !!focus);

  useEffect(() => { void getMeta<string>('focusPreset', '25/5').then(setPresetId); }, []);
  const preset = PRESETS.find(p => p.id === presetId) ?? PRESETS[0];

  const runningBlock = running?.blockId ? blocks.find(b => b.id === running.blockId) : undefined;
  const focusBlockId = focus?.blockId ?? running?.blockId ?? now?.id;
  const ctxBlock = runningBlock ?? (running ? undefined : now ?? undefined);
  const blockTasks = ctxBlock ? tasks.filter(t => t.blockId === ctxBlock.id) : [];

  async function focusOn(p: Preset, task?: Task) {
    if (p.id !== 'free') { await setMeta('focusPreset', p.id); setPresetId(p.id); }
    setChoosing(false);
    const areaId = task?.areaId ?? running?.areaId ?? now?.areaId ?? 'area-personal';
    const title = task?.title ?? running?.title ?? now?.title ?? m.focus.title;
    await startFocus(dayId, { preset: p, taskId: task?.id ?? running?.taskId, blockId: focusBlockId, areaId, title });
  }

  const na = areaMap.get((running ?? now)?.areaId ?? '');
  const xa = next ? areaMap.get(next.areaId) : undefined;
  const onBreak = focus && focus.state === 'done' && focus.breakStartedAt && !focus.breakEndedAt;

  return (
    <>
      <section className={`card nowcard now${running ? ' live' : ''}`} data-color={na?.color ?? 'blue'} aria-label={m.today.now}>
        {focus && !onBreak ? (
          <FocusPanel focus={focus} tick={tick} />
        ) : onBreak ? (
          <BreakPanel focus={focus!} tick={tick} />
        ) : running ? (
          <>
            <span className="label row"><span className="live-dot" />{m.activity.doing}{!running.blockId && <span className="pill" data-color="gray">{m.activity.offPlan}</span>}</span>
            <div className="big"><span className="dot" />{na && <AreaIcon name={na.icon} size={16} />}<span>{running.title || na?.name}</span></div>
            <div className="meta tabular">
              <span>{m.activity.since(fmtMin(running.start))}</span>
              <b className="elapsed">{fmtClock((tick - Date.parse(running.startedAt ?? new Date().toISOString())) / 1000)}</b>
            </div>
          </>
        ) : (
          <>
            <span className="label">{m.today.now}</span>
            {now ? (
              <>
                <div className="big"><span className="dot" />{na && <AreaIcon name={na.icon} size={16} />}<span>{now.title}</span></div>
                <div className="meta tabular"><span>{fmtMin(now.start)}–{fmtMin(now.end)}</span><span>{m.today.remaining(fmtDuration(remaining))}</span></div>
                <div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              </>
            ) : <span className="secondary">{m.today.nothingNow}</span>}
          </>
        )}

        {!focus && !onBreak && (
          <div className="row wrap now-actions">
            {running ? (
              <button type="button" className="btn sm" onClick={() => void stopActivity(running.id)}><Square size={13} />{m.activity.stop}</button>
            ) : now ? (
              <button type="button" className="btn sm primary" onClick={() => void startActivity(dayId, { areaId: now.areaId, title: now.title, blockId: now.id, source: 'live' })}>
                <Play size={13} />{m.activity.start}
              </button>
            ) : null}
            <button type="button" className="btn sm" onClick={() => setChoosing(c => !c)} aria-expanded={choosing}><Timer size={13} />{m.activity.focus}</button>
            <button type="button" className="btn sm ghost" onClick={() => setSwitching(true)}><Zap size={13} />{m.activity.switch}</button>
          </div>
        )}
        {choosing && !focus && (
          <div className="presets">
            {PRESETS.map(p => (
              <button key={p.id} type="button" className="chip" aria-pressed={p.id === preset.id} onClick={() => void focusOn(p)}>{p.label}</button>
            ))}
            <form className="free" onSubmit={e => { e.preventDefault(); const n = Number(free); if (n >= 1 && n <= 240) void focusOn({ id: 'free', label: `${n}`, focus: n, brk: 0 }); }}>
              <input className="input" inputMode="numeric" placeholder={m.focus.free} value={free} onChange={e => setFree(e.target.value.replace(/\D/g, ''))} aria-label={m.focus.free} />
            </form>
          </div>
        )}

        {blockTasks.length > 0 && !focus && (
          <div className="now-tasks">
            <span className="label">{m.activity.tasksHere}</span>
            {blockTasks.map(t => (
              <div key={t.id} className="now-task">
                <input type="checkbox" checked={t.status === 'done'} onChange={() => void toggleTaskDone(t.id)} aria-label={t.title} />
                <span className={t.status === 'done' ? 'done' : ''}>{t.title}</span>
                {t.estimate ? <span className="muted tabular">{fmtDuration(t.estimate)}</span> : null}
                {t.status !== 'done' && (
                  <button type="button" className="btn icon sm ghost" title={m.focus.start} aria-label={m.focus.start} onClick={() => void focusOn(preset, t)}><Timer size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {switching && <QuickSwitch areas={areas} onClose={() => setSwitching(false)} onPick={(areaId, title) => { setSwitching(false); void startActivity(dayId, { areaId, title, source: 'switch' }); }} />}

      <section className="card nowcard next" data-color={xa?.color ?? 'gray'} aria-label={m.today.next}>
        <span className="label">{m.today.next}</span>
        {next ? (
          <>
            <div className="big"><span className="dot" />{xa && <AreaIcon name={xa.icon} size={14} />}<span>{next.title}</span></div>
            <div className="meta tabular"><span>{fmtMin(next.start)}–{fmtMin(next.end)}</span><span>{m.today.startsIn(fmtDuration(untilNext))}</span></div>
          </>
        ) : <span className="secondary">{m.today.nothingNext}</span>}
      </section>
    </>
  );
}

function FocusPanel({ focus, tick }: { focus: FocusSession; tick: number }) {
  const el = focusElapsedSec(focus, tick);
  const total = focus.focusMin * 60;
  const left = total - el;
  const over = total > 0 && left < 0;
  const paused = focus.state === 'paused';
  return (
    <div className="focus">
      <span className="label row"><Timer size={12} />{m.focus.title} · {focus.preset === 'stopwatch' ? m.focus.stopwatch : `${focus.focusMin}m`}{paused && ` · ${m.focus.pause}`}</span>
      <div className="big"><span>{focus.title}</span></div>
      <div className={`clock tabular${over ? ' over' : ''}${paused ? ' paused' : ''}`}>{total ? (over ? `+${fmtClock(-left)}` : fmtClock(left)) : fmtClock(el)}</div>
      {total > 0 && <div className="bar"><i style={{ width: `${Math.min(100, Math.round((el / total) * 100))}%` }} /></div>}
      {over && <span className="hint">{m.focus.overtime}</span>}
      <div className="row wrap">
        {paused
          ? <button type="button" className="btn sm" onClick={() => void resumeFocus(focus.id)}><Play size={13} />{m.focus.resume}</button>
          : <button type="button" className="btn sm" onClick={() => void pauseFocus(focus.id)}><Pause size={13} />{m.focus.pause}</button>}
        {total > 0 && <button type="button" className="btn sm" onClick={() => void extendFocus(focus.id)}><Plus size={13} />{m.focus.plus5}</button>}
        <button type="button" className="btn sm primary" onClick={() => void endFocus(focus.id, 'done', undefined, { startBreak: true, stopActivity: true })}>{m.focus.finish}</button>
        <button type="button" className="btn sm ghost" onClick={() => void endFocus(focus.id, 'interrupted', undefined, { stopActivity: true })}><Square size={13} />{m.focus.stop}</button>
      </div>
    </div>
  );
}

function BreakPanel({ focus, tick }: { focus: FocusSession; tick: number }) {
  const el = (tick - Date.parse(focus.breakStartedAt!)) / 1000;
  const left = focus.breakMin * 60 - el;
  async function back() {
    await endBreak(focus.id, left > 0);
    await startActivity(focus.dayId, { areaId: focus.areaId, title: focus.title, blockId: focus.blockId, taskId: focus.taskId, source: 'focus' });
  }
  return (
    <div className="focus break">
      <span className="label row"><Coffee size={12} />{m.focus.breakTitle} · {focus.breakMin}m</span>
      <div className="big"><span>{m.focus.done} · {focus.actualMin}m</span></div>
      <div className={`clock tabular${left < 0 ? ' over' : ''}`}>{left >= 0 ? fmtClock(left) : `+${fmtClock(-left)}`}</div>
      <div className="row">
        <button type="button" className="btn sm primary" onClick={() => void back()}>{left > 0 ? m.focus.skipBreak : m.focus.endBreak}</button>
      </div>
    </div>
  );
}
