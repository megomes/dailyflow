'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { endSession, installErrorLogging, track } from '@/lib/analytics';
import { SYNC_INTERVAL_MS } from '@/lib/config';
import { seedIfEmpty } from '@/lib/repo';
import { pushEvents, startSyncLoop, syncNow } from '@/lib/sync';

let booted = false;

/**
 * Boot sequence: seed local data, pull from the server (bounded wait so offline still opens fast),
 * then render. Also installs analytics, the sync loop and the service worker.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(booted);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    const t0 = performance.now();
    (async () => {
      if (!booted) {
        installErrorLogging();
        await seedIfEmpty();
        await Promise.race([syncNow('boot'), new Promise(r => setTimeout(r, 2500))]);
        booted = true;
        track('app_opened', {
          cold_start_ms: Math.round(t0),
          boot_ms: Math.round(performance.now() - t0),
          installed: window.matchMedia('(display-mode: standalone)').matches,
          online: navigator.onLine,
        });
      }
      setReady(true);
      stopSync = startSyncLoop(SYNC_INTERVAL_MS);
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
    return () => { stopSync?.(); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  if (!ready) return <div className="boot" aria-busy="true" />;
  return <>{children}</>;
}
