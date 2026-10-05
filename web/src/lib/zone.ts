/** Time zone helpers for server-side code (the server runs in UTC; the user does not). */
const fmtCache = new Map<string, Intl.DateTimeFormat>();

export function localParts(at: Date, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Logical day and minute in `tz` (01:30 before a 04:00 cutoff → previous day, 1530). */
export function logicalAt(at: Date, tz: string, cutoff: number): { day: string; min: number } {
  const p = localParts(at, tz);
  const min = p.h * 60 + p.min;
  if (p.h >= cutoff) return { day: `${p.y}-${pad(p.m)}-${pad(p.d)}`, min };
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d - 1));
  return { day: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, min: min + 1440 };
}
