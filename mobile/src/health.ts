import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGrantedPermissions, initialize, readRecords, requestPermission } from 'react-native-health-connect';
import { api, getCredential } from './auth';

/**
 * Sleep from Samsung Health (note #29). Samsung Health writes sleep sessions (with stages) to
 * Health Connect; the app reads the last two weeks and sends them to /api/sleep/import, which
 * turns them into nights every device gets through the normal sync. Nights without the watch are
 * entered by hand in the web app.
 */

const LAST = 'df.health.lastSleepSync';
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

export interface HealthResult {
  /** Where it stopped: needs Health Connect / permission denied / read failed / nothing in the window / imported. */
  status: 'unavailable' | 'denied' | 'error' | 'empty' | 'ok';
  sessions: number;
  nights: number;
  days: number;
  message?: string;
}

/** Asks for read access to sleep (Health Connect's own screen). */
export async function connectHealth(): Promise<HealthResult['status'] | 'granted'> {
  try {
    if (!(await initialize())) return 'unavailable';
    const granted = await requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);
    return granted.some(p => 'recordType' in p && p.recordType === 'SleepSession') ? 'granted' : 'denied';
  } catch { return 'error'; }
}

/** Reads recent sleep sessions and imports them, saying exactly what happened. */
export async function syncSleepDetailed(days = 14): Promise<HealthResult> {
  const out: HealthResult = { status: 'error', sessions: 0, nights: 0, days };
  try {
    const cred = await getCredential();
    if (!cred) return { ...out, message: 'Not signed in' };
    if (!(await initialize())) return { ...out, status: 'unavailable' };
    const granted = await getGrantedPermissions();
    if (!granted.some(p => 'recordType' in p && p.recordType === 'SleepSession' && p.accessType === 'read')) return { ...out, status: 'denied' };
    const { records } = await readRecords('SleepSession', {
      timeRangeFilter: { operator: 'between', startTime: new Date(Date.now() - days * 86_400_000).toISOString(), endTime: new Date().toISOString() },
    });
    await AsyncStorage.setItem(LAST, String(Date.now()));
    const sessions = records.map(r => ({
      id: r.metadata?.id ?? `${r.startTime}`,
      start: new Date(r.startTime).toISOString(),
      end: new Date(r.endTime).toISOString(),
      stages: r.stages?.map(s => ({ stage: s.stage, start: new Date(s.startTime).toISOString(), end: new Date(s.endTime).toISOString() })),
    }));
    if (!sessions.length) return { ...out, status: 'empty' };
    const res = await api(cred, '/api/sleep/import', { method: 'POST', body: JSON.stringify({ tz: tz(), sessions }) });
    if (!res.ok) return { ...out, sessions: sessions.length, message: `Server ${res.status}` };
    const body = await res.json().catch(() => ({} as { imported?: number }));
    return { status: 'ok', sessions: sessions.length, nights: typeof body.imported === 'number' ? body.imported : sessions.length, days };
  } catch (e) { return { ...out, message: e instanceof Error ? e.message : String(e) }; }
}

/** Automatic runs (background / app open): throttled, returns how many sessions were sent. */
export async function syncSleep(opts: { minGapMin?: number; days?: number } = {}): Promise<number> {
  const { minGapMin = 0, days = 14 } = opts;
  const last = Number((await AsyncStorage.getItem(LAST).catch(() => null)) ?? 0);
  if (minGapMin && Date.now() - last < minGapMin * 60_000) return 0;
  const r = await syncSleepDetailed(days);
  return r.status === 'ok' ? r.sessions : 0;
}
