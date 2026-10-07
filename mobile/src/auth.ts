import * as SecureStore from 'expo-secure-store';

/** Paired device credential (spec §78): host + device token, kept in the Android keystore. */
const HOST = 'df.host';
const TOKEN = 'df.token';
// Prefills the pairing screen: EXPO_PUBLIC_DAILYFLOW_HOST in mobile/.env.local (pairing links carry the host anyway).
export const DEFAULT_HOST = process.env.EXPO_PUBLIC_DAILYFLOW_HOST ?? '';

export interface Credential { host: string; token: string }

export async function getCredential(): Promise<Credential | null> {
  const [host, token] = await Promise.all([SecureStore.getItemAsync(HOST), SecureStore.getItemAsync(TOKEN)]);
  return host && token ? { host, token } : null;
}

export async function clearCredential() {
  await Promise.all([SecureStore.deleteItemAsync(HOST), SecureStore.deleteItemAsync(TOKEN)]);
}

/** Trades a one-time code (Settings › Device on the web) for a device token. */
export async function pair(host: string, code: string, label = 'Android'): Promise<Credential> {
  const base = host.replace(/\/$/, '');
  const res = await fetch(`${base}/api/devices/claim`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, label, kind: 'android' }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) throw new Error(body.error === 'invalid_code' ? 'That code is wrong or expired.' : body.error ?? `Pairing failed (${res.status})`);
  await SecureStore.setItemAsync(HOST, base);
  await SecureStore.setItemAsync(TOKEN, body.token);
  return { host: base, token: body.token };
}

/** Parses dailyflow://pair?host=…&code=… from the QR. */
export function parsePairUrl(url: string): { host: string; code: string } | null {
  const m = /^dailyflow:\/\/pair\?(.*)$/.exec(url.trim());
  if (!m) return null;
  const q = new URLSearchParams(m[1]);
  const code = q.get('code');
  return code ? { host: q.get('host') || DEFAULT_HOST, code } : null;
}

export async function api(cred: Credential, path: string, init: RequestInit = {}) {
  return fetch(`${cred.host}${path}`, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${cred.token}`, 'content-type': 'application/json' } });
}
