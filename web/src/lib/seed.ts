import { DAY_KEYS } from './time';
import type { Area, DayKey, TemplateBlock } from './types';

/**
 * Initial data from the product spec (§8, §11). Seeds use a fixed epoch timestamp and
 * deterministic ids, so every device seeds identically and any real edit (newer
 * timestamp) wins during sync.
 */
export const SEED_TS = '1970-01-01T00:00:00.000Z';

export const SEED_AREAS: Area[] = [
  ['work', 'Work', 'blue', 'briefcase'],
  ['music', 'Music', 'purple', 'music'],
  ['physical', 'Physical Activity', 'red', 'dumbbell'],
  ['family', 'Family', 'green', 'heart'],
  ['maker', 'Maker', 'orange', 'wrench'],
  ['flightsim', 'FlightSim', 'yellow', 'plane'],
  ['rest', 'Rest', 'teal', 'coffee'],
  ['leisure', 'Leisure', 'pink', 'gamepad'],
  ['commute', 'Commute', 'cyan', 'car'],
  ['personal', 'Personal', 'gray', 'user'],
  ['sleep', 'Sleep', 'indigo', 'moon'],
  ['wasted', 'Wasted time', 'red', 'phone'],
].map(([id, name, color, icon], sort) => ({ id: `area-${id}`, name, color, icon, sort, updatedAt: SEED_TS, ...(id === 'wasted' ? { wasted: true } : {}) }) as Area);

const H = (h: number, m = 0) => h * 60 + m;

type Row = [number, number, string, string];

const WEEKDAY: Row[] = [
  [H(6), H(9), 'Maker', 'maker'],
  [H(9), H(10), 'School run', 'commute'],
  [H(10), H(11), 'Work', 'work'],
  [H(11), H(12), 'Guitar or Piano', 'music'],
  [H(12), H(14), 'Lunch + FlightSim', 'flightsim'],
  [H(14), H(17, 30), 'Work', 'work'],
  [H(17, 30), H(18, 30), 'School run', 'commute'],
  [H(18, 30), H(21), 'Family + Dinner + Night Routine', 'family'],
  [H(21), H(22), 'Reading / Sleep', 'sleep'],
];

/** The spec does not define a weekend template; this is a starting hypothesis to be edited. */
const WEEKEND: Row[] = [
  [H(7), H(9), 'Family breakfast', 'family'],
  [H(9), H(12), 'Maker', 'maker'],
  [H(12), H(14), 'Lunch', 'family'],
  [H(14), H(16), 'FlightSim', 'flightsim'],
  [H(16), H(18, 30), 'Family time', 'family'],
  [H(18, 30), H(21), 'Dinner + Leisure', 'leisure'],
  [H(21), H(22), 'Reading / Sleep', 'sleep'],
];

/**
 * Template block ids are `tb-<day>:<source id>`, the same ids the Weekday/Weekend → per-day
 * migration produces, so fresh and migrated devices converge on identical records.
 */
export const dayBlockId = (day: DayKey, sourceId: string) => `tb-${day}:${sourceId}`;

function rows(day: DayKey, source: 'weekday' | 'weekend', list: Row[]): TemplateBlock[] {
  return list.map(([start, end, title, area], i) => ({
    id: dayBlockId(day, `tb-${source}-${i + 1}`),
    templateId: day, start, end, title, areaId: `area-${area}`, updatedAt: SEED_TS,
  }));
}

/** Monday–Friday start from the spec's Weekday template, Saturday and Sunday from the Weekend one. */
export const SEED_TEMPLATE_BLOCKS: TemplateBlock[] = DAY_KEYS.flatMap(d =>
  d === 'sat' || d === 'sun' ? rows(d, 'weekend', WEEKEND) : rows(d, 'weekday', WEEKDAY));
