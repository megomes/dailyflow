'use client';
import { AlarmClock, ArrowRightLeft, CircleCheck, Copy, CopyPlus, ExternalLink, Lock, Pencil, Play, Plus, Square, Tag, Timer, Trash2 } from 'lucide-react';
import { m } from '@/i18n/en';
import { getDB } from '@/lib/db';
import {
  addBlock, createTask, dayBlocks, deferTask, deleteRecord, deleteTask, moveTask, nowMinute, PRESETS, PRIORITIES, runningRecord,
  scheduleTask, startActivity, startAlongside, startFocus, stopActivity, toggleTaskDone, updateRecord, updateTask,
} from '@/lib/ops';
import { activeAreas } from '@/lib/repo';
import { deferDate } from '@/lib/taskBoard';
import { fmtMin, logicalDay } from '@/lib/time';
import type { Area, DayBlock, Revision, Task, TimeRecord } from '@/lib/types';
import type { MenuItem, MenuSpec } from './ContextMenu';

/** Menus for the things you act on most (note #22): to-dos, planned blocks and tracked records. */

const ESTIMATES = [15, 30, 45, 60, 90, 120];
const fmtEst = (n: number) => (n < 60 ? `${n}m` : n % 60 ? `${Math.floor(n / 60)}h${n % 60}` : `${n / 60}h`);
const DEFAULT_AREA = 'area-personal';

function areaItems(areas: Area[], current: string | undefined, pick: (id: string) => unknown): MenuItem[] {
  return activeAreas(areas).map(a => ({ label: a.name, color: a.color, checked: a.id === current, onSelect: () => (a.id === current ? undefined : pick(a.id)) }));
}

async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); } catch { /* clipboard blocked: nothing to do */ }
}

// ── To-dos ─────────────────────────────────────────────────────────────────

