import * as Updates from 'expo-updates';

let busy = false;

/**
 * OTA (EAS Update, channel production): whenever the app comes to the front, check, download and
 * reload right away, so a published change shows up on the next open instead of the one after.
 */
export async function applyOta() {
  if (__DEV__ || !Updates.isEnabled || busy) return;
  busy = true;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Offline or the server is down: keep running what we have.
  } finally {
    busy = false;
  }
}
