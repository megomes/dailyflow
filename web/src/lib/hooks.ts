'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { minutesInLogicalDay, logicalDay } from './time';
import { getSyncState, subscribeSync, type SyncState } from './sync';

/** Current logical day and minute, refreshed every 20 s and when the tab becomes visible. */
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, 20_000);
    const vis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return { now, day: logicalDay(now), minute: minutesInLogicalDay(now) };
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}

/** True below the mobile breakpoint (matches the CSS). */
export function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 820px)');
    const on = () => setM(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return m;
}
