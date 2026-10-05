import { getDB } from './db';
import { save } from './repo';
import { setCutoffHour } from './time';
import type { Prefs } from './types';

export async function savePrefs(patch: Partial<Prefs>) {
  const cur = (await getDB().prefs.get('prefs')) ?? { id: 'prefs', updatedAt: '' };
  await save('pref', { ...cur, ...patch });
}

/** Applies synced preferences that live outside React (day cutoff). */
export async function applyPrefs() {
  const p = await getDB().prefs.get('prefs');
  if (p?.dayCutoffHour != null) setCutoffHour(p.dayCutoffHour);
  return p;
}
