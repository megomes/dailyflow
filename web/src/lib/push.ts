import 'server-only';
import { createHash, createSign } from 'node:crypto';
import { sql } from './server';

/**
 * Live sync: when something changes, every *other* device hears about it in seconds.
 *  - Open apps (web, PWA, the Android app's WebView, the desktop pill) listen to a tiny "head"
 *    in Firebase Realtime Database (`heads/<LIVE_CHANNEL>` = { seq, origin }) over a plain
 *    EventSource and sync as soon as it moves.
 *  - The Android app and the watch, even closed, get an FCM data message and redraw widgets,
 *    the lock-screen notification and complications.
 * Data stays in Neon; Firebase only carries the “something changed” signal. Best effort: every
 * device still syncs on its own timer if a push is lost.
 *
 * Env: FIREBASE_SERVICE_ACCOUNT (base64 JSON of the dailyflow-push service account),
 *      LIVE_DB_URL, LIVE_CHANNEL (48 hex chars; the RTDB rules only allow reading long channel ids).
 */

interface ServiceAccount { client_email: string; private_key: string; project_id: string }
let account: ServiceAccount | null | undefined;
function serviceAccount(): ServiceAccount | null {
  if (account === undefined) {
    try { account = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT ?? '', 'base64').toString('utf8')) as ServiceAccount; }
    catch { account = null; }
    if (!account?.private_key) account = null;
  }
  return account;
}

const SCOPES = 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email';
let cached: { token: string; exp: number } | null = null;

/** OAuth access token for the service account (JWT bearer grant), cached until near expiry. */
async function accessToken(): Promise<string | null> {
  const a = serviceAccount();
  if (!a) return null;
  if (cached && cached.exp > Date.now() + 120_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: a.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(a.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export const liveConfig = () => (process.env.LIVE_DB_URL && process.env.LIVE_CHANNEL ? { url: process.env.LIVE_DB_URL, channel: process.env.LIVE_CHANNEL } : null);
export const tokenId = (token: string) => createHash('sha256').update(token).digest('hex').slice(0, 32);

/** Something changed (by `origin`, a device id, or null for the server): tell everyone else. */
export async function announceChange(origin: string | null, reason: string) {
  try {
    const token = await accessToken();
    if (!token) return;
    const db = sql();
    const head = (await db.query(`select coalesce(max(seq), 0)::text as seq from sync_records`)) as { seq: string }[];
    const seq = Number(head[0]?.seq ?? 0);
    const jobs: Promise<unknown>[] = [];
    const live = liveConfig();
    if (live) {
      jobs.push(fetch(`${live.url}/heads/${live.channel}.json`, {
        method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ seq, origin, reason, at: Date.now() }),
      }));
    }
    const targets = (await db.query(`select id, token from push_targets where device_id is distinct from $1`, [origin])) as { id: string; token: string }[];
    for (const t of targets) jobs.push(sendFcm(token, t, seq, reason));
    await Promise.allSettled(jobs);
  } catch { /* best effort: devices still sync on their own */ }
}

async function sendFcm(token: string, target: { id: string; token: string }, seq: number, reason: string) {
  const a = serviceAccount()!;
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: target.token,
        data: { type: 'sync', seq: String(seq), reason },
        // High priority wakes the app in Doze; collapse keeps only the latest “something changed”.
        android: { priority: 'HIGH', ttl: '120s', collapse_key: 'sync' },
      },
    }),
  });
  if (res.ok) { await sql().query(`update push_targets set last_ok = now() where id = $1`, [target.id]); return; }
  const body = await res.text().catch(() => '');
  // The app was uninstalled or the token rotated: forget it.
  if (res.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(body)) await sql().query(`delete from push_targets where id = $1`, [target.id]);
}
