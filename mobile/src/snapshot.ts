import { buildSnapshot, type Snapshot } from '@shared/snapshot';
import type { DayBlock, FocusSession, Task, TimeRecord } from '@shared/types';
import { api, getCredential } from './auth';
import { areas } from './ops';
import { rows } from './store';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

/** From the local store (inside the app, instant and offline). */
export function localSnapshot(cutoff: number): Snapshot {
  return buildSnapshot({
    blocks: rows<DayBlock>('day_block'), records: rows<TimeRecord>('time_record'), tasks: rows<Task>('task'),
    sessions: rows<FocusSession>('focus_session'), areas: areas(),
  }, new Date(), tz(), cutoff);
}

/** From the server (widgets and background, where the JS store may be cold). */
export async function remoteSnapshot(): Promise<Snapshot | null> {
  const cred = await getCredential();
  if (!cred) return null;
  try {
    const res = await api(cred, `/api/snapshot?tz=${encodeURIComponent(tz())}`);
    return res.ok ? ((await res.json()) as Snapshot) : null;
  } catch { return null; }
}
