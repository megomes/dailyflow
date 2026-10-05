import { requireOptionalNativeModule } from 'expo-modules-core';

const Native = requireOptionalNativeModule<{ schedule(atMs: number): boolean; refreshNow(): boolean }>('WidgetAlarm');

/** Asks Android to redraw every DailyFlow widget at `atMs` (no-op on builds without the module). */
export function scheduleWidgetRefresh(atMs: number) {
  try { Native?.schedule(atMs); } catch { /* not available */ }
}
