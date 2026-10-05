import type { Snapshot } from '@shared/snapshot';
import { api, getCredential } from './auth';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

/** The present moment from the server (widgets, the lock-screen notification, background refresh). */
export async function remoteSnapshot(): Promise<Snapshot | null> {
  const cred = await getCredential();
  if (!cred) return null;
  try {
    const res = await api(cred, `/api/snapshot?tz=${encodeURIComponent(tz())}`);
    return res.ok ? ((await res.json()) as Snapshot) : null;
  } catch { return null; }
}
