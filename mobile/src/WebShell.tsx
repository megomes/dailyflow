import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Credential } from './auth';
import { refreshSurfaces } from './background';
import { applyOta } from './ota';
import { C } from './theme';

/**
 * The app *is* the web app: same code, so the phone always has every feature the web has
 * (Tasks board, planning, focus, notes…), with the web's phone layout. The native side only adds
 * what the web cannot do: widgets, the lock-screen notification, OTA, Android back and widget links.
 */
export function WebShell({ cred, path, onUnauthorized }: { cred: Credential; path: string; onUnauthorized: () => void }) {
  const web = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [source] = useState(() => ({ uri: `${cred.host}/api/devices/web?next=${encodeURIComponent(path)}`, headers: { Authorization: `Bearer ${cred.token}` } }));
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const opened = useRef(path);

  // Widget links (dailyflow:///tasks) navigate inside the web app.
  useEffect(() => {
    if (path === opened.current) return;
    opened.current = path;
    web.current?.injectJavaScript(`location.assign(${JSON.stringify(path)}); true;`);
  }, [path]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current) return false;
      web.current?.goBack();
      return true;
    });
    const app = AppState.addEventListener('change', st => {
      if (st === 'active') { void applyOta(); web.current?.injectJavaScript('window.dispatchEvent(new Event("online")); true;'); }
      else void refreshSurfaces().catch(() => {});
    });
    return () => { back.remove(); app.remove(); };
  }, []);

  function onMessage(e: WebViewMessageEvent) {
    let msg: { type?: string; kind?: string };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'changed') {
      // Something changed and was synced: redraw widgets and the lock-screen notification (debounced).
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void refreshSurfaces().catch(() => {}), 800);
    } else if (msg.type === 'haptic') {
      void (msg.kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    }
  }

  if (failed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '600' }}>Could not reach DailyFlow</Text>
        <Pressable onPress={() => { setFailed(false); setNonce(n => n + 1); }} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: C.elevated }}>
          <Text style={{ color: C.text }}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bg }}>
      <WebView
        key={nonce}
        ref={web}
        source={source}
        style={{ flex: 1, backgroundColor: C.bg }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        applicationNameForUserAgent="DailyFlowAndroid/1"
        overScrollMode="never"
        pullToRefreshEnabled={false}
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.text2} /></View>}
        onMessage={onMessage}
        onNavigationStateChange={st => { canGoBack.current = st.canGoBack; }}
        onShouldStartLoadWithRequest={req => {
          if (!req.url.startsWith(cred.host)) { void Linking.openURL(req.url); return false; }
          // The cookie expired: sign in again with the device token (a revoked token ends in onHttpError → pair).
          if (new URL(req.url).pathname === '/login') { setNonce(n => n + 1); return false; }
          return true;
        }}
        onError={() => setFailed(true)}
        onHttpError={e => { if (e.nativeEvent.statusCode === 401 && e.nativeEvent.url.includes('/api/devices/web')) onUnauthorized(); }}
        onRenderProcessGone={() => web.current?.reload()}
      />
    </SafeAreaView>
  );
}
