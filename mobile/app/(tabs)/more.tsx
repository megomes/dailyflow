import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { clearCredential, getCredential } from '../../src/auth';
import { refreshSurfaces } from '../../src/background';
import { useStore } from '../../src/hooks';
import { nowNotificationEnabled, setNowNotificationEnabled } from '../../src/notify';
import { resetStore, syncNow } from '../../src/store';
import { C } from '../../src/theme';
import { Btn, Card, Label, Row, s } from '../../src/ui';

export default function More() {
  const status = useStore();
  const router = useRouter();
  const [host, setHost] = useState('');
  const [notify, setNotify] = useState(true);
  useEffect(() => { void getCredential().then(c => setHost(c?.host ?? '')); void nowNotificationEnabled().then(setNotify); }, []);
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.h1}>More</Text>
        <Card>
          <Label>Sync</Label>
          <Text style={s.text2}>{status.state}{status.at ? ` · ${new Date(status.at).toLocaleTimeString()}` : ''}{status.pending ? ` · ${status.pending} waiting` : ''}</Text>
          {status.error && <Text style={{ color: C.danger }}>{status.error}</Text>}
          <Row><Btn title="Sync now" onPress={() => void syncNow('manual')} /><Btn title="Refresh widgets" kind="ghost" onPress={() => void refreshSurfaces()} /></Row>
        </Card>
        <Card>
          <Label>Lock screen</Label>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[s.text, { flex: 1 }]}>Show “Now” as a silent ongoing notification (lock screen and Always-On)</Text>
            <Switch value={notify} onValueChange={v => { setNotify(v); void setNowNotificationEnabled(v).then(() => { if (v) void refreshSurfaces(); }); }} />
          </Row>
        </Card>
        <Card>
          <Label>Desktop</Label>
          <Text style={s.text2}>Planning, history, insights and settings live on the web app.</Text>
          <Btn title="Open DailyFlow on the web" onPress={() => void Linking.openURL(host || 'https://dailyflow-megomes.vercel.app')} />
        </Card>
        <Card>
          <Label>Device</Label>
          <Text style={s.muted}>{host}</Text>
          <Btn title="Unpair this phone" kind="danger" onPress={async () => { await clearCredential(); await resetStore(); void requestWidgetUpdate; router.replace('/pair'); }} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
