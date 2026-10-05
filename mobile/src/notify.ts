import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Snapshot, SnapItem } from '@shared/snapshot';

/**
 * Block changes on the phone (note #18): no sticky notification any more. At each block start a
 * notification says what starts (time, to-dos); it is scheduled ahead, so it shows even with the app
 * closed, and it removes itself once that block is started on any device (or once the block is over).
 */
const CHANNEL = 'changes';
const OLD_ID = 'dailyflow-now';
const SCHEDULED = 'df.notify.scheduled';
const ENABLED = 'df.notify.now';

export async function setNowNotificationEnabled(on: boolean) {
  await AsyncStorage.setItem(ENABLED, on ? '1' : '0');
  if (!on) await cancelScheduled();
}
export async function nowNotificationEnabled() { return (await AsyncStorage.getItem(ENABLED)) !== '0'; }

export async function setupNotifications() {
  // The old sticky “Now” notification and its channel go away.
  await Notifications.dismissNotificationAsync(OLD_ID).catch(() => {});
  await Notifications.deleteNotificationChannelAsync('now').catch(() => {});
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Block changes', importance: Notifications.AndroidImportance.HIGH, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false, enableVibrate: true, vibrationPattern: [0, 90, 120, 90, 120, 260],
  });
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') await Notifications.requestPermissionsAsync();
}

const at = (s: Snapshot, min: number) => { const d = new Date(`${s.day}T00:00:00`); d.setMinutes(min); return d; };

function headline(ended: SnapItem | undefined, starts: SnapItem, seed: number): string {
  const pool = ended
    ? ['Swap time! ⏰', `${ended.title} is a wrap 🎬`, `On to ${starts.title} 🚀`, `Next stop: ${starts.title} 🚉`, `${starts.title} o'clock 🕰️`]
    : [`${starts.title} starts now ✨`, `Showtime: ${starts.title} 🎬`, `You're up: ${starts.title} 🚀`];
  return pool[Math.abs(seed) % pool.length];
}

async function cancelScheduled() {
  const ids = JSON.parse((await AsyncStorage.getItem(SCHEDULED)) ?? '[]') as string[];
  for (const id of ids) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await AsyncStorage.setItem(SCHEDULED, '[]');
}

/** Re-plans the notifications for the rest of the day's block starts (the plan may have changed). */
async function scheduleChanges(s: Snapshot) {
  await cancelScheduled();
  const now = Date.now();
  const ids: string[] = [];
  for (const b of s.timeline.filter(x => at(s, x.start).getTime() > now + 15_000).slice(0, 12)) {
    const ended = s.timeline.find(x => x.end === b.start && x !== b);
    const todos = s.todos.filter(t => t.blockStart === b.startLabel && t.blockTitle === b.title);
    const lines = [`${b.title} · ${b.startLabel}–${b.endLabel}`, ...todos.slice(0, 3).map(t => `${t.high ? '!' : '○'} ${t.title}`), ...(todos.length > 3 ? [`+${todos.length - 3} more`] : [])];
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: headline(ended, b, b.start + s.day.length), body: lines.join('\n'), color: b.color, autoDismiss: true,
        priority: Notifications.AndroidNotificationPriority.HIGH, data: { url: 'dailyflow:///', block: b.title, start: b.start, end: b.end, day: s.day },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at(s, b.start), channelId: CHANNEL },
    }).catch(() => null);
    if (id) ids.push(id);
  }
  await AsyncStorage.setItem(SCHEDULED, JSON.stringify(ids));
}

/** A shown change notification goes away once its block is started anywhere, or once it is over. */
async function dismissDone(s: Snapshot) {
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  const doing = new Set([s.running?.title, ...s.alsoRunning.map(r => r.title)].filter(Boolean));
  for (const n of shown) {
    const d = n.request.content.data as { block?: string; end?: number; day?: string } | undefined;
    if (!d?.block) continue;
    const over = d.day !== s.day || (d.end != null && s.minute >= d.end);
    if (doing.has(d.block) || over) await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
  }
}

/** Called on every refresh (app open, after changes in the app, background every ~15 min). */
export async function showNow(s: Snapshot | null) {
  await Notifications.dismissNotificationAsync(OLD_ID).catch(() => {});
  if (!s) return;
  await dismissDone(s);
  if (await nowNotificationEnabled()) await scheduleChanges(s);
  else await cancelScheduled();
}
