import type { Area, Priority } from './types';

/**
 * Quick-add parsing: the to-do is typed as plain text and a few optional tokens fill fields,
 * shown back as chips while typing (so the syntax is discoverable, never required).
 *   30m · 1h · 1h30 · 90min   → estimate
 *   !  (or !!)                → high priority
 *   #maker                    → area (prefix of the name, accents ignored)
 *   today/hoje · tomorrow/amanhã → day
 */
export interface Parsed {
  title: string;
  estimate?: number;
  priority?: Priority;
  areaId?: string;
  areaToken?: string;
  when?: 'today' | 'tomorrow';
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function parseQuick(input: string, areas: Pick<Area, 'id' | 'name'>[] = []): Parsed {
  let text = ` ${input} `;
  const out: Parsed = { title: '' };

  const dur = /\s(\d{1,2})h(\d{2})?\s|\s(\d{1,3})\s?(m|min)\s|\s(\d{1,2})\s?h\s/i;
  const d = dur.exec(text);
  if (d) {
    const min = d[1] ? Number(d[1]) * 60 + Number(d[2] ?? 0) : d[3] ? Number(d[3]) : Number(d[5]) * 60;
    if (min > 0 && min <= 12 * 60) { out.estimate = min; text = text.replace(d[0], ' '); }
  }

  if (/\s!{1,3}(?=\s)/.test(text)) { out.priority = 'high'; text = text.replace(/\s!{1,3}(?=\s)/, ' '); }

  const tag = /\s#([\p{L}\d-]+)/u.exec(text);
  if (tag) {
    const q = fold(tag[1]);
    const area = areas.find(a => fold(a.name).startsWith(q)) ?? areas.find(a => fold(a.name).split(/\s+/).some(w => w.startsWith(q)));
    if (area) { out.areaId = area.id; out.areaToken = tag[1]; text = text.replace(tag[0], ' '); }
  }

  const when = /\s(today|hoje|tomorrow|amanh[aã])(?=\s)/i.exec(text);
  if (when) { out.when = /^(today|hoje)$/i.test(when[1]) ? 'today' : 'tomorrow'; text = text.replace(when[0], ' '); }

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}
