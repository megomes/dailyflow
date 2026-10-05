import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { showNow } from './notify';
import { remoteSnapshot } from './snapshot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Snapshot } from '@shared/snapshot';
import { WIDGETS, type TaskList } from './widgets/render';

const TASK = 'dailyflow-refresh';

/** Every ~15 min (Android minimum): refresh widgets and the lock-screen notification. */
TaskManager.defineTask(TASK, async () => {
  try {
    await refreshSurfaces();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export function registerBackgroundRefresh() {
  BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 }).catch(() => {});
}

/** Redraws every widget and the lock-screen notification. `snap` from the local store when the app is open. */
export async function refreshSurfaces(local?: Snapshot | null) {
  const snap = local ?? (await remoteSnapshot());
  await showNow(snap);
  for (const [name, render] of Object.entries(WIDGETS)) {
    await requestWidgetUpdate({
      widgetName: name,
      renderWidget: async info => render(snap, info, { list: ((await AsyncStorage.getItem(`df.widget.list.${info.widgetId}`)) as TaskList | null) ?? 'today' }),
    });
  }
}
