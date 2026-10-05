export type ColorKey = 'blue' | 'purple' | 'pink' | 'orange' | 'green' | 'cyan' | 'yellow' | 'red' | 'indigo' | 'teal' | 'gray';

/** Fields every synced record carries. `updatedAt` is an ISO timestamp; the newest write wins. */
export interface SyncFields {
  id: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Area extends SyncFields {
  name: string;
  color: ColorKey;
  icon: string;
  sort: number;
  archived?: boolean;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** One template per weekday (note #2). 'weekday' / 'weekend' remain only on days created before that change. */
export type TemplateId = DayKey | 'weekday' | 'weekend';

export interface TemplateBlock extends SyncFields {
  templateId: TemplateId;
  start: number;
  end: number;
  title: string;
  areaId: string;
  /** Copied to the day: fixed blocks keep their time when replanning. */
  fixed?: boolean;
}

export type DayStatus = 'unplanned' | 'active' | 'closed';

/** A frozen copy of a plan block (Baseline snapshot, revision before/after). */
export interface PlanBlock {
  id: string;
  start: number;
  end: number;
  title: string;
  areaId: string;
  fixed?: boolean;
}

export interface Reflection {
  /** 1–5 */
  energy?: number;
  wentWell?: string;
  change?: string;
}

export interface Day extends SyncFields {
  /** Same as the logical date, YYYY-MM-DD. */
  templateId: TemplateId;
  createdAt: string;
  /** Missing on days created before E2: treated as 'unplanned' (or 'active' once anything is tracked). */
  status?: DayStatus;
  startedAt?: string;
  /** How the day was started: one click, guided planning, or late start from now. */
  startMode?: 'quick' | 'guided' | 'late' | 'implicit';
  /** The plan accepted at Start day. Never changed afterwards (spec §6.1). */
  baseline?: PlanBlock[];
  closedAt?: string;
  reopenedAt?: string;
  reflection?: Reflection;
}

export interface DayBlock extends SyncFields {
  dayId: string;
  start: number;
  end: number;
  title: string;
  areaId: string;
  /** Template block this block was copied from, if any. */
  fromTemplate?: string;
  /** Fixed blocks keep their time when the rest of the day is replanned (E3). */
  fixed?: boolean;
}

/** What actually happened (spec §25). Minutes are relative to the logical day's date, like blocks. */
export interface TimeRecord extends SyncFields {
  dayId: string;
  start: number;
  /** null while the activity is running. */
  end: number | null;
  /** ISO start, so a running activity's elapsed time is exact on every device. */
  startedAt?: string;
  areaId: string;
  title: string;
  blockId?: string;
  taskId?: string;
  source: 'live' | 'switch' | 'manual' | 'plan' | 'focus' | 'close';
  createdAt: string;
  /** Set when the record is changed after its day was closed (E7). */
  editedAfterClose?: string;
}

export type TaskStatus = 'inbox' | 'backlog' | 'today' | 'done' | 'archived';
export type Priority = 'high' | 'med' | 'low';

/** Tasks exist apart from blocks (spec §13); scheduling links them to a day and, optionally, a block. */
export interface Task extends SyncFields {
  title: string;
  status: TaskStatus;
  areaId?: string;
  priority?: Priority;
  /** Estimate in minutes. */
  estimate?: number;
  /** YYYY-MM-DD */
  due?: string;
  notes?: string;
  dayId?: string;
  blockId?: string;
  createdAt: string;
  doneAt?: string;
  sort: number;
  /** Days the task was scheduled on and not finished (for “continue from previous days”). */
  carried?: string[];
  /** When it was put on its day after that day had started (not in the plan made for it). */
  addedLate?: string;
  // E12 — optional fields, all empty by default so the core stays light.
  category?: 'work' | 'personal';
  project?: string;
  tags?: string[];
  subtasks?: Subtask[];
  recurrence?: Recurrence;
  /** Recurring series this task was generated from (first task's id). */
  seriesId?: string;
}

export interface Subtask { id: string; title: string; done: boolean }

/** Repeats when completed: the next copy is created with the next due date. */
export interface Recurrence {
  freq: 'daily' | 'weekdays' | 'weekly' | 'monthly';
  /** Every N days/weeks/months (default 1). */
  interval?: number;
}

/** One change to the plan after Start day (spec §7). */
export interface Revision extends SyncFields {
  dayId: string;
  ts: string;
  kind: 'move' | 'resize' | 'add' | 'remove' | 'rename' | 'area' | 'fixed' | 'replan' | 'late_start';
  blockId?: string;
  title: string;
  before?: PlanBlock | null;
  after?: PlanBlock | null;
  reason?: string;
  /** Number of blocks a bulk change (replan) touched. */
  count?: number;
}

export interface FocusSession extends SyncFields {
  dayId: string;
  taskId?: string;
  blockId?: string;
  areaId: string;
  title: string;
  preset: string;
  /** Planned focus minutes; 0 = stopwatch (open-ended). */
  focusMin: number;
  breakMin: number;
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  pausedMs: number;
  state: 'running' | 'paused' | 'done' | 'interrupted';
  /** Minutes of focus actually done, set when the session ends. */
  actualMin?: number;
  breakStartedAt?: string;
  breakEndedAt?: string;
}

/** Synced preferences (single record, id 'prefs'). */
export interface Prefs extends SyncFields {
  dayCutoffHour?: number;
  notifyFocus?: boolean;
  notifyBlocks?: boolean;
  focusPreset?: string;
  /** Weekly goal in minutes per area id (E11). */
  goals?: Record<string, number>;
  /** User focus presets (E12), shown after the built-in ones. */
  customPresets?: { id: string; label: string; focus: number; brk: number }[];
  /** Timeline zoom: 'compact' | 'normal' | 'roomy' (E12). */
  density?: 'compact' | 'normal' | 'roomy';
}

/** One answered (or skipped) daily check-in, keyed by the day it is about. */
export interface Checkin extends SyncFields {
  day: string;
  status: 'answered' | 'skipped';
  answers: Record<string, string>;
}

export type Entity = 'area' | 'template_block' | 'day' | 'day_block' | 'checkin' | 'time_record' | 'task' | 'revision' | 'focus_session' | 'pref';

export interface OutboxItem {
  seq?: number;
  entity: Entity;
  id: string;
}

export interface ProductEvent {
  id: string;
  ts: string;
  day: string;
  stage: string;
  sessionId: string;
  deviceId: string;
  device: 'desktop' | 'mobile' | 'tablet';
  screen: string;
  event: string;
  props: Record<string, unknown>;
  synced: 0 | 1;
}

/** A block as the timeline draws it, for both day and template blocks. */
export interface TimelineBlock {
  id: string;
  start: number;
  end: number;
  title: string;
  areaId: string;
  fixed?: boolean;
}
