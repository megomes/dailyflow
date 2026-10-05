import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_HOST, pair, parsePairUrl } from '../src/auth';
import { syncNow } from '../src/store';
import { Btn, Card, Label, s } from '../src/ui';
import { C } from '../src/theme';

/** Pair once (spec §78): scan the QR from Settings › Device on the web, or type the code. */
export default function Pair() {
  const params = useLocalSearchParams<{ code?: string; host?: string }>();
  const router = useRouter();
  const [perm, requestPerm] = useCameraPermissions();
  const [scan, setScan] = useState(false);
  const [host, setHost] = useState(params.host ?? DEFAULT_HOST);
  const [code, setCode] = useState(params.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(h = host, c = code) {
    setBusy(true); setError(null);
    try {
      await pair(h, c);
      await syncNow('paired');
      router.replace('/');
    } catch (e) { setError(String((e as Error).message)); }
    setBusy(false);
  }

  // Opened from a dailyflow://pair link: pair right away.
  useEffect(() => { if (params.code) void go(params.host ?? DEFAULT_HOST, params.code); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.h1}>Pair this phone</Text>
        <Text style={s.sub}>On the computer: DailyFlow › Settings › Device › Pair a device.</Text>
        {scan && perm?.granted ? (
          <View style={{ height: 320, borderRadius: 12, overflow: 'hidden' }}>
            <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => { const p = parsePairUrl(data); if (p && !busy) { setScan(false); setHost(p.host); setCode(p.code); void go(p.host, p.code); } }} />
          </View>
        ) : (
          <Btn title="Scan QR code" kind="primary" onPress={async () => { if (!perm?.granted) await requestPerm(); setScan(true); }} />
        )}
        <Card>
          <Label>Or type the code</Label>
          <TextInput style={[s.input, { letterSpacing: 4, fontSize: 20 }]} autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} placeholder="K7M2 QX9P" placeholderTextColor={C.disabled} />
          <Label>Server</Label>
          <TextInput style={s.input} autoCapitalize="none" autoCorrect={false} value={host} onChangeText={setHost} keyboardType="url" />
          <Btn title={busy ? 'Pairing…' : 'Pair'} onPress={() => void go()} disabled={busy || code.replace(/\W/g, '').length < 8} />
        </Card>
        {error && <Text style={{ color: C.danger }}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
