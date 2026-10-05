'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone } from 'lucide-react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';

/** Settings › Device: one-time code + QR to pair the Android app or a Wear OS watch (EH). */
export function PairDevice() {
  const [pair, setPair] = useState<{ code: string; url: string; expiresAt: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!pair) return;
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(pair.expiresAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pair]);

  async function create() {
    setError(null);
    try {
      const r = await fetch('/api/devices/pair', { method: 'POST' });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { code: string; url: string; expiresAt: string };
      const qr = await QRCode.toDataURL(j.url, { margin: 1, width: 220, color: { dark: '#17171A', light: '#FFFFFF' } });
      setPair({ ...j, qr });
      track('pair_code_created', {});
    } catch (e) { setError(String((e as Error).message)); }
  }

  return (
    <section className="section">
      <h2>{m.pair.title}</h2>
      <p className="hint" style={{ margin: 0 }}>{m.pair.hint}</p>
      {pair && left > 0 ? (
        <div className="pair">
          <img src={pair.qr} alt={m.pair.qrAlt} width={180} height={180} />
          <div className="stack">
            <span className="label">{m.pair.code}</span>
            <b className="pair-code tabular">{pair.code.slice(0, 4)} {pair.code.slice(4)}</b>
            <span className="hint">{m.pair.expires(Math.floor(left / 60), left % 60)}</span>
          </div>
        </div>
      ) : (
        <div className="row"><button type="button" className="btn sm" onClick={() => void create()}><Smartphone size={14} />{m.pair.create}</button></div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
