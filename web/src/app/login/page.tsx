'use client';
import { useState, type FormEvent } from 'react';
import { m } from '@/i18n/en';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, label: navigator.userAgent.slice(0, 120) }),
      });
      if (res.ok) {
        // Back to where the login was asked from (e.g. the desktop companion's /mini); same-site paths only.
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = next && /^\/(?!\/)/.test(next) ? next : '/';
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error === 'too_many' ? m.login.tooMany : body.error === 'not_configured' ? m.login.notConfigured : m.login.wrong);
    } catch {
      setError(m.login.network);
    }
    setBusy(false);
  }

  return (
    <main className="login">
      <div className="login-card">
        <img src="/icon-192.png" alt="" />
        <h1>{m.app.name}</h1>
        <form onSubmit={submit}>
          <label className="sr-only" htmlFor="code">{m.login.title}</label>
          <input id="code" className="input" type="password" autoComplete="current-password" autoFocus placeholder={m.login.placeholder}
            value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy || !code.trim()}>{m.login.submit}</button>
        </form>
        {error ? <p className="error" role="alert">{error}</p> : <p className="hint">{m.login.hint}</p>}
      </div>
    </main>
  );
}
