/** Inside the Android app the web runs in a WebView; these messages keep its widgets and lock-screen notification in step. */
type NativeMsg = { type: 'changed' } | { type: 'haptic'; kind?: 'light' | 'success' } | { type: 'health-connect' } | { type: 'preview-block' }
  /** Colors for the strips the app paints around the page (status bar above, gesture bar below), so they match the theme. */
  | { type: 'theme'; top: string; bottom: string; light: boolean };

declare global { interface Window { ReactNativeWebView?: { postMessage(data: string): void } } }

export const inAndroidApp = () => typeof window !== 'undefined' && !!window.ReactNativeWebView;

export function postNative(msg: NativeMsg) {
  try { window.ReactNativeWebView?.postMessage(JSON.stringify(msg)); } catch { /* not in the app */ }
}

/**
 * Inside the app, the native shell already keeps the page clear of the status and gesture bars:
 * mark the page (so the CSS stops adding those insets again) and send the theme's colors for both strips.
 */
export function syncNativeChrome() {
  if (!inAndroidApp()) return;
  const root = document.documentElement;
  root.classList.add('in-app');
  const css = getComputedStyle(root);
  const top = css.getPropertyValue('--bg-app').trim();
  const bottom = css.getPropertyValue('--bg-sidebar').trim();
  if (top && bottom) postNative({ type: 'theme', top, bottom, light: root.dataset.theme === 'light' });
}
