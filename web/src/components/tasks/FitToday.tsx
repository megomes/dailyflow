'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarPlus, Check, Play, Undo2, X } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { addBlock, PRESETS, restoreTask, scheduleTask, startFocus, updateTask, type TaskPlace } from '@/lib/ops';
import { fitToday } from '@/lib/taskBoard';
import { fmtDuration, fmtMin } from '@/lib/time';
import type { Area, DayBlock, Task } from '@/lib/types';

const DEFAULT_AREA = 'area-personal';
const QUICK_EST = [15, 30, 60, 120];
const SHOWN = 4;

/**
 * A to-do just landed on Today without being in the plan: where does it go?
 * Blocks still ahead (same area first, with free time), a new block in the next free gap, start it now, or keep it loose.
 * Inline at the top of the Today column on desktop, a sheet on phones. Never required: dismissing keeps it on Today.
 */
export function FitToday({ task, prev, day, minute, blocks, dayTasks, areaMap, onClose }: {
  task: Task; prev: TaskPlace; day: string; minute: number; blocks: DayBlock[]; dayTasks: Task[]; areaMap: Map<string, Area>; onClose: () => void;
}) {
  const [all, setAll] = useState(false);
  const fit = useMemo(() => fitToday(task, blocks, dayTasks, minute), [task, blocks, dayTasks, minute]);
  const shown = all ? fit.blocks : fit.blocks.slice(0, SHOWN);
  const over = fit.estimated - fit.left;

  function done(choice: string, extra: Record<string, unknown> = {}) {
    track('task_fit_chosen', { choice, blocks_ahead: fit.blocks.length, had_estimate: !!task.estimate, over_min: Math.max(0, over), ...extra });
    onClose();
  }
  async function intoBlock(b: DayBlock, sameArea: boolean) {
    await scheduleTask(task.id, day, b.id, 'fit');
    done('block', { same_area: sameArea });
  }
  async function newBlock() {
    if (!fit.slot) return;
    const { id } = await addBlock(day, { ...fit.slot, title: task.title, areaId: task.areaId ?? DEFAULT_AREA });
    await scheduleTask(task.id, day, id, 'fit');
    done('new_block');
  }
  async function startNow() {
    const cur = fit.blocks.find(b => b.now);
    await startFocus(day, { preset: PRESETS[0], taskId: task.id, blockId: cur?.block.id, areaId: task.areaId ?? cur?.block.areaId ?? DEFAULT_AREA, title: task.title });
    done('focus');
  }
  async function undo() {
    await restoreTask(task.id, prev);
    onClose();
  }

  return (
    <div className="fit" role="dialog" aria-label={m.tasks.fit.added}>
      <div className="fit-head">
        <span className="fit-ok"><Check size={14} />{m.tasks.fit.added}</span>
        <button type="button" className="btn sm ghost" onClick={() => void undo()}><Undo2 size={13} />{m.quick.undo}</button>
        <button type="button" className="btn icon sm ghost" aria-label={m.inspector.close} onClick={() => done('dismiss')}><X size={14} /></button>
      </div>
      <div className="fit-title">{task.title}</div>
      {!task.estimate && (
        <div className="fit-est">
          <span className="muted">{m.tasks.fit.howLong}</span>
          {QUICK_EST.map(e => <button key={e} type="button" className="chip" onClick={() => void updateTask(task.id, { estimate: e }, ['estimate'])}>{fmtDuration(e)}</button>)}
        </div>
      )}
      <span className="label">{m.tasks.fit.where}</span>
      {fit.blocks.length === 0 && (
        <div className="fit-empty">
          <span className="secondary">{m.tasks.fit.notPlanned}</span>
          <Link href="/plan" className="btn sm" onClick={() => done('plan')}>{m.tasks.fit.planDay}</Link>
        </div>
      )}
      <div className="fit-list">
        {shown.map(({ block: b, free, sameArea, now }) => {
          const area = areaMap.get(b.areaId);
          return (
            <button key={b.id} type="button" className={`fit-block${sameArea ? ' same' : ''}`} data-color={area?.color ?? 'gray'} onClick={() => void intoBlock(b, sameArea)}>
              <span className="dot" />
              <span className="tabular muted">{fmtMin(b.start)}</span>
              <span className="fit-name">{b.title}</span>
              {now && <span className="pill" data-color="pink">{m.tasks.fit.now}</span>}
              {sameArea && !now && <span className="pill" data-color={area?.color ?? 'gray'}>{m.tasks.fit.sameArea}</span>}
              <span className={`tabular fit-free${free < (task.estimate ?? 0) ? ' tight' : ''}`}>{free >= 0 ? m.tasks.fit.free(fmtDuration(free)) : m.tasks.fit.over(fmtDuration(-free))}</span>
            </button>
          );
        })}
        {fit.blocks.length > SHOWN && !all && <button type="button" className="btn sm ghost" onClick={() => setAll(true)}>{m.tasks.fit.more(fit.blocks.length - SHOWN)}</button>}
      </div>
      <div className="fit-actions">
        {fit.slot && (
          <button type="button" className="btn sm" onClick={() => void newBlock()}>
            <CalendarPlus size={13} />{m.tasks.fit.newBlock} <span className="tabular muted">{fmtMin(fit.slot.start)}–{fmtMin(fit.slot.end)}</span>
          </button>
        )}
        <button type="button" className="btn sm" onClick={() => void startNow()}><Play size={13} />{m.tasks.fit.startNow}</button>
        <button type="button" className="btn sm ghost" onClick={() => done('keep')}>{m.tasks.fit.keep}</button>
      </div>
      {fit.estimated > 0 && (
        <div className={`fit-load${over > 0 ? ' over' : ''}`}>
          {m.tasks.fit.load(fmtDuration(fit.estimated), fmtDuration(fit.left))}
          {over > 0 && <span>{m.tasks.fit.tooMuch(fmtDuration(over))}</span>}
        </div>
      )}
    </div>
  );
}
