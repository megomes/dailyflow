'use client';
import { useState } from 'react';
import { LogOut, RefreshCw, Watch } from 'lucide-react';
import { ThemeToggle } from '@/components/AppShell';
import { PairDevice } from '@/components/PairDevice';
import { m } from '@/i18n/en';
import { deviceId, track } from '@/lib/analytics';
import { useSyncState } from '@/lib/hooks';
import { syncNow } from '@/lib/sync';

export default function DevicePage() {
  const s = useSyncState();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function previewMove() {
    setPreview(m.device.previewSending);
    try {
      const r = await fetch('/api/push/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'move' }) });
      const j = (await r.json().catch(() => ({}))) as { reached?: number };
      setPreview(r.ok && j.reached ? m.device.previewSent : m.device.previewNone);
    } catch { setPreview(m.device.previewNone); }
  }

  async function signOut() {
    track('device_signed_out', {});
    await syncNow('sign_out').catch(() => {});
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <>
      <section className="section">
        <h2>{m.device.theme}</h2>
        <div className="row"><ThemeToggle withLabel /></div>
      </section>
      <section className="section">
        <h2>{m.device.sync}</h2>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="secondary">{m.sync[s.status]} · {s.lastSyncedAt ? m.device.lastSync(new Date(s.lastSyncedAt).toLocaleString()) : m.device.never}</span>
          {s.pending > 0 && <span className="hint">{m.device.pending(s.pending)}</span>}
          <span className="hint mono">device {deviceId()}</span>
          <div className="row">
            <button type="button" className="btn sm" disabled={busy} onClick={async () => { setBusy(true); await syncNow('manual'); setBusy(false); }}>
              <RefreshCw size={14} />{m.device.syncNow}
            </button>
          </div>
        </div>
      </section>
      <PairDevice />
      <section className="section">
        <h2><Watch size={15} /> {m.device.watch}</h2>
        <p className="hint" style={{ margin: 0 }}>{m.device.previewHint}</p>
        <div className="row wrap">
          <button type="button" className="btn sm" onClick={() => void previewMove()}>{m.device.previewMove}</button>
          {preview && <span className="hint" role="status">{preview}</span>}
        </div>
      </section>
      <section className="section">
        <h2>{m.device.install}</h2>
        <p className="hint" style={{ margin: 0 }}>{m.device.installHint}</p>
      </section>
      <section className="section">
        <button type="button" className="btn sm danger" style={{ alignSelf: 'flex-start' }} onClick={() => void signOut()}><LogOut size={14} />{m.device.signOut}</button>
        <p className="hint" style={{ margin: 0 }}>{m.device.signOutHint}</p>
      </section>
    </>
  );
}
