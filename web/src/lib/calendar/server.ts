import 'server-only';
import { createHash } from 'node:crypto';
import { sql } from '../server';
import type { CalClass, CalProvider } from '../types';
import { defaultClass, fromGoogle, fromGraph, fromIcs, logicalAt, toRows, type GoogleEvent, type GraphEvent, type RawEvent } from './normalize';

/**
 * E9 server side: OAuth for Google and Microsoft, encrypted token storage, reading calendars and
 * events, and writing them as sync_records so every device gets them through /api/sync.
 * ICS accounts (a published Outlook calendar link, no app registration) keep the link sealed in
 * access_token and are read by downloading the file.
 *
 * Env: APP_URL, CALENDAR_TOKEN_KEY (base64, 32 bytes), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *      MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT (default 'common').
 */

export const CAL_SCOPES = {
  // E10 needs write access; reading needs only the first. Asking for events now avoids a second consent.
  // Read-only: DailyFlow only reads calendars (events become blocks).
  google: ['https://www.googleapis.com/auth/calendar.readonly', 'openid', 'email'],
  microsoft: ['offline_access', 'openid', 'email', 'User.Read', 'Calendars.Read'],
} as const;

export function appUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}
export const redirectUri = () => `${appUrl()}/api/calendars/callback`;
const msTenant = () => process.env.MS_TENANT || 'common';

export function providerConfigured(p: CalProvider) {
  if (!process.env.CALENDAR_TOKEN_KEY) return false;
  if (p === 'ics') return true;
  return p === 'google' ? !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) : !!(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export function authUrl(p: CalProvider, state: string): string {
  if (p === 'google') {
    const q = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: 'code', scope: CAL_SCOPES.google.join(' '),
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!, redirect_uri: redirectUri(), response_type: 'code', response_mode: 'query', scope: CAL_SCOPES.microsoft.join(' '), state,
  });
  return `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize?${q}`;
}

// ── Token encryption (AES-GCM) ─────────────────────────────────────────────

const b64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64');
async function key() {
  const raw = Buffer.from(process.env.CALENDAR_TOKEN_KEY ?? '', 'base64');
  if (raw.length !== 32) throw new Error('CALENDAR_TOKEN_KEY must be 32 bytes, base64');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(text));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function unseal(sealed: string): Promise<string> {
  const [iv, ct] = sealed.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(iv, 'base64') }, await key(), Buffer.from(ct, 'base64'));
  return new TextDecoder().decode(pt);
}

// ── OAuth token exchange / refresh ────────────────────────────────────────

interface TokenResponse { access_token: string; refresh_token?: string; expires_in: number; scope?: string; id_token?: string; error?: string; error_description?: string }

async function tokenRequest(p: CalProvider, body: Record<string, string>): Promise<TokenResponse> {
  const url = p === 'google' ? 'https://oauth2.googleapis.com/token' : `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`;
  const creds: Record<string, string> = p === 'google'
    ? { client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }
    : { client_id: process.env.MS_CLIENT_ID!, client_secret: process.env.MS_CLIENT_SECRET!, scope: CAL_SCOPES.microsoft.join(' ') };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...creds, ...body }) });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) throw new Error(`${p} token: ${json.error ?? res.status} ${json.error_description ?? ''}`.trim());
  return json;
}

/** Email from the OpenID id_token (no signature check needed: it came straight from the token endpoint over TLS). */
function emailFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
    return payload.email ?? payload.preferred_username ?? payload.upn;
  } catch { return undefined; }
}

export interface Account { id: string; provider: CalProvider; email: string | null; access_token: string; refresh_token: string | null; expires_at: string | Date; status: string }

