'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { m } from '@/i18n/en';
import { track } from '@/lib/analytics';
import { getDB } from '@/lib/db';
import { collection, forestStats, grow, season, type Plot, type Species, type Tree } from '@/lib/forest';
import { useClock } from '@/lib/hooks';
import { addDays, dateFromIso, fmtDuration } from '@/lib/time';
import type { Area } from '@/lib/types';

const WEEKS = 12;

/** The forest (EH, spec §85): how life was lived, drawn — never a score. */
export default function ForestPage() {
  const { day: today } = useClock();
  const records = useLiveQuery(() => getDB().timeRecords.toArray(), []);
  const areas = useLiveQuery(() => getDB().areas.toArray(), []);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  useEffect(() => { track('forest_opened', {}); }, []);

  const plots = useMemo(() => (records && areas ? grow(records, areas) : new Map<string, Plot>()), [records, areas]);
  if (!records || !areas) return <div className="page" />;
  const areaMap = new Map(areas.map(a => [a.id, a]));
  const stats = forestStats(plots);
  const unlocked = collection(plots);

  // Monday-first grid of the last WEEKS weeks, oldest at the top.
  const d0 = dateFromIso(today);
  const monday = addDays(today, -((d0.getDay() + 6) % 7));
  const first = [...plots.keys()].sort()[0];
  const weeks = first ? Math.min(WEEKS, Math.max(4, Math.ceil((dateFromIso(monday).getTime() - dateFromIso(first).getTime()) / (7 * 864e5)) + 1)) : 4;
  const start = addDays(monday, -7 * (weeks - 1));
  const rows = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));

  return (
    <div className="page forest-page">
      <header className="page-head">
        <div><h1>{m.forest.title}</h1><div className="sub"><span>{m.forest.subtitle}</span></div></div>
      </header>
      <div className="stats">
        <div><b>{stats.trees}</b><span>{m.forest.trees}</span></div>
        <div><b>{stats.mature}</b><span>{m.forest.mature}</span></div>
        <div><b>{unlocked.length}</b><span>{m.forest.species}</span></div>
        <div><b>{stats.days}</b><span>{m.forest.days}</span></div>
      </div>
      <div className="forest" role="img" aria-label={m.forest.title}>
        {rows.map((week, w) => (
          <div key={w} className="forest-row">
            {week.map(day => {
              const p = plots.get(day);
              const future = day > today;
              const text = p ? `${dateFromIso(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${[...p.minutes.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => `${areaMap.get(id)?.name ?? '?'} ${fmtDuration(v)}`).join(' · ')}` : '';
              return (
                <div key={day} className={`plot s-${season(day)}${future ? ' future' : ''}${day === today ? ' today' : ''}`}
                  onMouseMove={p ? (e: MouseEvent) => setTip({ x: e.clientX, y: e.clientY, text }) : undefined} onMouseLeave={() => setTip(null)}>
                  <svg viewBox="0 0 100 100" aria-hidden>
                    <ellipse cx="50" cy="84" rx="46" ry="12" className="ground" />
                    {p && layout(p.trees).map((t, i) => <TreeShape key={i} t={t.tree} x={t.x} y={t.y} color={areaMap.get(t.tree.areaId)?.color ?? 'gray'} />)}
                  </svg>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <section className="section">
        <h2>{m.forest.collection}</h2>
        {unlocked.length === 0 ? <p className="hint">{m.forest.empty}</p> : (
          <div className="collection">
            {unlocked.map(u => {
              const a = areaMap.get(u.areaId);
              return (
                <div key={u.species} className="card species">
                  <svg viewBox="0 0 100 100" aria-hidden><ellipse cx="50" cy="86" rx="30" ry="8" className="ground" /><TreeShape t={{ areaId: u.areaId, species: u.species, size: u.mature ? 3 : 1, seed: 0.5 }} x={50} y={84} color={a?.color ?? 'gray'} /></svg>
                  <b>{m.forest.speciesNames[u.species]}</b>
                  <span className="hint">{a?.name ?? '—'} · {m.forest.since(dateFromIso(u.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</span>
                  {u.mature && <span className="hint">{m.forest.matureSince(dateFromIso(u.mature).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</span>}
                </div>
              );
            })}
          </div>
        )}
        <p className="hint" style={{ margin: 0 }}>{m.forest.rules}</p>
      </section>
      {tip && <div className="chart-tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>}
    </div>
  );
}

/** Up to 6 trees on a plot: back row first so front trees overlap them. */
function layout(trees: Tree[]) {
  const slots = [[24, 66], [44, 62], [64, 64], [82, 68], [14, 80], [34, 82], [56, 84], [78, 83]];
  return trees.slice(0, 8).map((tree, i) => ({ tree, x: slots[i][0] + (tree.seed - 0.5) * 8, y: slots[i][1] + (tree.seed - 0.5) * 3 }))
    .sort((a, b) => a.y - b.y);
}

/** One tree drawn from primitives; the area color tints the canopy, the trunk stays neutral. */
function TreeShape({ t, x, y, color }: { t: Tree; x: number; y: number; color: Area['color'] }) {
  const s = [0.6, 0.85, 1.1, 1.35][t.size];
  const trunk = <rect x={-1.6} y={-10} width={3.2} height={10} rx={1} className="trunk" />;
  const shapes: Record<Species, React.ReactNode> = {
    oak: <>{trunk}<circle cy={-18} r={11} /></>,
    pine: <>{trunk}<path d="M0 -36 L11 -10 L-11 -10 Z" /></>,
    birch: <><rect x={-1.2} y={-14} width={2.4} height={14} className="trunk light" /><ellipse cy={-22} rx={7} ry={11} /></>,
    maple: <>{trunk}<path d="M0 -32 L10 -20 L7 -10 L-7 -10 L-10 -20 Z" /></>,
    cypress: <>{trunk}<ellipse cy={-22} rx={5} ry={15} /></>,
    cherry: <>{trunk}<circle cx={-6} cy={-17} r={7} /><circle cx={6} cy={-17} r={7} /><circle cy={-24} r={7} /></>,
    palm: <><path d="M-1 0 Q2 -14 0 -26" className="trunk-line" /><path d="M0 -26 Q-12 -28 -16 -20 M0 -26 Q12 -28 16 -20 M0 -26 Q-6 -34 -12 -34 M0 -26 Q6 -34 12 -34" className="frond" /></>,
    willow: <>{trunk}<path d="M-12 -6 Q-12 -30 0 -30 Q12 -30 12 -6 Q6 -14 0 -12 Q-6 -14 -12 -6 Z" /></>,
    bamboo: <><rect x={-5} y={-30} width={2.5} height={30} rx={1} /><rect x={-0.5} y={-36} width={2.5} height={36} rx={1} /><rect x={4} y={-26} width={2.5} height={26} rx={1} /></>,
    fern: <path d="M0 0 Q-10 -8 -12 -16 M0 0 Q10 -8 12 -16 M0 0 Q-4 -12 -4 -20 M0 0 Q4 -12 4 -20" className="frond" />,
    flower: <><path d="M0 0 L0 -12" className="trunk-line" /><circle cy={-15} r={4} /><circle cx={-4} cy={-12} r={3} /><circle cx={4} cy={-12} r={3} /></>,
  };
  return <g transform={`translate(${x} ${y}) scale(${s})`} className="tree" data-color={color}>{shapes[t.species]}</g>;
}
