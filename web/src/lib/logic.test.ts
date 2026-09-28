import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { layoutLanes, nowNext, visibleRange } from './dayLogic';
import { hashCode, verifyCode } from './password';
import { signSession, verifySession } from './session';
import { addDays, fmtDuration, fmtMin, logicalDay, minutesInLogicalDay, parseHHMM, templateIdForDate } from './time';

const b = (id: string, start: number, end: number) => ({ id, start, end, title: id, areaId: 'a' });

describe('time', () => {
  it('formats and parses clock times', () => {
    expect(fmtMin(0)).toBe('00:00');
    expect(fmtMin(17 * 60 + 30)).toBe('17:30');
    expect(fmtMin(25 * 60)).toBe('01:00');
    expect(parseHHMM('09:05')).toBe(545);
    expect(parseHHMM('24:00')).toBe(1440);
    expect(parseHHMM('25:00')).toBeNull();
    expect(parseHHMM('nope')).toBeNull();
  });
  it('formats durations', () => {
    expect(fmtDuration(45)).toBe('45m');
    expect(fmtDuration(90)).toBe('1h30');
    expect(fmtDuration(120)).toBe('2h');
  });
  it('keeps the logical day until the 04:00 cutoff', () => {
    expect(logicalDay(new Date(2026, 8, 28, 1, 30))).toBe('2026-09-27');
    expect(logicalDay(new Date(2026, 8, 28, 4, 0))).toBe('2026-09-28');
    expect(minutesInLogicalDay(new Date(2026, 8, 28, 1, 30))).toBe(25 * 60 + 30);
  });
  it('picks the template of the day of the week', () => {
    expect(templateIdForDate('2026-09-28')).toBe('mon');
    expect(templateIdForDate('2026-09-29')).toBe('tue');
    expect(templateIdForDate('2026-10-03')).toBe('sat');
    expect(templateIdForDate('2026-10-04')).toBe('sun');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  });
});

describe('now / next', () => {
  const blocks = [b('maker', 360, 540), b('drive', 540, 600), b('work', 600, 660), b('music', 660, 720)];
  it('finds the current and next block', () => {
    const r = nowNext(blocks, 637);
    expect(r.now?.id).toBe('work');
    expect(r.next?.id).toBe('music');
    expect(r.remaining).toBe(23);
    expect(r.untilNext).toBe(23);
  });
  it('handles gaps and the end of the day', () => {
    expect(nowNext(blocks, 300).now).toBeNull();
    expect(nowNext(blocks, 300).next?.id).toBe('maker');
    expect(nowNext(blocks, 800).next).toBeNull();
  });
  it('prefers the most recently started block when blocks overlap', () => {
    const r = nowNext([b('work', 600, 720), b('meeting', 630, 660)], 640);
    expect(r.now?.id).toBe('meeting');
  });
});

describe('lanes', () => {
  it('puts overlapping blocks side by side and leaves others full width', () => {
    const placed = layoutLanes([b('a', 0, 60), b('b', 30, 90), b('c', 120, 180)]);
    const by = Object.fromEntries(placed.map(p => [p.block.id, p]));
    expect(by.a.lanes).toBe(2);
    expect(by.b.lane).toBe(1);
    expect(by.c.lanes).toBe(1);
  });
  it('grows the visible range to fit blocks', () => {
    expect(visibleRange([b('late', 1300, 1410)], 360, 1320)).toEqual([360, 1440]);
  });
});

describe('auth', () => {
  it('verifies access codes ignoring case and spaces', () => {
    const h = hashCode('abcd-efgh');
    expect(verifyCode('ABCD-efgh ', h)).toBe(true);
    expect(verifyCode('abcd-efgx', h)).toBe(false);
    expect(verifyCode('abcd-efgh', undefined)).toBe(false);
  });
  it('signs and verifies device sessions', async () => {
    const t = await signSession('device123abc', 'secret');
    expect(await verifySession(t, 'secret')).toBe('device123abc');
    expect(await verifySession(t, 'other')).toBeNull();
    expect(await verifySession(t.replace('device123abc', 'device999abc'), 'secret')).toBeNull();
  });
});

describe('csv', () => {
  it('escapes commas, quotes and objects', () => {
    expect(toCsv([{ a: 'x,y', b: { k: 1 }, c: 'say "hi"' }], ['a', 'b', 'c'])).toBe('a,b,c\n"x,y","{""k"":1}","say ""hi"""');
  });
});
