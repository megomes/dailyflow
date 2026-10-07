'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { track } from './analytics';
import { inAndroidApp, postNative } from './native';

export interface HealthResult { status: 'unavailable' | 'denied' | 'error' | 'empty' | 'ok'; sessions: number; nights: number; days: number; message?: string }

const noop = () => () => {};

/**
 * Samsung Health through Health Connect (note #29): the Android app asks for permission, reads the
 * last two weeks and imports them; the result comes back as a `df-health` event. Only inside the app
 * (`app` is false while prerendering, so no hydration mismatch).
 */
export function useHealthImport(surface: string) {
  const app = useSyncExternalStore(noop, inAndroidApp, () => false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HealthResult | null>(null);
  useEffect(() => {
    const on = (e: Event) => { setResult((e as CustomEvent<HealthResult>).detail); setBusy(false); };
    window.addEventListener('df-health', on);
    return () => window.removeEventListener('df-health', on);
  }, []);
  function run() {
    setBusy(true); setResult(null);
    postNative({ type: 'health-connect' });
    track('sleep_health_connect', { surface });
    setTimeout(() => setBusy(false), 30000);
  }
  return { app, busy, result, run };
}
