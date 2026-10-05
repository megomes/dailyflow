import { addDays, dateFromIso, isoDate } from './time';
import type { Recurrence } from './types';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isWeekend = (iso: string) => [0, 6].includes(dateFromIso(iso).getDay());

/** Saturday/Sunday → the following Monday (when the rule asks for business days). */
function toBusinessDay(iso: string, rule: Recurrence): string {
  if (!rule.businessDay) return iso;
  let d = iso;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/** Day `monthDay` of the month `months` after the month of `from` (clamped to the month's last day). */
function monthDayIn(from: string, months: number, monthDay: number): string {
  const d = dateFromIso(from);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(monthDay, last));
  return isoDate(d);
}

/** Next due date after `from` (YYYY-MM-DD) for a recurrence rule. */
export function nextDate(rule: Recurrence, from: string): string {
  const n = Math.max(1, rule.interval ?? 1);
  switch (rule.freq) {
    case 'daily': return addDays(from, n);
    case 'weekly': {
      if (rule.weekday == null) return addDays(from, 7 * n);
      // The next chosen weekday after `from`, then the extra weeks of the interval.
      let d = addDays(from, 1);
      while (dateFromIso(d).getDay() !== rule.weekday) d = addDays(d, 1);
      return addDays(d, 7 * (n - 1));
    }
    case 'weekdays': {
      let d = addDays(from, 1);
      while (isWeekend(d)) d = addDays(d, 1);
      return d;
    }
    case 'monthly': {
      // A fixed day of the month (e.g. the 1st) stays the anchor even when a business-day shift moved the last one.
      const day = rule.monthDay ?? dateFromIso(from).getDate();
      return toBusinessDay(monthDayIn(from, n, day), rule);
    }
  }
}

/** First occurrence on or after `today` (used as the due date when a rule is set on a to-do without one). */
export function firstDate(rule: Recurrence, today: string): string {
  if (rule.freq === 'weekly' && rule.weekday != null) {
    let d = today;
    while (dateFromIso(d).getDay() !== rule.weekday) d = addDays(d, 1);
    return d;
  }
  if (rule.freq === 'monthly' && rule.monthDay != null) {
    const thisMonth = toBusinessDay(monthDayIn(today, 0, rule.monthDay), rule);
    return thisMonth >= today ? thisMonth : toBusinessDay(monthDayIn(today, 1, rule.monthDay), rule);
  }
  if (rule.freq === 'weekdays' && isWeekend(today)) return nextDate(rule, today);
  return today;
}

export function describe(rule: Recurrence): string {
  const n = rule.interval ?? 1;
  if (rule.freq === 'weekdays') return 'Every weekday';
  if (rule.freq === 'weekly' && rule.weekday != null) return n === 1 ? `Every ${WEEKDAY_NAMES[rule.weekday]}` : `Every ${n} weeks on ${WEEKDAY_NAMES[rule.weekday]}`;
  if (rule.freq === 'monthly' && rule.monthDay != null) {
    const ord = (d: number) => `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;
    return `Monthly on the ${ord(rule.monthDay)}${rule.businessDay ? ' (or next business day)' : ''}`;
  }
  const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[rule.freq];
  return n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;
}

/** A recurring to-do stays out of sight until [lead] days before it is due, like a snoozed one (note #11). */
export function revealOn(due: string, lead = 1, today: string): string | undefined {
  const day = addDays(due, -Math.max(0, lead));
  return day > today ? day : undefined;
}
