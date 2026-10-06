/** Inside the Android app the web runs in a WebView; these messages keep its widgets and lock-screen notification in step. */
type NativeMsg = { type: 'changed' } | { type: 'haptic'; kind?: 'light' | 'success' } | { type: 'health-connect' } | { type: 'preview-block' };

declare global { interface Window { ReactNativeWebView?: { postMessage(data: string): void } } }

export const inAndroidApp = () => typeof window !== 'undefined' && !!window.ReactNativeWebView;

export function postNative(msg: NativeMsg) {
  try { window.ReactNativeWebView?.postMessage(JSON.stringify(msg)); } catch { /* not in the app */ }
}