export async function taskMenu(task: Task, o: { dayId?: string; onOpen?: (t: Task) => void; extra?: MenuItem[]; /** Replaces the Move to list (the board's own sheet, with undo). */ move?: () => void } = {}): Promise<MenuSpec | null> {
  const db = getDB();
  const t = (await db.tasks.get(task.id)) ?? task;
  if (t.deleted) return null;
  const day = o.dayId ?? logicalDay();
  const [areas, blocks, running] = await Promise.all([db.areas.toArray(), dayBlocks(day), runningRecord()]);
  const minute = nowMinute(day);
  const ahead = blocks.filter(b => b.end > minute).sort((a, b) => a.start - b.start);
  const area = areas.find(a => a.id === t.areaId);
  const done = t.status === 'done';
  const open = t.status === 'inbox' || t.status === 'backlog';
  const block = t.blockId ? blocks.find(b => b.id === t.blockId) : undefined;
  const actArea = t.areaId ?? block?.areaId ?? DEFAULT_AREA;
  const snoozed = !!t.deferUntil && t.deferUntil > day;

  return {
    kind: 'task',
    title: t.title,
    subtitle: [area?.name, block ? `${block.title} ${fmtMin(block.start)}` : null].filter(Boolean).join(' · ') || undefined,
    color: area?.color,
    items: [
      { label: done ? m.menu.undone : m.menu.done, icon: <CircleCheck size={14} />, onSelect: () => toggleTaskDone(t.id) },
      o.onOpen && { label: m.menu.open, icon: <ExternalLink size={14} />, onSelect: () => o.onOpen!(t) },
      'sep',
      { label: m.menu.priority, chips: PRIORITIES.map(p => ({
        label: m.tasks.priorities[p], checked: t.priority === p,
        onSelect: () => updateTask(t.id, { priority: t.priority === p ? undefined : p }, ['priority']),
      })) },
      !done && { label: m.menu.estimate, chips: ESTIMATES.map(n => ({
        label: fmtEst(n), checked: t.estimate === n,
        onSelect: () => updateTask(t.id, { estimate: t.estimate === n ? undefined : n }, ['estimate']),
      })) },
      'sep',
      !done && running?.taskId !== t.id && { label: m.menu.startNow, icon: <Play size={14} />, onSelect: () => startActivity(day, { areaId: actArea, title: t.title, blockId: t.blockId, taskId: t.id, source: 'live' }) },
      !done && { label: m.menu.focus, icon: <Timer size={14} />, onSelect: () => startFocus(day, { preset: PRESETS[0], taskId: t.id, blockId: t.blockId, areaId: actArea, title: t.title }) },
      !done && o.move && { label: m.menu.moveTo, icon: <ArrowRightLeft size={14} />, onSelect: o.move },
      !done && !o.move && { label: m.menu.moveTo, icon: <ArrowRightLeft size={14} />, children: [
        ...ahead.map(b => ({ label: `${fmtMin(b.start)} · ${b.title}`, color: areas.find(a => a.id === b.areaId)?.color, checked: t.status === 'today' && t.dayId === day && t.blockId === b.id,
          onSelect: () => scheduleTask(t.id, day, b.id, 'menu') })),
        ahead.length ? 'sep' : null,
        { label: ahead.length ? m.menu.todayNoBlock : m.menu.today, checked: t.status === 'today' && t.dayId === day && !t.blockId, onSelect: () => scheduleTask(t.id, day, undefined, 'menu') },
        { label: m.menu.backlog, checked: t.status === 'backlog', onSelect: () => moveTask(t, 'backlog', day, 'menu') },
        { label: m.menu.inbox, checked: t.status === 'inbox', onSelect: () => moveTask(t, 'inbox', day, 'menu') },
      ] },
      !done && open && { label: m.menu.later, icon: <AlarmClock size={14} />, children: [
        { label: m.tasks.later.tomorrow, onSelect: () => deferTask(t.id, deferDate('tomorrow', day), 'menu') },
        { label: m.tasks.later.week, onSelect: () => deferTask(t.id, deferDate('week', day), 'menu') },
        { label: m.tasks.later.month, onSelect: () => deferTask(t.id, deferDate('month', day), 'menu') },
        snoozed && { label: m.tasks.later.now, onSelect: () => deferTask(t.id, null, 'menu') },
      ] },
      { label: m.menu.area, icon: <Tag size={14} />, hint: area?.name, children: areaItems(areas, t.areaId, id => updateTask(t.id, { areaId: id }, ['area'])) },
      ...(o.extra ?? []),
      'sep',
      { label: m.menu.copyTitle, icon: <Copy size={14} />, onSelect: () => copyText(t.title) },
      { label: m.menu.duplicate, icon: <CopyPlus size={14} />, onSelect: () => createTask(m.menu.copy(t.title), {
        status: done ? 'backlog' : t.status, dayId: done ? undefined : t.dayId, blockId: done ? undefined : t.blockId, areaId: t.areaId, priority: t.priority,
        estimate: t.estimate, notes: t.notes, project: t.project, tags: t.tags, category: t.category, due: t.due,
        subtasks: t.subtasks?.map(x => ({ ...x, id: crypto.randomUUID(), done: false })),
      }, 'menu') },
      { label: m.menu.delete, icon: <Trash2 size={14} />, danger: true, onSelect: () => deleteTask(t.id) },
    ],
  };
}

// ── Planned blocks (Today timeline) ──────────────────────────────────────────

export interface BlockMenuCtx {
  dayId: string;
  live: boolean;
  areas: Area[];
  edit: () => void;
  patch: (p: Partial<DayBlock>, kind: Revision['kind']) => unknown;
  remove: () => unknown;
}

