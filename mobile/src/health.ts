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

/** Asks for read access to sleep (Health Connect's own screen). */
export async function connectHealth(): Promise<boolean> {
  try {
    if (!(await initialize())) return false;
    const granted = await requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);
    return granted.some(p => 'recordType' in p && p.recordType === 'SleepSession');
  } catch { return false; }
}

/** Reads recent sleep sessions and imports them. `minGapMin` throttles automatic runs. */
export async function syncSleep(opts: { minGapMin?: number; days?: number } = {}): Promise<number> {
  const { minGapMin = 0, days = 14 } = opts;
  try {
    const last = Number((await AsyncStorage.getItem(LAST)) ?? 0);
    if (minGapMin && Date.now() - last < minGapMin * 60_000) return 0;
    const cred = await getCredential();
    if (!cred || !(await initialize())) return 0;
    const granted = await getGrantedPermissions();
    if (!granted.some(p => 'recordType' in p && p.recordType === 'SleepSession' && p.accessType === 'read')) return 0;
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
    if (!sessions.length) return 0;
    const res = await api(cred, '/api/sleep/import', { method: 'POST', body: JSON.stringify({ tz: tz(), sessions }) });
    return res.ok ? sessions.length : 0;
  } catch { return 0; }
}
