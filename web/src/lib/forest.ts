import { recEnd } from './actual';
import { addDays, dateFromIso } from './time';
import type { Area, TimeRecord } from './types';

/**
 * Forest (EH, spec §85): time actually lived grows a world. Every area has its own species,
 * consistency over weeks matures the trees, nothing is ever lost — replanning, rest and family
 * time never punish. Pure and deterministic: the same records always grow the same forest.
 */

export const SPECIES = ['oak', 'pine', 'birch', 'maple', 'cypress', 'cherry', 'palm', 'willow', 'bamboo', 'fern', 'flower'] as const;
export type Species = (typeof SPECIES)[number];

/** Species by area order: stable (an area keeps its species when others are added or archived). */
export function speciesFor(area: Pick<Area, 'id' | 'sort'>, all: Pick<Area, 'id' | 'sort'>[]): Species {
  const sorted = [...all].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  const i = Math.max(0, sorted.findIndex(a => a.id === area.id));
  return SPECIES[i % SPECIES.length];
}

export const MIN_GROW = 15;
export const MIN_PER_TREE = 45;
export const MAX_TREES = 6;
/** A day's plot holds at most this many trees; every area present gets at least one. */
export const MAX_PER_DAY = 8;

export interface Tree { areaId: string; species: Species; size: 0 | 1 | 2 | 3; seed: number }
export interface Plot { day: string; trees: Tree[]; minutes: Map<string, number> }

/** Maturity from consistency: distinct days with the area in the 28 days up to `day`. */
export function maturity(daysWithArea: Set<string>, day: string): 0 | 1 | 2 | 3 {
  let n = 0;
  for (let i = 0; i < 28; i++) if (daysWithArea.has(addDays(day, -i))) n++;
  return n >= 15 ? 3 : n >= 8 ? 2 : n >= 3 ? 1 : 0;
}

/** Small deterministic hash for placement jitter. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

export function grow(records: TimeRecord[], areas: Area[]): Map<string, Plot> {
  const perDay = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (r.deleted || r.end == null) continue;
    const m = recEnd(r, r.start) - r.start;
    if (m <= 0) continue;
    const d = perDay.get(r.dayId) ?? new Map<string, number>();
    d.set(r.areaId, (d.get(r.areaId) ?? 0) + m);
    perDay.set(r.dayId, d);
  }
  const daysWith = new Map<string, Set<string>>();
  for (const [day, mins] of perDay) for (const [a, v] of mins) if (v >= MIN_GROW) {
    const s = daysWith.get(a) ?? new Set<string>();
    s.add(day);
    daysWith.set(a, s);
  }
  const areaById = new Map(areas.map(a => [a.id, a]));
  const plots = new Map<string, Plot>();
  for (const [day, mins] of perDay) {
    const trees: Tree[] = [];
    const grown = [...mins.entries()].filter(([, v]) => v >= MIN_GROW).sort((a, b) => b[1] - a[1]);
    // Each area gets one tree, then the rest of the day's budget goes by time spent.
    const want = grown.map(([, v]) => Math.min(MAX_TREES, Math.max(1, Math.round(v / MIN_PER_TREE))));
    const count = grown.map(() => 1);
    let left = Math.max(0, MAX_PER_DAY - grown.length);
    while (left > 0) {
      let best = -1;
      for (let i = 0; i < grown.length; i++) if (count[i] < want[i] && (best < 0 || grown[i][1] / count[i] > grown[best][1] / count[best])) best = i;
      if (best < 0) break;
      count[best]++; left--;
    }
    grown.forEach(([areaId], k) => {
      const area = areaById.get(areaId);
      const species = area ? speciesFor(area, areas) : 'fern';
      const size = maturity(daysWith.get(areaId) ?? new Set(), day);
      for (let i = 0; i < count[k]; i++) trees.push({ areaId, species, size, seed: hash(`${day}:${areaId}:${i}`) });
    });
    plots.set(day, { day, trees, minutes: mins });
  }
  return plots;
}

export interface Unlock { species: Species; areaId: string; day: string; mature?: string }

/** Collection: first day each species appeared, and the first day it reached full maturity. */
export function collection(plots: Map<string, Plot>): Unlock[] {
  const out = new Map<string, Unlock>();
  for (const day of [...plots.keys()].sort()) {
    for (const t of plots.get(day)!.trees) {
      const u = out.get(t.species) ?? { species: t.species, areaId: t.areaId, day };
      if (t.size === 3 && !u.mature) u.mature = day;
      out.set(t.species, u);
    }
  }
  return [...out.values()];
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** Season of a date; `south` flips it (Brazil: October is spring). */
export function season(day: string, south = true): Season {
  const m = dateFromIso(day).getMonth();
  const north: Season[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
  const s = north[m];
  if (!south) return s;
  return ({ spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' } as const)[s];
}

export function forestStats(plots: Map<string, Plot>) {
  let trees = 0, mature = 0;
  for (const p of plots.values()) for (const t of p.trees) { trees++; if (t.size === 3) mature++; }
  return { trees, mature, days: plots.size };
}
