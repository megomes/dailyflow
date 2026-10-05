import { addDays, dateFromIso, isoDate } from './time';
import type { Recurrence } from './types';

/** Next due date after `from` (YYYY-MM-DD) for a recurrence rule. */
export function nextDate(rule: Recurrence, from: string): string {
  const n = Math.max(1, rule.interval ?? 1);
  switch (rule.freq) {
    case 'daily': return addDays(from, n);
    case 'weekly': return addDays(from, 7 * n);
    case 'weekdays': {
      let d = addDays(from, 1);
      while ([0, 6].includes(dateFromIso(d).getDay())) d = addDays(d, 1);
      return d;
    }
    case 'monthly': {
      const d = dateFromIso(from);
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return isoDate(d);
    }
  }
}

export function describe(rule: Recurrence): string {
  const n = rule.interval ?? 1;
  if (rule.freq === 'weekdays') return 'Every weekday';
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[rule.freq];
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}
