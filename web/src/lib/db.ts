import Dexie, { type Table } from 'dexie';
import type { Area, Checkin, Day, DayBlock, Entity, FocusSession, OutboxItem, Prefs, ProductEvent, Revision, SyncFields, Task, TemplateBlock, TimeRecord } from './types';

/** Local-first store. The UI reads and writes only here; sync.ts reconciles with the server. */
export class DailyFlowDB extends Dexie {
  areas!: Table<Area, string>;
  templateBlocks!: Table<TemplateBlock, string>;
  days!: Table<Day, string>;
  dayBlocks!: Table<DayBlock, string>;
  checkins!: Table<Checkin, string>;
  timeRecords!: Table<TimeRecord, string>;
  tasks!: Table<Task, string>;
  revisions!: Table<Revision, string>;
  focusSessions!: Table<FocusSession, string>;
  prefs!: Table<Prefs, string>;
  outbox!: Table<OutboxItem, number>;
  events!: Table<ProductEvent, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor(name = 'dailyflow') {
    super(name);
    this.version(1).stores({
      areas: 'id, sort',
      templateBlocks: 'id, templateId',
      days: 'id',
      dayBlocks: 'id, dayId',
      checkins: 'id',
      outbox: '++seq, [entity+id]',
      events: 'id, ts, synced',
      meta: 'key',
    });
    // E2–E8: actual time, tasks, plan revisions, focus sessions, synced preferences.
    this.version(2).stores({
      timeRecords: 'id, dayId, taskId',
      tasks: 'id, status, dayId',
      revisions: 'id, dayId',
      focusSessions: 'id, dayId, taskId, state',
      prefs: 'id',
    });
  }
}

let instance: DailyFlowDB | null = null;
export function getDB(): DailyFlowDB {
  if (!instance) instance = new DailyFlowDB();
  return instance;
}
/** Tests swap the database. */
export function setDB(db: DailyFlowDB) { instance = db; }

type SyncTable = 'areas' | 'templateBlocks' | 'days' | 'dayBlocks' | 'checkins' | 'timeRecords' | 'tasks' | 'revisions' | 'focusSessions' | 'prefs';
export const ENTITY_TABLE: Record<Entity, SyncTable> = {
  area: 'areas',
  template_block: 'templateBlocks',
  day: 'days',
  day_block: 'dayBlocks',
  checkin: 'checkins',
  time_record: 'timeRecords',
  task: 'tasks',
  revision: 'revisions',
  focus_session: 'focusSessions',
  pref: 'prefs',
};
export const ENTITIES = Object.keys(ENTITY_TABLE) as Entity[];

export function tableFor(db: DailyFlowDB, entity: Entity): Table<SyncFields, string> {
  return db[ENTITY_TABLE[entity]] as unknown as Table<SyncFields, string>;
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await getDB().meta.get(key);
  return row ? (row.value as T) : fallback;
}
export async function setMeta(key: string, value: unknown) {
  await getDB().meta.put({ key, value });
}
