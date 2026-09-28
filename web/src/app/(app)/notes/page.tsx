'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, GitCommitHorizontal, MonitorSmartphone, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { m } from '@/i18n/en';
import { previousScreen, track } from '@/lib/analytics';
import { collectContext, summarizeContext, type ClientContext } from '@/lib/clientContext';

type Kind = 'bug' | 'idea' | 'ux' | 'question';
type Status = 'open' | 'discussing' | 'in_progress' | 'done' | 'ignored';
type Filter = 'all' | 'open' | 'in_progress' | 'done' | 'ignored';

interface LogEntry { ts: string; actor: 'user' | 'claude'; action: string; message: string | null; detail: Record<string, unknown> }
interface Resolution { summary?: string; done?: string[]; ignored?: string[]; decisions?: string[]; follow_ups?: string[]; commits?: string[]; deployed?: string }
interface Note {
  id: number; body: string; kind: Kind; status: Status; stage: string | null; appVersion: string | null; screen: string | null;
  resolution: Resolution; context: Partial<ClientContext> & { server?: Record<string, unknown> }; createdAt: string; updatedAt: string; log: LogEntry[];
}
interface Pending { clientId: string; body: string; kind: Kind; screen: string; createdAt: string; context: ClientContext }

const KINDS: Kind[] = ['bug', 'idea', 'ux', 'question'];
const KIND_COLOR: Record<Kind, string> = { bug: 'red', idea: 'yellow', ux: 'purple', question: 'cyan' };
const STATUS_COLOR: Record<Status, string> = { open: 'gray', discussing: 'purple', in_progress: 'blue', done: 'green', ignored: 'gray' };
const REPO = 'https://github.com/megomes/dailyflow/commit/';
const PENDING_KEY = 'df-pending-notes';

const inFilter = (s: Status, f: Filter) => f === 'all' || (f === 'open' ? s === 'open' || s === 'discussing' : s === f);
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function readPending(): Pending[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function writePending(list: Pending[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
}

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

/** Sends notes written offline; returns the ones still waiting. */
async function flushPending(): Promise<Pending[]> {
  const left: Pending[] = [];
  for (const p of readPending()) {
    try {
      // Written offline if the note waited more than a few seconds before being sent.
      const context = { ...p.context, writtenAt: p.createdAt, sentAt: new Date().toISOString(), queuedOffline: Date.now() - Date.parse(p.createdAt) > 10_000 };
      const r = await api('/api/notes', { method: 'POST', body: JSON.stringify({ body: p.body, kind: p.kind, screen: p.screen, clientId: p.clientId, context }) });
      if (!r.ok) left.push(p);
    } catch { left.push(p); }
  }
  writePending(left);
  return left;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [nonce, setNonce] = useState(0);
  const reload = () => setNonce(n => n + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const left = await flushPending();
      try {
        const r = await api<{ notes: Note[] }>('/api/notes');
        if (!r.ok) throw new Error(String(r.status));
        if (!cancelled) { setNotes(r.data.notes); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) setPending(left);
    })();
    return () => { cancelled = true; };
  }, [nonce]);

  useEffect(() => {
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, open: 0, in_progress: 0, done: 0, ignored: 0 };
    for (const n of notes ?? []) (['all', 'open', 'in_progress', 'done', 'ignored'] as Filter[]).forEach(f => { if (inFilter(n.status, f)) c[f]++; });
    return c;
  }, [notes]);

  const shown = (notes ?? []).filter(n => inFilter(n.status, filter));

  async function add(body: string, kind: Kind) {
    const context = await collectContext();
    const p: Pending = { clientId: crypto.randomUUID(), body, kind, screen: previousScreen() || 'notes', createdAt: new Date().toISOString(), context };
    track('note_created', { kind, chars: body.length, from: p.screen, surface: context.device.surface, layout: context.device.layout });
    writePending([...readPending(), p]);
    setPending(readPending());
    reload();
  }

  return (
    <div className="page notes-page">
      <header className="page-head">
        <div><h1>{m.notes.title}</h1><div className="sub">{m.notes.subtitle}</div></div>
      </header>

      <Composer onAdd={add} />

      <div className="row wrap" style={{ margin: '18px 0 10px' }}>
        <div className="seg" role="group" aria-label="Filter">
          {(['all', 'open', 'in_progress', 'done', 'ignored'] as Filter[]).map(f => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {m.notes.filters[f]} <span className="muted tabular">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="hint">{navigator.onLine ? m.notes.loadError : m.notes.offline}</p>}

      <div className="notes">
        {pending.map(p => (
          <article key={p.clientId} className="card note pending">
            <div className="note-head"><span className="note-id mono">#…</span><span className="pill" data-color={KIND_COLOR[p.kind]}>{m.notes.kinds[p.kind]}</span><span className="pill" data-color="yellow">{m.notes.pending}</span></div>
            <p className="note-body">{p.body}</p>
          </article>
        ))}
        {notes && !shown.length && !pending.length && <p className="hint">{m.notes.empty}</p>}
        {shown.map(n => <NoteCard key={n.id} note={n} onChanged={reload} />)}
      </div>
    </div>
  );
}

function KindPicker({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="row wrap" role="group" aria-label="Type">
      {KINDS.map(k => (
        <button key={k} type="button" className="chip" data-color={KIND_COLOR[k]} aria-pressed={value === k} onClick={() => onChange(k)}>
          <span className="dot" />{m.notes.kinds[k]}
        </button>
      ))}
    </div>
  );
}

