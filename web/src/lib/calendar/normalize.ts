import type { CalClass, CalEvent, CalProvider } from '../types';

/**
 * Provider payloads → CalEvent rows (pure, runs on the server, unit-tested with real-shaped
 * payloads). Times are placed in the user's time zone and logical day (cutoff hour), split
 * across days when an event crosses the cutoff.
 */

export interface LocalParts { y: number; m: number; d: number; h: number; min: number }

const fmtCache = new Map<string, Intl.DateTimeFormat>();
export function localParts(at: Date, tz: string): LocalParts {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
function shiftDay(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Logical day and minute (01:30 before a 04:00 cutoff → previous day, 1530). */
export function logicalAt(at: Date, tz: string, cutoff: number): { day: string; min: number } {
  const p = localParts(at, tz);
  const day = iso(p.y, p.m, p.d);
  const min = p.h * 60 + p.min;
  return p.h < cutoff ? { day: shiftDay(day, -1), min: min + 1440 } : { day, min };
}

export interface RawEvent {
  eventId: string;
  title: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** For all-day events: local dates [startDate, endDate) as in the source. */
  startDate?: string;
  endDate?: string;
  free: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  declined: boolean;
  /** Outlook categories (e.g. “Blocker”: a hold nobody should book over — ignored). */
  categories?: string[];
}

/** Splits one event into per-logical-day rows. Ids are stable: calendarKey:eventId:day. */
export function toRows(ev: RawEvent, calendarKey: string, provider: CalProvider, tz: string, cutoff: number): Omit<CalEvent, 'updatedAt'>[] {
  const base = { calendarKey, provider, eventId: ev.eventId, title: ev.title || '(no title)', ...(ev.location ? { location: ev.location } : {}), ...(ev.free ? { free: true } : {}), status: ev.status };
  if (ev.allDay && ev.startDate && ev.endDate) {
    const out: Omit<CalEvent, 'updatedAt'>[] = [];
    for (let d = ev.startDate; d < ev.endDate; d = shiftDay(d, 1)) {
      out.push({ ...base, id: `${calendarKey}:${ev.eventId}:${d}`, dayId: d, start: cutoff * 60, end: 24 * 60 + cutoff * 60, allDay: true });
      if (out.length > 60) break;
    }
    return out;
  }
  const s = logicalAt(ev.start, tz, cutoff);
  const e = logicalAt(new Date(ev.end.getTime() - 1), tz, cutoff); // end is exclusive
  const endMin = e.min + 1; // e is the minute containing the last instant
  const out: Omit<CalEvent, 'updatedAt'>[] = [];
  let day = s.day;
  for (let guard = 0; guard < 31; guard++) {
    const first = day === s.day, last = day === e.day;
    const start = first ? s.min : cutoff * 60;
    const end = last ? Math.round(endMin) : 24 * 60 + cutoff * 60;
    if (end > start) out.push({ ...base, id: `${calendarKey}:${ev.eventId}:${day}`, dayId: day, start, end });
    if (last) break;
    day = shiftDay(day, 1);
  }
  return out;
}

// ── Google Calendar API v3 ────────────────────────────────────────────────

export interface GoogleEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  location?: string;
  transparency?: 'opaque' | 'transparent';
  eventType?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

export function fromGoogle(e: GoogleEvent): RawEvent | null {
  if (!e.start || !e.end) return null;
  if (e.eventType === 'workingLocation') return null;
  const allDay = !!e.start.date && !e.start.dateTime;
  const declined = !!e.attendees?.some(a => a.self && a.responseStatus === 'declined');
  return {
    eventId: e.id,
    title: e.summary ?? '',
    location: e.location,
    allDay,
    start: new Date(e.start.dateTime ?? `${e.start.date}T00:00:00Z`),
    end: new Date(e.end.dateTime ?? `${e.end.date}T00:00:00Z`),
    startDate: e.start.date,
    endDate: e.end.date,
    free: e.transparency === 'transparent',
    status: e.status ?? 'confirmed',
    declined,
  };
}

// ── Microsoft Graph (calendarView, requested with Prefer: outlook.timezone="UTC") ──

export interface GraphEvent {
  id: string;
  subject?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  start?: { dateTime: string; timeZone?: string };
  end?: { dateTime: string; timeZone?: string };
  location?: { displayName?: string };
  responseStatus?: { response?: string };
  categories?: string[];
}

/** Graph returns "2026-10-05T13:00:00.0000000" in the requested zone (UTC). */
const graphDate = (s: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s.slice(0, 23)}Z`);

export function fromGraph(e: GraphEvent): RawEvent | null {
  if (!e.start || !e.end) return null;
  const allDay = !!e.isAllDay;
  return {
    eventId: e.id,
    title: e.subject ?? '',
    location: e.location?.displayName || undefined,
    allDay,
    start: graphDate(e.start.dateTime),
    end: graphDate(e.end.dateTime),
    startDate: allDay ? e.start.dateTime.slice(0, 10) : undefined,
    endDate: allDay ? e.end.dateTime.slice(0, 10) : undefined,
    free: e.showAs === 'free' || e.showAs === 'workingElsewhere',
    status: e.isCancelled ? 'cancelled' : e.showAs === 'tentative' ? 'tentative' : 'confirmed',
    declined: e.responseStatus?.response === 'declined',
    categories: e.categories,
  };
}

/** Default classification for a newly connected calendar (the user changes it in Settings). */
export function defaultClass(name: string, primary: boolean, provider: CalProvider): CalClass {
  const n = name.toLowerCase();
  if (/holiday|feriad|birthday|aniversár|week numbers|contacts/.test(n)) return 'hidden';
  if (primary || provider === 'microsoft') return 'commitment';
  return 'awareness';
}

/** Effective classification: per-event override first, then the calendar's. */
export function effectiveClass(ev: CalEvent, calendars: Map<string, { classification: CalClass }>, overrides: Map<string, CalClass>): CalClass {
  return overrides.get(ev.id) ?? calendars.get(ev.calendarKey)?.classification ?? 'awareness';
}