export async function blockMenu(b: DayBlock, c: BlockMenuCtx): Promise<MenuSpec> {
  const running = await runningRecord();
  const alongside = (await getDB().timeRecords.toArray()).filter(r => r.end == null && !r.deleted && r.alongside);
  const minute = nowMinute(c.dayId);
  const area = c.areas.find(a => a.id === b.areaId);
  const cal = !!b.calendar;
  const len = b.end - b.start;
  const on = running?.blockId === b.id || alongside.some(r => r.blockId === b.id);
  const resize = (d: number) => c.patch({ end: Math.max(b.start + 15, b.end + d) }, 'resize');
  return {
    kind: cal ? 'calendar_block' : 'block',
    title: b.title || area?.name,
    subtitle: `${fmtMin(b.start)}–${fmtMin(b.end)}${area ? ` · ${area.name}` : ''}`,
    color: area?.color,
    items: [
      c.live && !on && { label: m.menu.startNow, icon: <Play size={14} />, onSelect: () => startActivity(c.dayId, { areaId: b.areaId, title: b.title, blockId: b.id, source: 'live' }) },
      c.live && !on && running && { label: m.menu.startAlongside, icon: <Plus size={14} />, onSelect: () => startAlongside(c.dayId, { areaId: b.areaId, title: b.title, blockId: b.id }) },
      c.live && { label: m.menu.focus, icon: <Timer size={14} />, onSelect: () => startFocus(c.dayId, { preset: PRESETS[0], blockId: b.id, areaId: b.areaId, title: b.title }) },
      { label: m.menu.edit, icon: <Pencil size={14} />, onSelect: c.edit },
      'sep',
      !cal && { label: m.menu.length, chips: [
        { label: '−15m', onSelect: () => resize(-15) },
        { label: '+15m', onSelect: () => resize(15) },
        { label: '+30m', onSelect: () => resize(30) },
        { label: '+1h', onSelect: () => resize(60) },
      ] },
      !cal && c.live && b.start !== minute && b.end > minute && { label: m.menu.moveToNow, icon: <ArrowRightLeft size={14} />, hint: `${fmtMin(minute)}–${fmtMin(minute + len)}`,
        onSelect: () => c.patch({ start: minute, end: minute + len }, 'move') },
      { label: m.menu.area, icon: <Tag size={14} />, hint: area?.name, children: areaItems(c.areas, b.areaId, id => c.patch({ areaId: id }, 'area')) },
      !cal && { label: m.menu.fixed, icon: <Lock size={14} />, checked: !!b.fixed, onSelect: () => c.patch({ fixed: !b.fixed }, 'fixed') },
      'sep',
      !cal && { label: m.menu.duplicate, icon: <CopyPlus size={14} />, onSelect: () => addBlock(c.dayId, { start: b.end, end: b.end + len, title: b.title, areaId: b.areaId }) },
      { label: cal ? m.menu.ignoreEvent : m.menu.delete, icon: <Trash2 size={14} />, danger: true, onSelect: c.remove },
    ],
  };
}

// ── Tracked records (Actual column) ──────────────────────────────────────────

export function recordMenu(r: TimeRecord, c: { dayId: string; live: boolean; areas: Area[]; edit: () => void; blocks: DayBlock[] }): MenuSpec {
  const area = c.areas.find(a => a.id === r.areaId);
  const runningNow = r.end == null;
  return {
    kind: 'record',
    title: r.title || area?.name,
    subtitle: `${fmtMin(r.start)}–${runningNow ? 'now' : fmtMin(r.end!)}${area ? ` · ${area.name}` : ''}`,
    color: area?.color,
    items: [
      runningNow && { label: m.menu.stop, icon: <Square size={14} />, onSelect: () => stopActivity(r.id) },
      !runningNow && c.live && { label: m.menu.continue, icon: <Play size={14} />, onSelect: () => startActivity(c.dayId, { areaId: r.areaId, title: r.title, blockId: r.blockId, taskId: r.taskId, source: 'live' }) },
      { label: m.menu.edit, icon: <Pencil size={14} />, onSelect: c.edit },
      'sep',
      { label: m.menu.area, icon: <Tag size={14} />, hint: area?.name, children: areaItems(c.areas, r.areaId, id => updateRecord(r.id, { areaId: id }, 'area')) },
      { label: m.menu.copyTitle, icon: <Copy size={14} />, onSelect: () => copyText(r.title || area?.name || '') },
      'sep',
      { label: m.menu.delete, icon: <Trash2 size={14} />, danger: true, onSelect: () => deleteRecord(r.id) },
    ],
  };
}
