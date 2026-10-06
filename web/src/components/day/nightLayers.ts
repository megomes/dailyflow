import { clockOf, mainSleeps, targetSpan, type SleepTarget } from '@/lib/sleep';
import { addDays, minuteOfDay } from '@/lib/time';
import type { Sleep } from '@/lib/types';
import type { TLMark, TLNight } from '../Timeline';

const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);

/**
 * Sleep as sky behind the day (note #29): last night's end and tonight's start (real), and the plan's
 * wake-up and bedtime (dashed). Same on Today, Day and Close the day.
 */
export function buildNightLayers(dayId: string, sleeps: Sleep[], target: SleepTarget, plannedWakeAt: number | undefined, until: number) {
  const nightMap = mainSleeps(sleeps);
  const lastN = nightMap.get(addDays(dayId, -1)), tonightN = nightMap.get(dayId);
  const plannedWake = plannedWakeAt ?? target.wake, plannedBed = targetSpan(target).bed;
  const realNights: TLNight[] = [], realMarks: TLMark[] = [];
  if (lastN) {
    const wake = lastN.end ? Math.round(minuteOfDay(dayId, new Date(lastN.end))) : Math.round(until);
    realNights.push({ start: 0, end: wake, part: 'morning' });
    if (lastN.end) {
      const delta = wake - plannedWake;
      realMarks.push({ at: wake, kind: 'wake', night: lastN.night, tone: Math.abs(delta) < 5 ? 'ok' : delta > 0 ? 'late' : 'early',
        text: `Woke ${clockOf(wake)}${Math.abs(delta) >= 5 ? ` · ${dur(Math.abs(delta))} ${delta > 0 ? 'later' : 'earlier'}` : ''}` });
    }
  }
  if (tonightN) {
    const bed = Math.round(minuteOfDay(dayId, new Date(tonightN.start)));
    const delta = bed - plannedBed;
    realNights.push({ start: bed, end: 1800, part: 'night' });
    realMarks.push({ at: bed, kind: 'bed', night: tonightN.night, tone: Math.abs(delta) < 5 ? 'ok' : delta > 0 ? 'late' : 'early',
      text: `Bed ${clockOf(bed)}${Math.abs(delta) >= 5 ? ` · ${dur(Math.abs(delta))} ${delta > 0 ? 'later' : 'earlier'}` : ''}` });
  }
  const planNights: TLNight[] = [{ start: 0, end: plannedWake, part: 'morning', planned: true }, { start: plannedBed, end: 1800, part: 'night', planned: true }];
  const planMarks: TLMark[] = [{ at: plannedWake, kind: 'wake', text: `Wake ${clockOf(plannedWake)}`, planned: true }, { at: plannedBed, kind: 'bed', text: `Bed ${clockOf(plannedBed)}`, planned: true }];
  return { realNights, realMarks, planNights, planMarks };
}
