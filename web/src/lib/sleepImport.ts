import { logicalAt } from './zone';
import type { Sleep } from './types';

/**
 * Health Connect sleep sessions (Samsung Health writes them there) → Sleep records (note #29).
 * Pure: the route writes them. Stage codes are Health Connect's SleepSessionRecord stages.
 */
export interface HcSession { id: string; start: string; end: string; stages?: { stage: number; start: string; end: string }[] }

const STAGE: Record<number, keyof NonNullable<Sleep['stages']> | null> = { 1: 'awake', 2: 'light', 3: 'awake', 4: 'light', 5: 'deep', 6: 'rem', 7: 'awake', 0: null };

export function fromHealth(s: HcSession, tz: string): Omit<Sleep, 'updatedAt'> {
  const start = new Date(s.start), end = new Date(s.end);
  const mins = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / 60000);
  let stages: Sleep['stages'];
  if (s.stages?.length) {
    stages = { deep: 0, light: 0, rem: 0, awake: 0 };
    for (const st of s.stages) { const k = STAGE[st.stage]; if (k) stages[k] += mins(st.start, st.end); }
    for (const k of Object.keys(stages) as (keyof typeof stages)[]) stages[k] = Math.round(stages[k]);
  }
  return {
    id: `hc-${s.id}`,
    // Noon to noon: going to bed at 03:00 is still last night.
    night: logicalAt(start, tz, 12).day,
    start: start.toISOString(),
    end: end.toISOString(),
    source: 'health',
    hcId: s.id,
    ...(stages ? { stages } : {}),
  };
}

/** Manual nights the watch now covers (more than half of the manual one overlaps): they give way. */
export function supersededManual(manual: Pick<Sleep, 'id' | 'start' | 'end'>[], health: Pick<Sleep, 'start' | 'end'>[]): string[] {
  return manual.filter(mn => {
    if (!mn.end) return false;
    const a = Date.parse(mn.start), b = Date.parse(mn.end);
    const overlap = health.reduce((sum, h) => sum + Math.max(0, Math.min(b, Date.parse(h.end!)) - Math.max(a, Date.parse(h.start))), 0);
    return overlap > (b - a) / 2;
  }).map(mn => mn.id);
}
