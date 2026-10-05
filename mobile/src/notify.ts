import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Snapshot } from '@shared/snapshot';

/**
 * Lock screen / Always-On (spec §82): an ongoing, silent notification with the present moment,
 * minimal on purpose — “WORK until 11:00 · Next: Music”. Updated by the app and the background task.
 */
const CHANNEL = 'now';
const ID = 'dailyflow-now';
const ENABLED = 'df.notify.now';

export async function setNowNotificationEnabled(on: boolean) {
  await AsyncStorage.setItem(ENABLED, on ? '1' : '0');
  if (!on) await Notifications.dismissNotificationAsync(ID).catch(() => {});
}
export async function nowNotificationEnabled() { return (await AsyncStorage.getItem(ENABLED)) !== '0'; }

export async function setupNotifications() {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Now', importance: Notifications.AndroidImportance.LOW, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false, sound: null, vibrationPattern: null, enableVibrate: false,
  });
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') await Notifications.requestPermissionsAsync();
}

export function nowText(s: Snapshot): { title: string; body: string } {
  if (s.focus) {
    const left = s.focus.leftSec;
    return { title: `${s.focus.paused ? 'Paused · ' : ''}${s.focus.title}`, body: left == null ? 'Focus' : left >= 0 ? `Focus · ${Math.ceil(left / 60)} min left` : `Focus · over by ${Math.ceil(-left / 60)} min` };
  }
  const head = s.running ? `${s.running.title.toUpperCase()} · since ${s.running.sinceLabel}` : s.now ? `${s.now.title.toUpperCase()} until ${s.now.endLabel}` : 'Nothing planned now';
  const next = s.next ? `Next: ${s.next.title} · ${s.next.startLabel}` : 'Nothing else today';
  return { title: head, body: next };
}

export async function showNow(s: Snapshot | null) {
  if (!s || !(await nowNotificationEnabled())) return;
  const t = nowText(s);
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title: t.title, body: t.body, sticky: true, autoDismiss: false, priority: Notifications.AndroidNotificationPriority.LOW, data: { url: 'dailyflow://' } },
    trigger: { channelId: CHANNEL } as Notifications.NotificationTriggerInput,
  });
}
