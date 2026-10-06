'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { endSession, installErrorLogging, track } from '@/lib/analytics';
import { collectContext } from '@/lib/clientContext';
import { SYNC_INTERVAL_MS } from '@/lib/config';
import { startCalendarLoop } from '@/lib/calendar/client';
import { applyPrefs } from '@/lib/prefs';
import { migrateToDayTemplates, seedIfEmpty } from '@/lib/repo';
import { startLive } from '@/lib/live';
import { getSyncState, pushEvents, startSyncLoop, syncNow } from '@/lib/sync';

let booted = false;

/**
 * Boot sequence: seed local data, pull from the server (bounded wait so offline still opens fast),
 * then render. Also installs analytics, the sync loop and the service worker.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(booted);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    let stopCal: (() => void) | undefined;
    let stopLive: (() => void) | undefined;
    const t0 = performance.now();
    (async () => {
      if (!booted) {
        installErrorLogging();
        await seedIfEmpty();
        await Promise.race([syncNow('boot'), new Promise(r => setTimeout(r, 2500))]);
        const migrated = await migrateToDayTemplates(!!getSyncState().lastSyncedAt).catch(() => 0);
        if (migrated) { track('templates_migrated', { to: 'per_weekday', blocks: migrated }); void syncNow('migration'); }
        await applyPrefs().catch(() => null);
        booted = true;
        const ctx = await collectContext();
        track('app_opened', {
          cold_start_ms: Math.round(t0),
          boot_ms: Math.round(performance.now() - t0),
          installed: ctx.device.surface === 'pwa',
          online: navigator.onLine,
          version: ctx.app.version,
          os: ctx.device.os,
          browser: ctx.device.browser,
          layout: ctx.device.layout,
          viewport: ctx.screen.viewport,
          dpr: ctx.screen.dpr,
          network: ctx.network.type,
          theme: ctx.screen.theme,
        });
      }
      setReady(true);
      stopSync = startSyncLoop(SYNC_INTERVAL_MS);
      stopCal = startCalendarLoop();
      // Another device changed something: sync now instead of on the next tick.
      stopLive = startLive(reason => void syncNow(`live:${reason}`));
    })();

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        endSession('hidden');
        pushEvents(true).catch(() => {});
      } else {
        void syncNow('visible');
      }
    };
    document.addEventListener('visibilitychange', onHide);

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
    }
    return () => { stopSync?.(); stopCal?.(); stopLive?.(); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  if (!ready) return <div className="boot" aria-busy="true" />;
  return <>{children}</>;
}
