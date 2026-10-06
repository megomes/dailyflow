'use client';

/**
 * Live sync, client side: listens to the “head” the server bumps in Firebase Realtime Database on
 * every change (see lib/push.ts) with a plain EventSource (no Firebase SDK), and syncs as soon as
 * another device changed something. The regular sync timer stays as the safety net.
 */
export type LiveState = 'off' | 'connecting' | 'live';
let state: LiveState = 'off';
const subs = new Set<(s: LiveState) => void>();
const set = (s: LiveState) => { state = s; subs.forEach(f => f(s)); };
export const liveState = () => state;
export const subscribeLive = (f: (s: LiveState) => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function startLive(onChange: (reason: string) => void): () => void {
  let stopped = false, es: EventSource | null = null, retry = 2000, lastSeq = 0, me = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const again = () => { if (stopped) return; set('connecting'); timer = setTimeout(connect, retry); retry = Math.min(retry * 2, 60_000); };

  function onHead(ev: Event) {
    let msg: { path?: string; data?: { seq?: number; origin?: string | null; reason?: string } | null };
    try { msg = JSON.parse((ev as MessageEvent).data); } catch { return; }
    const head = msg.path === '/' ? msg.data : null;
    retry = 2000;
    set('live');
    if (!head?.seq || head.seq <= lastSeq) return;
    lastSeq = head.seq;
    if (head.origin !== me) onChange(head.reason ?? 'live');
  }

  async function connect() {
    if (stopped) return;
    try {
      const res = await fetch('/api/live', { cache: 'no-store' });
      if (!res.ok) return again();
      const cfg = (await res.json()) as { url: string | null; channel: string | null; deviceId: string };
      if (!cfg.url || !cfg.channel) { set('off'); return; }
      me = cfg.deviceId;
      es = new EventSource(`${cfg.url}/heads/${cfg.channel}.json`);
      es.addEventListener('put', onHead);
      es.addEventListener('patch', onHead);
      es.addEventListener('cancel', () => { es?.close(); es = null; set('off'); });
      es.onerror = () => { es?.close(); es = null; again(); };
    } catch { again(); }
  }

  set('connecting');
  void connect();
  // Coming back online or to the front: reconnect right away.
  const wake = () => { if (!es && !stopped) { clearTimeout(timer); retry = 2000; void connect(); } };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  return () => { stopped = true; clearTimeout(timer); es?.close(); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); set('off'); };
}
