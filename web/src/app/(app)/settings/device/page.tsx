'use client';
import { useState } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { ThemeToggle } from '@/components/AppShell';
import { m } from '@/i18n/en';
import { deviceId, track } from '@/lib/analytics';
import { useSyncState } from '@/lib/hooks';
import { syncNow } from '@/lib/sync';

export default function DevicePage() {
  const s = useSyncState();
  const [busy, setBusy] = useState(false);

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
