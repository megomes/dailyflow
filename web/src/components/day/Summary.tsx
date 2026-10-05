'use client';
import { m } from '@/i18n/en';
import { areaTotals, recEnd } from '@/lib/actual';
import { AreaIcon } from '@/lib/icons';
import { trackedByTask } from '@/lib/ops';
import { fmtDuration } from '@/lib/time';
import type { DayData } from './useDay';

/** Day summary (CAP-G4): Baseline × Final × Real by area, plus tracked coverage, tasks and focus. */
export function Summary({ d, until }: { d: DayData; until: number }) {
  const base = areaTotals(d.day?.baseline ?? []);
  const fin = areaTotals(d.blocks);
  const real = areaTotals(d.records.map(r => ({ start: r.start, end: recEnd(r, until), areaId: r.areaId })));
  const ids = [...new Set([...base.keys(), ...fin.keys(), ...real.keys()])].sort((a, b) => (real.get(b) ?? 0) - (real.get(a) ?? 0) || (fin.get(b) ?? 0) - (fin.get(a) ?? 0));
  const max = Math.max(1, ...ids.map(id => Math.max(fin.get(id) ?? 0, real.get(id) ?? 0, base.get(id) ?? 0)));
  const tracked = [...real.values()].reduce((s, v) => s + v, 0);
  const planned = [...fin.values()].reduce((s, v) => s + v, 0);
  const focusMin = [...trackedByTask(d.sessions).values()].reduce((s, v) => s + v.min, 0) + d.sessions.filter(s => !s.taskId).reduce((s, x) => s + (x.actualMin ?? 0), 0);
  const hasBase = !!d.day?.baseline;
  return (
    <section className="card stack summary">
      <b>{m.close.summaryTitle}</b>
      <div className="stats">
        <div><b>{fmtDuration(tracked)}</b><span>{m.close.tracked}</span></div>
        <div><b>{planned ? Math.round((tracked / planned) * 100) : 0}%</b><span>{m.close.coverage}</span></div>
        <div><b>{d.tasks.filter(t => t.status === 'done').length}/{d.tasks.length}</b><span>{m.close.tasksDone}</span></div>
        <div><b>{fmtDuration(focusMin)}</b><span>{m.close.focus}</span></div>
      </div>
      <table className="sum-table">
        <thead><tr><th>{m.close.colArea}</th>{hasBase && <th>{m.close.colBaseline}</th>}<th>{m.close.colFinal}</th><th>{m.close.colReal}</th><th className="bars-col" /></tr></thead>
        <tbody>
          {ids.map(id => {
            const a = d.areaMap.get(id);
            const r = real.get(id) ?? 0, f = fin.get(id) ?? 0;
            return (
              <tr key={id} data-color={a?.color ?? 'gray'}>
                <td><span className="row">{a && <AreaIcon name={a.icon} size={13} />}{a?.name ?? m.close.unplanned}</span></td>
                {hasBase && <td className="tabular muted">{fmtDuration(base.get(id) ?? 0)}</td>}
                <td className="tabular muted">{fmtDuration(f)}</td>
                <td className={`tabular ${r > f + 10 ? 'up' : r < f - 10 ? 'down' : ''}`}>{fmtDuration(r)}</td>
                <td className="bars-col"><div className="sbar"><i className="f" style={{ width: `${(f / max) * 100}%` }} /><i className="r" style={{ width: `${(r / max) * 100}%` }} /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {d.revisions.length > 0 && <span className="hint">{m.close.revisions}: {d.revisions.length}</span>}
      {d.day?.reflection && (d.day.reflection.wentWell || d.day.reflection.change) && (
        <div className="hint">{d.day.reflection.energy ? `${m.close.energy} ${d.day.reflection.energy}/5 · ` : ''}{d.day.reflection.wentWell}{d.day.reflection.change ? ` · ${d.day.reflection.change}` : ''}</div>
      )}
    </section>
  );
}
