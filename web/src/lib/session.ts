/**
 * Signed device session tokens: `<deviceId>.<issuedAtMs>.<signature>`.
 * Uses Web Crypto so it runs in the proxy and in route handlers alike.
 */
const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = '';
  new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(deviceId: string, secret: string, issuedAt = Date.now()): Promise<string> {
  const payload = `${deviceId}.${issuedAt}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

/** Returns the device id when the token is valid, otherwise null. */
export async function verifySession(token: string | undefined, secret: string | undefined): Promise<string | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [deviceId, issuedAt, sig] = parts;
  if (!/^[\w-]{8,64}$/.test(deviceId) || !/^\d+$/.test(issuedAt)) return null;
  const expected = await hmac(secret, `${deviceId}.${issuedAt}`);
  return safeEqual(sig, expected) ? deviceId : null;
}
