import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api, getCredential, type Credential } from './auth';
import { refreshSurfaces } from './background';

/**
 * Live sync on the phone: the server sends an FCM data message (“something changed”) whenever
 * another device changes anything. Even with the app closed, Android wakes this task, which
 * redraws the widgets and the lock-screen notification right away. With the app open the
 * WebView already syncs through the live head.
 */
export const PUSH_TASK = 'dailyflow-push';

TaskManager.defineTask<{ data?: Record<string, unknown> }>(PUSH_TASK, async () => {
  await refreshSurfaces().catch(() => {});
});

const isSync = (n: Notifications.Notification) => (n.request.content.data as { type?: string } | null)?.type === 'sync'
  || (n.request.trigger as { remoteMessage?: { data?: { type?: string } } } | null)?.remoteMessage?.data?.type === 'sync';

/** Silent: a sync signal never shows anything. */
export function isSilentSync(n: Notifications.Notification) { return isSync(n); }

async function register(cred: Credential, token: string) {
  await api(cred, '/api/push/register', { method: 'POST', body: JSON.stringify({ token, platform: 'android' }) }).catch(() => null);
}

/** Hands the FCM token to the server (and again whenever it rotates); arms the background task. */
export async function setupPush(onForegroundSync?: () => void) {
  const cred = await getCredential();
  if (!cred) return;
  await Notifications.registerTaskAsync(PUSH_TASK).catch(() => {});
  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data === 'string') await register(cred, data);
  } catch { /* no Play Services: the app keeps syncing on its own */ }
  Notifications.addPushTokenListener(t => { if (typeof t.data === 'string') void register(cred, t.data); });
  Notifications.addNotificationReceivedListener(n => { if (isSync(n)) { void refreshSurfaces().catch(() => {}); onForegroundSync?.(); } });
}