export async function exchangeCode(p: CalProvider, code: string): Promise<Account> {
  const t = await tokenRequest(p, { grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  const email = emailFromIdToken(t.id_token) ?? 'unknown';
  const id = `${p}:${email}`;
  const expires = new Date(Date.now() + (t.expires_in - 60) * 1000);
  const access = await seal(t.access_token);
  const refresh = t.refresh_token ? await seal(t.refresh_token) : null;
  await sql().query(
    `insert into calendar_accounts (id, provider, email, access_token, refresh_token, expires_at, scope, status, last_error, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'ok', null, now())
     on conflict (id) do update set access_token = excluded.access_token,
       refresh_token = coalesce(excluded.refresh_token, calendar_accounts.refresh_token),
       expires_at = excluded.expires_at, scope = excluded.scope, status = 'ok', last_error = null, updated_at = now()`,
    [id, p, email, access, refresh, expires.toISOString(), t.scope ?? null],
  );
  return { id, provider: p, email, access_token: access, refresh_token: refresh, expires_at: expires, status: 'ok' };
}

/** Normalises a pasted calendar link (webcal:// → https://); only http(s) links are accepted. */
export function icsUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'));
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch { return null; }
}

async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, { headers: { accept: 'text/calendar' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`ics ${res.status}`);
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('ics: not an iCalendar file');
  return text;
}

/** Adds (or updates) an ICS account after checking the link really serves a calendar. The link is stored sealed. */
export async function addIcsAccount(url: string, label: string): Promise<Account> {
  const text = await fetchIcs(url);
  fromIcs(text, new Date(), new Date(Date.now() + 86_400_000)); // throws on a file it cannot read
  const id = `ics:${createHash('sha1').update(url).digest('hex').slice(0, 12)}`;
  const name = label.trim() || text.match(/^X-WR-CALNAME:(.*)$/m)?.[1]?.trim() || 'Calendar';
  const sealed = await seal(url);
  const expires = '9999-12-31T00:00:00Z';
  await sql().query(
    `insert into calendar_accounts (id, provider, email, access_token, refresh_token, expires_at, scope, status, last_error, updated_at)
     values ($1, 'ics', $2, $3, null, $4, null, 'ok', null, now())
     on conflict (id) do update set email = excluded.email, access_token = excluded.access_token, status = 'ok', last_error = null, updated_at = now()`,
    [id, name, sealed, expires],
  );
  return { id, provider: 'ics', email: name, access_token: sealed, refresh_token: null, expires_at: expires, status: 'ok' };
}

export async function accounts(): Promise<Account[]> {
  return (await sql().query(`select * from calendar_accounts order by created_at`)) as Account[];
}

/** A valid access token, refreshing (and storing) it when it is about to expire. */
export async function accessToken(a: Account): Promise<string> {
  if (new Date(a.expires_at).getTime() > Date.now() + 30_000) return unseal(a.access_token);
  if (!a.refresh_token) throw Object.assign(new Error('reauth'), { reauth: true });
  try {
    const t = await tokenRequest(a.provider, { grant_type: 'refresh_token', refresh_token: await unseal(a.refresh_token) });
    const expires = new Date(Date.now() + (t.expires_in - 60) * 1000);
    await sql().query(
      `update calendar_accounts set access_token = $2, refresh_token = coalesce($3, refresh_token), expires_at = $4, status = 'ok', last_error = null, updated_at = now() where id = $1`,
      [a.id, await seal(t.access_token), t.refresh_token ? await seal(t.refresh_token) : null, expires.toISOString()],
    );
    return t.access_token;
  } catch (e) {
    if (/invalid_grant/.test(String(e))) throw Object.assign(new Error('reauth'), { reauth: true });
    throw e;
  }
}

export async function setAccountStatus(id: string, status: 'ok' | 'error' | 'reauth', error: string | null) {
  await sql().query(`update calendar_accounts set status = $2, last_error = $3, updated_at = now(), last_sync_at = case when $2 = 'ok' then now() else last_sync_at end where id = $1`, [id, status, error]);
}

export async function removeAccount(id: string) {
  await sql().query(`delete from calendar_accounts where id = $1`, [id]);
  // Tombstone its calendars and events so devices drop them.
  await sql().query(
    `update sync_records set deleted = true, updated_at = now(), seq = nextval('sync_seq')
     where entity in ('calendar', 'cal_event') and (data->>'accountId' = $1 or data->>'calendarKey' like $2)`,
    [id, `${id}:%`],
  );
}

// ── Provider reads ────────────────────────────────────────────────────────

async function api<T>(url: string, token: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}`, ...headers } });
  if (res.status === 401) throw Object.assign(new Error('reauth'), { reauth: true });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export interface RemoteCalendar { calendarId: string; name: string; color?: string; primary?: boolean; canWrite: boolean }

export async function listCalendars(a: Account, token: string): Promise<RemoteCalendar[]> {
  if (a.provider === 'ics') return [{ calendarId: 'ics', name: a.email ?? 'Calendar', primary: true, canWrite: false }];
  if (a.provider === 'google') {
    const out: RemoteCalendar[] = [];
    let page: string | undefined;
    do {
      const r = await api<{ items: { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; accessRole: string }[]; nextPageToken?: string }>(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250${page ? `&pageToken=${page}` : ''}`, token);
      out.push(...r.items.map(c => ({ calendarId: c.id, name: c.summaryOverride ?? c.summary, color: c.backgroundColor, primary: !!c.primary, canWrite: c.accessRole === 'owner' || c.accessRole === 'writer' })));
      page = r.nextPageToken;
    } while (page);
    return out;
  }
  const r = await api<{ value: { id: string; name: string; hexColor?: string; isDefaultCalendar?: boolean; canEdit?: boolean }[] }>('https://graph.microsoft.com/v1.0/me/calendars?$top=100', token);
  return r.value.map(c => ({ calendarId: c.id, name: c.name, color: c.hexColor || undefined, primary: !!c.isDefaultCalendar, canWrite: !!c.canEdit }));
}

