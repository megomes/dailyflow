import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { clearCredential, getCredential, parsePairUrl, type Credential } from './auth';
import { refreshSurfaces } from './background';
import { setupNotifications } from './notify';
import { applyOta } from './ota';
import { Pair } from './Pair';
import { C } from './theme';
import { WebShell } from './WebShell';

/** dailyflow:///tasks → /tasks (widget links); dailyflow://pair?… is handled by pairing. */
function pathOf(url: string | null): string | null {
  if (!url || !url.startsWith('dailyflow:')) return null;
  if (parsePairUrl(url)) return null;
  const p = url.replace(/^dailyflow:\/*/, '/');
  return p === '/' ? '/' : p.replace(/\/$/, '');
}

export default function App() {
  const [cred, setCred] = useState<Credential | null | undefined>(undefined);
  const [path, setPath] = useState('/');
  const [pairLink, setPairLink] = useState<{ host: string; code: string } | null>(null);

  useEffect(() => {
    void applyOta();
    void (async () => {
      const initial = await Linking.getInitialURL();
      const p = pathOf(initial);
      if (p) setPath(p);
      const link = initial ? parsePairUrl(initial) : null;
      if (link) setPairLink(link);
      const c = await getCredential();
      setCred(link ? null : c);
      if (c) { await setupNotifications().catch(() => {}); void refreshSurfaces().catch(() => {}); }
    })();
    const sub = Linking.addEventListener('url', ({ url }) => {
      const link = parsePairUrl(url);
      if (link) { setPairLink(link); setCred(null); return; }
      const p = pathOf(url);
      if (p) setPath(p);
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {cred === undefined ? null : cred ? (
          <WebShell cred={cred} path={path} onUnauthorized={() => { void clearCredential(); setCred(null); }} />
        ) : (
          <Pair link={pairLink} onPaired={c => { setPairLink(null); setCred(c); void setupNotifications().catch(() => {}); void refreshSurfaces().catch(() => {}); }} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
