import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getCredential } from '../src/auth';
import { refreshSurfaces } from '../src/background';
import { setupNotifications } from '../src/notify';
import { applyOta } from '../src/ota';
import { applyPrefs, ensureDay, today } from '../src/ops';
import { localSnapshot } from '../src/snapshot';
import { load, subscribe, syncNow } from '../src/store';
import { cutoffHour } from '@shared/time';
import { C } from '../src/theme';

/** Boot: local store → pairing check → sync → keep widgets and the lock-screen notification fresh. */
export default function Root() {
  const [ready, setReady] = useState(false);
  const [paired, setPaired] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    (async () => {
      void applyOta();
      await load();
      const cred = await getCredential();
      setPaired(!!cred);
      setReady(true);
      if (cred) {
        await setupNotifications().catch(() => {});
        await syncNow('boot');
        applyPrefs();
        ensureDay(today());
      }
    })();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') { void applyOta(); void syncNow('foreground').then(() => ensureDay(today())); } });
    const iv = setInterval(() => void syncNow('interval'), 60_000);
    // Any local change redraws the surfaces from the local store (debounced).
    const unsub = subscribe(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void refreshSurfaces(localSnapshot(cutoffHour())).catch(() => {}), 1500);
    });
    return () => { sub.remove(); clearInterval(iv); unsub(); };
  }, []);

  useEffect(() => {
    if (!ready || paired == null) return;
    const onPair = segments[0] === 'pair';
    if (!paired && !onPair) router.replace('/pair');
  }, [ready, paired, segments, router]);

  if (!ready) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pair" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