export async function listEvents(a: Account, token: string, calendarId: string, from: Date, to: Date): Promise<RawEvent[]> {
  if (a.provider === 'ics') return fromIcs(await fetchIcs(token), from, to);
  const out: RawEvent[] = [];
  if (a.provider === 'google') {
    let page: string | undefined;
    do {
      const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', showDeleted: 'false' });
      if (page) q.set('pageToken', page);
      const r = await api<{ items: GoogleEvent[]; nextPageToken?: string }>(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`, token);
      for (const e of r.items) { const x = fromGoogle(e); if (x) out.push(x); }
      page = r.nextPageToken;
    } while (page);
    return out;
  }
  let url: string | undefined = `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}&$top=500&$select=id,subject,isCancelled,isAllDay,showAs,start,end,location,responseStatus,categories`;
  while (url) {
    const r: { value: GraphEvent[]; '@odata.nextLink'?: string } = await api(url, token, { Prefer: 'outlook.timezone="UTC"' });
    for (const e of r.value) { const x = fromGraph(e); if (x) out.push(x); }
    url = r['@odata.nextLink'];
  }
  return out;
}

// ── Writing to sync_records ───────────────────────────────────────────────

export const calendarKey = (accountId: string, calendarId: string) => `${accountId}:${calendarId}`;

/** New calendars get a default classification; existing ones keep the user's. */
export async function upsertCalendars(a: Account, cals: RemoteCalendar[]) {
  if (!cals.length) return;
  const rows = cals.map(c => ({
    id: calendarKey(a.id, c.calendarId),
    data: { provider: a.provider, accountId: a.id, calendarId: c.calendarId, name: c.name, color: c.color, primary: c.primary, canWrite: c.canWrite, classification: defaultClass(c.name, !!c.primary, a.provider) as CalClass },
  }));
  await sql().query(
    `insert into sync_records (entity, id, data, deleted, updated_at, device_id)
     select 'calendar', x.id, x.data, false, now(), 'server'
     from jsonb_to_recordset($1::jsonb) as x(id text, data jsonb)
     on conflict (entity, id) do update
       set data = excluded.data || jsonb_build_object('classification', coalesce(sync_records.data->'classification', excluded.data->'classification')),
           deleted = false, updated_at = now(), seq = nextval('sync_seq')
       where sync_records.data - 'classification' is distinct from excluded.data - 'classification' or sync_records.deleted`,
    [JSON.stringify(rows)],
  );
}

export async function enabledCalendarIds(accountId: string): Promise<{ calendarId: string; classification: CalClass }[]> {
  const rows = (await sql().query(
    `select data->>'calendarId' as "calendarId", data->>'classification' as classification from sync_records where entity = 'calendar' and not deleted and data->>'accountId' = $1`,
    [accountId],
  )) as { calendarId: string; classification: CalClass }[];
  return rows.filter(r => r.classification !== 'hidden');
}

/**
 * Replaces one calendar's events in [fromDay, toDay]: upserts what came back (only rows that
 * changed get a new seq), tombstones what disappeared (cancelled / deleted upstream).
 */
export async function writeEvents(accountId: string, provider: CalProvider, calendarId: string, events: RawEvent[], tz: string, cutoff: number, fromDay: string, toDay: string) {
  const key = calendarKey(accountId, calendarId);
  const rows = events.filter(e => !e.declined).flatMap(e => toRows(e, key, provider, tz, cutoff))
    .filter(r => r.dayId >= fromDay && r.dayId <= toDay)
    .map(r => ({ id: r.id, data: (({ id: _id, ...rest }) => rest)(r) }));
  const db = sql();
  if (rows.length) {
    await db.query(
      `insert into sync_records (entity, id, data, deleted, updated_at, device_id)
       select 'cal_event', x.id, x.data, false, now(), 'server' from jsonb_to_recordset($1::jsonb) as x(id text, data jsonb)
       on conflict (entity, id) do update set data = excluded.data, deleted = false, updated_at = now(), seq = nextval('sync_seq')
       where sync_records.data is distinct from excluded.data or sync_records.deleted`,
      [JSON.stringify(rows)],
    );
  }
  const gone = (await db.query(
    `update sync_records set deleted = true, updated_at = now(), seq = nextval('sync_seq')
     where entity = 'cal_event' and not deleted and data->>'calendarKey' = $1 and data->>'dayId' between $2 and $3 and not (id = any($4::text[]))
     returning id`,
    [key, fromDay, toDay, rows.map(r => r.id)],
  )) as { id: string }[];
  return { upserted: rows.length, removed: gone.length };
}

// ── Events → blocks (note: calendar events work as blocks, not to-dos) ───────

const DEFAULT_AREA: Record<CalProvider, string> = { microsoft: 'area-work', ics: 'area-work', google: 'area-personal' };
/** Outlook holds nobody should book over (“Blocker” category): not commitments, ignored. */
export const isBlocker = (e: RawEvent) => (e.categories ?? []).some(c => c.trim().toLowerCase() === 'blocker');

/**
 * Writes one calendar's events in [fromDay, toDay] as day blocks (fixed, the event's time).
 * The area comes from the account (Settings) unless you changed it on that block: then yours stays.
 * A block you deleted stays deleted (that event is ignored). Events that disappeared are removed.
 */
export async function writeBlocks(a: Account, calendarId: string, events: RawEvent[], tz: string, cutoff: number, fromDay: string, toDay: string, area: string) {
  const key = calendarKey(a.id, calendarId);
  const rows = events
    .filter(e => !e.declined && e.status !== 'cancelled' && !e.allDay && !isBlocker(e))
    .flatMap(e => toRows(e, key, a.provider, tz, cutoff).map(r => ({ r, e })))
    .filter(({ r }) => r.dayId >= fromDay && r.dayId <= toDay)
    .map(({ r, e }) => ({
      id: `cal-${createHash('sha1').update(r.id).digest('hex').slice(0, 24)}`,
      data: {
        dayId: r.dayId, start: r.start, end: r.end, title: r.title, areaId: area, fixed: true,
        calendar: {
          accountId: a.id, provider: a.provider, eventId: e.eventId, calendarKey: key, ...(a.email ? { email: a.email } : {}),
          ...(e.location ? { location: e.location } : {}), ...(e.free ? { free: true } : {}), ...(e.status === 'tentative' ? { tentative: true } : {}), calArea: area,
        },
      },
    }));
  const db = sql();
  if (rows.length) {
    await db.query(
      `insert into sync_records (entity, id, data, deleted, updated_at, device_id)
       select 'day_block', x.id, x.data, false, now(), 'server' from jsonb_to_recordset($1::jsonb) as x(id text, data jsonb)
       on conflict (entity, id) do update
         set data = excluded.data || case when sync_records.data->>'areaId' is distinct from sync_records.data->'calendar'->>'calArea'
                                          then jsonb_build_object('areaId', sync_records.data->'areaId') else '{}'::jsonb end,
             deleted = false, updated_at = now(), seq = nextval('sync_seq'), device_id = 'server'
         where (not sync_records.deleted or sync_records.device_id = 'server')
           and ((sync_records.data - 'areaId') is distinct from (excluded.data - 'areaId') or sync_records.deleted)`,
      [JSON.stringify(rows)],
    );
  }
  const gone = (await db.query(
    `update sync_records set deleted = true, updated_at = now(), seq = nextval('sync_seq'), device_id = 'server'
     where entity = 'day_block' and not deleted and data->'calendar'->>'calendarKey' = $1 and data->>'dayId' between $2 and $3 and not (id = any($4::text[]))
     returning id`,
    [key, fromDay, toDay, rows.map(r => r.id)],
  )) as { id: string }[];
  return { upserted: rows.length, removed: gone.length };
}

export interface SyncResult { account: string; provider: CalProvider; email?: string | null; events?: number; removed?: number; ms: number; error?: string }

async function prefs(): Promise<{ timeZone?: string; dayCutoffHour?: number; calendarAreas?: Record<string, string> }> {
  const r = (await sql().query(`select data from sync_records where entity = 'pref' and id = 'prefs' and not deleted`)) as { data: Record<string, unknown> }[];
  return (r[0]?.data ?? {}) as { timeZone?: string; dayCutoffHour?: number; calendarAreas?: Record<string, string> };
}

/** Every connected account → blocks for [from, to] (logical days). */
export async function syncAll(opts: { tz: string; cutoff: number; from: string; to: string; refreshCalendars?: boolean }): Promise<SyncResult[]> {
  const { tz, cutoff, from, to } = opts;
  const start = new Date(`${from}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
  const areas = (await prefs()).calendarAreas ?? {};
  const results: SyncResult[] = [];
  for (const a of await accounts()) {
    const t0 = Date.now();
    try {
      const token = await accessToken(a);
      if (opts.refreshCalendars || !(await enabledCalendarIds(a.id)).length) await upsertCalendars(a, await listCalendars(a, token));
      const area = areas[a.id] ?? DEFAULT_AREA[a.provider];
      let events = 0, removed = 0;
      for (const c of (await enabledCalendarIds(a.id)).filter(c => c.classification === 'commitment')) {
        const w = await writeBlocks(a, c.calendarId, await listEvents(a, token, c.calendarId, start, end), tz, cutoff, from, to, area);
        events += w.upserted; removed += w.removed;
      }
      await setAccountStatus(a.id, 'ok', null);
      await sql().query(`update calendar_accounts set last_sync_at = now() where id = $1`, [a.id]);
      results.push({ account: a.id, provider: a.provider, email: a.email, events, removed, ms: Date.now() - t0 });
    } catch (e) {
      const reauth = !!(e as { reauth?: boolean }).reauth;
      const message = String((e as Error).message).slice(0, 300);
      await setAccountStatus(a.id, reauth ? 'reauth' : 'error', message).catch(() => {});
      results.push({ account: a.id, provider: a.provider, email: a.email, error: reauth ? 'reauth' : message, ms: Date.now() - t0 });
    }
  }
  return results;
}

let autoRunning = false;
/**
 * Keeps calendars fresh without anyone opening the web app: called after /api/sync and
 * /api/snapshot (phone, widget, watch poll those), it re-syncs when the last run is >10 min old.
 */
export async function maybeSyncCalendars(maxAgeMin = 10) {
  if (autoRunning) return;
  autoRunning = true;
  try {
    const stale = (await sql().query(
      `select count(*)::int as n from calendar_accounts where status <> 'reauth' and (last_sync_at is null or last_sync_at < now() - make_interval(mins => $1))`,
      [maxAgeMin],
    )) as { n: number }[];
    if (!stale[0]?.n) return;
    const p = await prefs();
    const tz = p.timeZone || 'America/Sao_Paulo';
    const cutoff = p.dayCutoffHour ?? 4;
    const { day } = logicalAt(new Date(), tz, cutoff);
    const shift = (d: string, n: number) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
    await syncAll({ tz, cutoff, from: shift(day, -1), to: shift(day, 14) });
  } catch { /* no table yet, or the provider is down: try again on the next call */ } finally { autoRunning = false; }
}
