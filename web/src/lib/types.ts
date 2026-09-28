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

export type TemplateId = 'weekday' | 'weekend';

export interface TemplateBlock extends SyncFields {
  templateId: TemplateId;
  start: number;
  end: number;
  title: string;
  areaId: string;
}

export interface Day extends SyncFields {
  /** Same as the logical date, YYYY-MM-DD. */
  templateId: TemplateId;
  createdAt: string;
}

export interface DayBlock extends SyncFields {
  dayId: string;
  start: number;
  end: number;
  title: string;
  areaId: string;
  /** Template block this block was copied from, if any. */
  fromTemplate?: string;
}

/** One answered (or skipped) daily check-in, keyed by the day it is about. */
export interface Checkin extends SyncFields {
  day: string;
  status: 'answered' | 'skipped';
  answers: Record<string, string>;
}

export type Entity = 'area' | 'template_block' | 'day' | 'day_block' | 'checkin';

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
}
