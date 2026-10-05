import { useEffect, useState, useSyncExternalStore } from 'react';
import { logicalDay, minutesInLogicalDay } from '@shared/time';
import { getStatus, getVersion, subscribe } from './store';

/** Re-renders on every store change. */
export function useStore() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return getStatus();
}

export function useClock(ms = 20_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return { now, day: logicalDay(now), minute: minutesInLogicalDay(now) };
}
