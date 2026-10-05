import type { Task } from './types';

/** Tasks search and filters (E12, CAP-E6). Empty fields mean “any”. */
export interface TaskFilter {
  q?: string;
  areaId?: string;
  priority?: string;
  project?: string;
  tag?: string;
  category?: string;
  due?: 'overdue' | 'week' | 'any' | 'none';
}

export function matches(t: Task, f: TaskFilter, today: string): boolean {
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = [t.title, t.notes ?? '', t.project ?? '', ...(t.tags ?? []), ...(t.subtasks ?? []).map(s => s.title)].join(' ').toLowerCase();
    if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
  }
  if (f.areaId && t.areaId !== f.areaId) return false;
  if (f.priority && t.priority !== f.priority) return false;
  if (f.project && t.project !== f.project) return false;
  if (f.tag && !(t.tags ?? []).includes(f.tag)) return false;
  if (f.category && t.category !== f.category) return false;
  if (f.due === 'none' && t.due) return false;
  if (f.due === 'any' && !t.due) return false;
  if (f.due === 'overdue' && !(t.due && t.due < today && t.status !== 'done')) return false;
  if (f.due === 'week') {
    const lim = new Date(`${today}T12:00:00`); lim.setDate(lim.getDate() + 7);
    if (!(t.due && t.due <= lim.toISOString().slice(0, 10))) return false;
  }
  return true;
}

export const isFiltering = (f: TaskFilter) => Object.values(f).some(v => v);

/** Distinct projects and tags, most used first (for pickers and autocomplete). */
export function facets(tasks: Task[]) {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };
  const live = tasks.filter(t => !t.deleted);
  return { projects: count(live.flatMap(t => (t.project ? [t.project] : []))), tags: count(live.flatMap(t => t.tags ?? [])) };
}