function Composer({ onAdd }: { onAdd: (body: string, kind: Kind) => void }) {
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Kind>('idea');
  const submit = () => {
    const b = body.trim();
    if (!b) return;
    onAdd(b, kind);
    setBody('');
  };
  return (
    <div className="card composer">
      <textarea className="input" rows={3} placeholder={m.notes.placeholder} value={body} onChange={e => setBody(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }} aria-label={m.notes.placeholder} />
      <div className="row wrap">
        <KindPicker value={kind} onChange={setKind} />
        <span className="spacer" />
        <span className="hint">{m.notes.shortcut}</span>
        <button type="button" className="btn sm primary" disabled={!body.trim()} onClick={submit}>{m.notes.add}</button>
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return <div className="res-block"><span className="label">{title}</span><ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>;
}

function NoteCard({ note, onChanged }: { note: Note; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [kind, setKind] = useState<Kind>(note.kind);
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState('');
  const r = note.resolution ?? {};
  const open = note.status === 'open';
  const hasResolution = !!(r.summary || r.done?.length || r.ignored?.length || r.decisions?.length || r.follow_ups?.length || r.commits?.length || r.deployed);

  async function save() {
    const res = await api(`/api/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify({ body: body.trim(), kind, context: await collectContext() }) });
    if (res.status === 409) { setMsg(m.notes.locked); return; }
    track('note_edited', { id: note.id });
    setEditing(false); onChanged();
  }
  async function del() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    const res = await api(`/api/notes/${note.id}`, { method: 'DELETE' });
    if (res.status === 409) { setMsg(m.notes.locked); return; }
    track('note_deleted', { id: note.id });
    onChanged();
  }
  async function reopen() {
    await api(`/api/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'reopen', context: await collectContext() }) });
    track('note_reopened', { id: note.id });
    onChanged();
  }

  return (
    <article className={`card note s-${note.status}`} id={`note-${note.id}`}>
      <div className="note-head">
        <span className="note-id mono">#{note.id}</span>
        <span className="pill" data-color={KIND_COLOR[note.kind]}>{m.notes.kinds[note.kind]}</span>
        <span className="pill" data-color={STATUS_COLOR[note.status]} data-status={note.status}>{m.notes.status[note.status]}</span>
        <span className="hint tabular">{fmtWhen(note.createdAt)}</span>
        <span className="spacer" />
        {open && !editing && (
          <>
            <button type="button" className="btn sm ghost" onClick={() => { setBody(note.body); setKind(note.kind); setEditing(true); setMsg(''); }}><Pencil size={13} />{m.notes.edit}</button>
            <button type="button" className={`btn sm ghost${armed ? ' danger' : ''}`} onClick={() => void del()}><Trash2 size={13} />{armed ? m.notes.confirmDelete : m.notes.delete}</button>
          </>
        )}
        {(note.status === 'done' || note.status === 'ignored') && (
          <button type="button" className="btn sm ghost" onClick={() => void reopen()}><RotateCcw size={13} />{m.notes.reopen}</button>
        )}
      </div>

      {summarizeContext(note.context) && (
        <div className="note-device hint"><MonitorSmartphone size={13} />{summarizeContext(note.context)}</div>
      )}

      {editing ? (
        <div className="note-edit">
          <textarea className="input" rows={3} value={body} onChange={e => setBody(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); } if (e.key === 'Escape') setEditing(false); }} />
          <div className="row wrap">
            <KindPicker value={kind} onChange={setKind} />
            <span className="spacer" />
            <button type="button" className="btn sm ghost" onClick={() => setEditing(false)}>{m.notes.cancel}</button>
            <button type="button" className="btn sm primary" disabled={!body.trim()} onClick={() => void save()}>{m.notes.save}</button>
          </div>
        </div>
      ) : <p className="note-body">{note.body}</p>}
      {msg && <p className="error" style={{ margin: 0 }}>{msg}</p>}

      {hasResolution && (
        <div className="resolution">
          {r.summary && <div className="res-block"><span className="label">{m.notes.resolution.summary}</span><p>{r.summary}</p></div>}
          <List title={m.notes.resolution.done} items={r.done} />
          <List title={m.notes.resolution.ignored} items={r.ignored} />
          <List title={m.notes.resolution.decisions} items={r.decisions} />
          <List title={m.notes.resolution.follow_ups} items={r.follow_ups} />
          {(r.commits?.length || r.deployed) && (
            <div className="row wrap res-meta">
              {r.commits?.map(c => (
                <a key={c} className="chip mono" href={`${REPO}${c}`} target="_blank" rel="noreferrer"><GitCommitHorizontal size={13} />{c.slice(0, 7)}</a>
              ))}
              {r.deployed && <span className="hint">{m.notes.resolution.deployed}: {r.deployed}</span>}
            </div>
          )}
        </div>
      )}

      <details className="note-log">
        <summary><ChevronRight size={13} />{m.notes.history(note.log.length)}<span className="hint">{m.notes.meta(note.stage ?? '', note.appVersion ?? '', note.screen)}</span></summary>
        <ol>
          {note.log.map((l, i) => (
            <li key={i}>
              <span className="mono tabular muted">{fmtWhen(l.ts)}</span>
              <span className={`actor a-${l.actor}`}>{m.notes.actors[l.actor]}</span>
              <span>{m.notes.actions[l.action] ?? l.action}{l.detail?.status ? ` → ${m.notes.status[l.detail.status as Status] ?? String(l.detail.status)}` : ''}{l.message ? `: ${l.message}` : ''}</span>
              {l.action === 'edited' && typeof l.detail?.from === 'string' && <span className="log-prev">“{String(l.detail.from)}”</span>}
            </li>
          ))}
        </ol>
        {note.context && Object.keys(note.context).length > 0 && (
          <details className="debug">
            <summary>Debug info</summary>
            <pre className="mono">{JSON.stringify(note.context, null, 2)}</pre>
          </details>
        )}
      </details>
    </article>
  );
}
