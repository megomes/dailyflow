import { describe, expect, it } from 'vitest';
import { defaultClass, effectiveClass, fromGoogle, fromGraph, logicalAt, toRows } from './normalize';
import type { CalEvent } from '../types';

const TZ = 'America/Sao_Paulo';

describe('time placement', () => {
  it('maps instants to the logical day in the user zone', () => {
    expect(logicalAt(new Date('2026-10-05T13:00:00Z'), TZ, 4)).toEqual({ day: '2026-10-05', min: 600 });
    // 01:30 local on the 6th belongs to the 5th
    expect(logicalAt(new Date('2026-10-06T04:30:00Z'), TZ, 4)).toEqual({ day: '2026-10-05', min: 1530 });
  });
});

describe('Google', () => {
  it('normalizes a timed event', () => {
    const raw = fromGoogle({ id: 'g1', summary: 'Standup', start: { dateTime: '2026-10-05T10:00:00-03:00' }, end: { dateTime: '2026-10-05T10:30:00-03:00' }, status: 'confirmed' })!;
    expect(toRows(raw, 'google:a:primary', 'google', TZ, 4)).toEqual([
      { calendarKey: 'google:a:primary', provider: 'google', eventId: 'g1', title: 'Standup', status: 'confirmed', id: 'google:a:primary:g1:2026-10-05', dayId: '2026-10-05', start: 600, end: 630 },
    ]);
  });
  it('splits an event across the day cutoff and handles all-day and declined', () => {
    const raw = fromGoogle({ id: 'g2', summary: 'Night flight', start: { dateTime: '2026-10-05T23:00:00-03:00' }, end: { dateTime: '2026-10-06T06:00:00-03:00' } })!;
    const rows = toRows(raw, 'k', 'google', TZ, 4);
    expect(rows.map(r => [r.dayId, r.start, r.end])).toEqual([['2026-10-05', 1380, 1680], ['2026-10-06', 240, 360]]);
    const allDay = toRows(fromGoogle({ id: 'g3', summary: 'Trip', start: { date: '2026-10-05' }, end: { date: '2026-10-07' } })!, 'k', 'google', TZ, 4);
    expect(allDay.map(r => [r.dayId, r.allDay])).toEqual([['2026-10-05', true], ['2026-10-06', true]]);
    expect(fromGoogle({ id: 'g4', start: { dateTime: '2026-10-05T10:00:00Z' }, end: { dateTime: '2026-10-05T11:00:00Z' }, attendees: [{ self: true, responseStatus: 'declined' }] })!.declined).toBe(true);
    expect(fromGoogle({ id: 'g5', transparency: 'transparent', start: { dateTime: '2026-10-05T10:00:00Z' }, end: { dateTime: '2026-10-05T11:00:00Z' } })!.free).toBe(true);
  });
});

describe('Microsoft Graph', () => {
  it('reads UTC calendarView times without offset', () => {
    const raw = fromGraph({ id: 'm1', subject: '1:1', showAs: 'busy', start: { dateTime: '2026-10-05T17:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-05T17:45:00.0000000', timeZone: 'UTC' } })!;
    expect(toRows(raw, 'ms:a:c', 'microsoft', TZ, 4)[0]).toMatchObject({ dayId: '2026-10-05', start: 840, end: 885, title: '1:1' });
    expect(fromGraph({ id: 'm2', isCancelled: true, start: { dateTime: '2026-10-05T17:00:00' }, end: { dateTime: '2026-10-05T18:00:00' } })!.status).toBe('cancelled');
  });
});

describe('classification', () => {
  it('picks defaults and applies overrides', () => {
    expect(defaultClass('Holidays in Brazil', false, 'google')).toBe('hidden');
    expect(defaultClass('me@gmail.com', true, 'google')).toBe('commitment');
    expect(defaultClass('Family', false, 'google')).toBe('awareness');
    const ev = { id: 'e', calendarKey: 'c' } as CalEvent;
    expect(effectiveClass(ev, new Map([['c', { classification: 'awareness' }]]), new Map())).toBe('awareness');
    expect(effectiveClass(ev, new Map([['c', { classification: 'awareness' }]]), new Map([['e', 'commitment']]))).toBe('commitment');
  });
});
