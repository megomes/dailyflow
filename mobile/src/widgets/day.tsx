import React from 'react';
import { FlexWidget, SvgWidget, TextWidget, type ColorProp, type WidgetInfo } from 'react-native-android-widget';
import type { Snapshot } from '@shared/snapshot';
import { C, tint } from '../theme';

/**
 * The big home-screen widget (4×4): the present moment, the shape of the day and what to do.
 * Built for a glance: absolute times only (it refreshes every ~15 min, so “in 12 min” would lie),
 * the area color carries identity, and the to-dos can be checked off right here.
 */
const hex = (s: string) => s as ColorProp;
const hhmm = (min: number) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const dur = (min: number) => { const m = Math.max(0, Math.round(min)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`; };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

type Mode = 'focus' | 'running' | 'idle' | 'free' | 'over' | 'empty';
interface Hero { mode: Mode; tag: string; title: string; sub: string; color: string; progress: number | null; action: 'QUICK_START' | 'QUICK_STOP' | null }

/** What the top of the widget says, by priority: focus > running > the plan says now > free > the day is over > no plan. */
export function hero(s: Snapshot): Hero {
  const nowColor = s.now?.color ?? C.focus;
  if (s.focus) {
    const total = s.focus.leftSec != null ? s.focus.leftSec + s.focus.elapsedSec : null;
    const ends = s.focus.endsAt ? new Date(s.focus.endsAt) : null;
    return {
      mode: 'focus', tag: s.focus.paused ? 'FOCUS · PAUSED' : 'FOCUS', title: s.focus.title, color: s.running?.color ?? nowColor,
      sub: ends ? `ends ${String(ends.getHours()).padStart(2, '0')}:${String(ends.getMinutes()).padStart(2, '0')}` : `since ${hhmm(s.minute - s.focus.elapsedSec / 60)}`,
      progress: total ? Math.min(1, s.focus.elapsedSec / total) : null, action: null,
    };
  }
  const also = s.alsoRunning ?? [];
  if (s.running && also.length) {
    // Two things at once (a meeting + guitar): both names, the main one's color.
    return {
      mode: 'running', tag: `${also.length + 1} AT ONCE`, title: [s.running.title, ...also.map(a => a.title)].join(' + '), color: s.running.color,
      sub: `since ${s.running.sinceLabel}${s.now ? ` · until ${s.now.endLabel}` : ''}`, progress: s.now ? s.now.progress : null, action: 'QUICK_STOP',
    };
  }
  if (s.running) {
    const off = s.now && s.now.title !== s.running.title;
    return {
      mode: 'running', tag: s.running.paused ? 'PAUSED' : off ? 'DOING · OFF PLAN' : 'NOW', title: s.running.title, color: s.running.color,
      // Same line everywhere: time at it and time left in the block (note #34).
      sub: off ? `${s.running.line} · planned ${s.now!.title} until ${s.now!.endLabel}` : s.running.line ?? `since ${s.running.sinceLabel}`,
      progress: s.now && !off ? s.now.progress : null, action: 'QUICK_STOP',
    };
  }
  const nowAll = s.nowAll ?? [];
  if (nowAll.length > 1) return { mode: 'idle', tag: `${nowAll.length} AT ONCE · NOT STARTED`, title: nowAll.map(b => b.title).join(' + '), color: nowAll[0].color, sub: `until ${nowAll[0].endLabel}`, progress: s.now?.progress ?? null, action: 'QUICK_START' };
  if (s.now) return { mode: 'idle', tag: 'NOW · NOT STARTED', title: s.now.title, color: s.now.color, sub: `${s.now.startLabel} – ${s.now.endLabel}`, progress: s.now.progress, action: 'QUICK_START' };
  if (s.next) return { mode: 'free', tag: 'FREE', title: `Free until ${s.next.startLabel}`, color: C.muted, sub: `then ${s.next.title}`, progress: null, action: null };
  if (s.timeline.length) return { mode: 'over', tag: 'DAY DONE', title: 'That was the day', color: C.ok, sub: `${dur(s.progress.trackedMin)} tracked · close it in the app`, progress: null, action: null };
  return { mode: 'empty', tag: 'NO PLAN', title: 'Plan your day', color: C.focus, sub: 'Tap to open the planner', progress: null, action: null };
}

/** The day as one ribbon: blocks in their area color, the past dimmed, a marker at now. */
export function ribbonSvg(s: Snapshot, w: number, h: number): string {
  const blocks = s.timeline;
  if (!blocks.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"/>`;
  const from = Math.floor(Math.min(...blocks.map(b => b.start), s.minute) / 60) * 60;
  const to = Math.ceil(Math.max(...blocks.map(b => b.end), s.minute + 1) / 60) * 60;
  const x = (m: number) => ((m - from) / (to - from)) * w;
  const barY = 4, barH = h - 18;
  const parts: string[] = [`<rect x="0" y="${barY}" width="${w}" height="${barH}" rx="5" fill="${C.hover}"/>`];
  for (const b of blocks) {
    const x0 = x(b.start) + 0.75, x1 = x(b.end) - 0.75;
    if (x1 <= x0) continue;
    parts.push(`<rect x="${x0.toFixed(1)}" y="${barY}" width="${(x1 - x0).toFixed(1)}" height="${barH}" rx="4" fill="${b.color}" fill-opacity="${b.end <= s.minute ? 0.32 : 0.85}"/>`);
    if (b.start < s.minute && s.minute < b.end) parts.push(`<rect x="${x0.toFixed(1)}" y="${barY}" width="${(x(s.minute) - x0).toFixed(1)}" height="${barH}" rx="4" fill="#000" fill-opacity="0.35"/>`);
  }
  const nx = Math.max(1.5, Math.min(w - 1.5, x(s.minute)));
  parts.push(`<rect x="${(nx - 1.25).toFixed(1)}" y="0" width="2.5" height="${barH + 8}" rx="1.25" fill="${C.now}"/>`);
  const step = to - from > 12 * 60 ? 240 : to - from > 6 * 60 ? 180 : 60;
  for (let m = Math.ceil(from / step) * step; m <= to; m += step) {
    const lx = x(m);
    const anchor = lx < 10 ? 'start' : lx > w - 10 ? 'end' : 'middle';
    parts.push(`<text x="${lx.toFixed(1)}" y="${h - 1}" font-size="10" font-family="sans-serif" fill="${C.muted}" text-anchor="${anchor}">${esc(hhmm(m).slice(0, 2))}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`;
}

const barSvg = (w: number, p: number, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="6" viewBox="0 0 ${w} 6"><rect width="${w}" height="6" rx="3" fill="#FFFFFF" fill-opacity="0.12"/><rect width="${Math.max(6, w * Math.min(1, Math.max(0, p))).toFixed(1)}" height="6" rx="3" fill="${color}"/></svg>`;

const checkSvg = (color: string, high: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="${high ? C.now : color}" stroke-width="1.8"/></svg>`;

const actionSvg = (kind: 'QUICK_START' | 'QUICK_STOP', color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${color}"/>${kind === 'QUICK_STOP'
    ? '<rect x="14" y="14" width="12" height="12" rx="2.5" fill="#FFFFFF"/>'
    : '<path d="M16 12.5 L28 20 L16 27.5 Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>'}</svg>`;

const dots = (done: number, total: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.min(total, 10) * 9}" height="8">${Array.from({ length: Math.min(total, 10) }, (_, i) =>
    `<circle cx="${i * 9 + 4}" cy="4" r="3" fill="${i < done ? C.ok : C.active}"/>`).join('')}</svg>`;

const smallCheckSvg = (color: string, high: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="5.5" fill="none" stroke="${high ? C.now : color}" stroke-width="1.5" stroke-opacity="0.85"/></svg>`;

function SectionLabel({ text, right }: { text: string; right?: React.JSX.Element }) {
  return (
    <FlexWidget style={{ width: 'match_parent', height: 22, flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget style={{ flex: 1 }}><TextWidget text={text} style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1, color: hex(C.muted) }} /></FlexWidget>
      {right ?? <FlexWidget style={{ width: 1, height: 1 }} />}
    </FlexWidget>
  );
}

// Row heights (dp), to fit as much as the widget's real size allows.
const HERO = 96, RIBBON = 36, LABEL = 22, AGENDA_ROW = 28, TODO_ROW = 32, LATER_ROW = 23, GAP = 8;

export interface Fit { agendaRows: number; nowRows: number; laterRows: number; hidden: number }

/** How many rows of each section fit: 3 agenda rows first, then this block's to-dos, the rest compact; leftover goes back to the agenda. */
export function fitRows(H: number, hasRibbon: boolean, agenda: number, now: number, later: number): Fit {
  let room = H - 12 - HERO - (hasRibbon ? RIBBON : 0) - GAP * 2;
  let agendaRows = Math.min(agenda, 3);
  room -= agenda ? LABEL + agendaRows * AGENDA_ROW : 0;
  room -= LABEL;
  const nowRows = Math.min(now, Math.max(0, Math.floor(room / TODO_ROW)));
  room -= nowRows * TODO_ROW;
  if (later && now) room -= LABEL;
  let laterRows = Math.min(later, Math.max(0, Math.floor(room / LATER_ROW)));
  room -= laterRows * LATER_ROW;
  while (agendaRows < agenda && agendaRows < 7 && room >= AGENDA_ROW) { agendaRows++; room -= AGENDA_ROW; }
  // Keep a line for “+N more” when something does not fit.
  if (nowRows + laterRows < now + later && room < 18 && laterRows > 0) laterRows--;
  return { agendaRows, nowRows, laterRows, hidden: now + later - nowRows - laterRows };
}

export function DayWidget({ s, info, pending, laterOpen = false }: { s: Snapshot | null; info: WidgetInfo; pending?: string[]; laterOpen?: boolean }) {
  const W = Math.max(220, info.width);
  const H = Math.max(220, info.height);
  if (!s) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hex(C.surface), borderRadius: 26, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <TextWidget text="DailyFlow" style={{ fontSize: 18, fontWeight: '700', color: hex(C.text) }} />
        <TextWidget text="Open the app to pair this phone" style={{ fontSize: 13, color: hex(C.text2), marginTop: 4 }} />
      </FlexWidget>
    );
  }
  const hz = hero(s);
  const pad = 12;
  const inner = W - 12 - (pad - 4) * 2;
  const todos = s.todos.filter(t => !pending?.includes(t.id));
  const doneCount = s.todayCount.done + (s.todos.length - todos.length);
  const total = doneCount + todos.length;
  const nowTodos = todos.filter(t => t.inNow);
  const later = todos.filter(t => !t.inNow);
  // Everything on now first (parallel blocks together), then what comes next.
  const isNowB = (b: { start: number; end: number }) => b.start <= s.minute && s.minute < b.end;
  const agenda = [...s.timeline.filter(isNowB), ...s.timeline.filter(b => b.start > s.minute)];
  const perBlock = new Map<string, number>();
  for (const t of todos) if (t.blockStart) perBlock.set(`${t.blockStart}|${t.blockTitle}`, (perBlock.get(`${t.blockStart}|${t.blockTitle}`) ?? 0) + 1);
  // The rest of today stays collapsed (one line) until tapped open: the widget is a summary.
  const fit = fitRows(H, s.timeline.length > 0, agenda.length, nowTodos.length, laterOpen ? later.length : 1);
  const laterRows = laterOpen ? fit.laterRows : 0;
  const heroClick = hz.mode === 'empty' ? { clickAction: 'OPEN_URI', clickActionData: { uri: 'dailyflow:///' } } : { clickAction: 'OPEN_APP' };

  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', backgroundColor: hex(C.surface), borderRadius: 26, borderWidth: 1, borderColor: hex(C.borderSubtle), padding: 6 }}>
      {/* Hero: what is happening */}
      <FlexWidget {...heroClick} style={{ width: 'match_parent', flexDirection: 'column', borderRadius: 21, paddingHorizontal: pad, paddingTop: 10, paddingBottom: 11,
        backgroundGradient: { from: hex(tint(hz.color, 0.34, C.surface)), to: hex(tint(hz.color, 0.1, C.surface)), orientation: 'TL_BR' } }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget text={hz.tag} style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.1, color: hex(tint(hz.color, 0.55, C.text)) }} />
            <TextWidget text={hz.title} maxLines={1} truncate="END" style={{ fontSize: 20, fontWeight: '700', color: hex(C.text) }} />
            <TextWidget text={hz.sub} maxLines={1} truncate="END" style={{ fontSize: 12, color: hex(C.text2) }} />
          </FlexWidget>
          {hz.action && <SvgWidget svg={actionSvg(hz.action, hz.color)} clickAction={hz.action} style={{ width: 38, height: 38, marginLeft: 10 }} />}
        </FlexWidget>
        {hz.progress != null && <SvgWidget svg={barSvg(inner - 8, hz.progress, hz.color)} style={{ width: inner - 8, height: 6, marginTop: 8 }} />}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', paddingHorizontal: pad - 4, paddingTop: GAP }}>
        {s.timeline.length > 0 && (
          <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', height: RIBBON - 6 }}>
            <SvgWidget svg={ribbonSvg(s, inner, 28)} style={{ width: inner, height: 28 }} />
          </FlexWidget>
        )}

        {/* Now & next, as a short agenda */}
        {agenda.length > 0 && <SectionLabel text={(s.nowAll?.length ?? 0) > 1 ? `NOW (${s.nowAll!.length} AT ONCE) & NEXT` : 'NOW & NEXT'} />}
        {agenda.slice(0, fit.agendaRows).map((b, i) => {
          const isNow = b.start <= s.minute && s.minute < b.end;
          const n = perBlock.get(`${b.startLabel}|${b.title}`) ?? 0;
          return (
            <FlexWidget key={`a${i}`} clickAction="OPEN_APP" style={{ width: 'match_parent', height: AGENDA_ROW, flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 6,
              ...(isNow ? { backgroundColor: hex(tint(b.color, 0.16, C.surface)) } : {}) }}>
              <TextWidget text={b.startLabel} style={{ fontSize: 12.5, color: hex(isNow ? C.text : C.muted), fontWeight: isNow ? '700' : '400' }} />
              <FlexWidget style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: hex(b.color), marginLeft: 8, marginRight: 8 }} />
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget text={b.title} maxLines={1} truncate="END" style={{ fontSize: 13.5, color: hex(isNow ? C.text : C.text2), fontWeight: isNow ? '700' : '500' }} />
              </FlexWidget>
              {n > 0 && <TextWidget text={`${n} to-do${n > 1 ? 's' : ''}`} style={{ fontSize: 11, color: hex(C.muted), marginLeft: 6 }} />}
              <TextWidget text={isNow ? `until ${b.endLabel}` : dur(b.end - b.start)} style={{ fontSize: 11.5, color: hex(isNow ? C.text2 : C.muted), marginLeft: 8 }} />
            </FlexWidget>
          );
        })}

        {/* To-dos: this block's in full, the rest of today compact */}
        <FlexWidget style={{ width: 'match_parent', height: GAP }} />
        <SectionLabel text={nowTodos.length ? 'TO-DO NOW' : 'TO-DO TODAY'} right={(
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
            {total > 0 && <SvgWidget svg={dots(doneCount, total)} style={{ width: Math.min(total, 10) * 9, height: 8 }} />}
            {total > 0 && <TextWidget text={`${doneCount}/${total}`} style={{ fontSize: 11, color: hex(C.muted), marginLeft: 6 }} />}
            <TextWidget text="+ Add" clickAction="OPEN_URI" clickActionData={{ uri: 'dailyflow:///tasks' }} style={{ fontSize: 12, fontWeight: '600', color: hex(C.text2), marginLeft: 10, paddingHorizontal: 4 }} />
          </FlexWidget>
        )} />
        {todos.length === 0 && (
          <TextWidget text={total > 0 ? 'All done for today ✓' : 'Nothing on today'} style={{ fontSize: 13, color: hex(total > 0 ? C.ok : C.text2), marginTop: 4 }} />
        )}
        {nowTodos.slice(0, fit.nowRows).map(t => (
          <FlexWidget key={t.id} style={{ width: 'match_parent', height: TODO_ROW, flexDirection: 'row', alignItems: 'center' }}>
            <SvgWidget svg={checkSvg(t.color, t.high)} clickAction="TODO_DONE" clickActionData={{ id: t.id }} style={{ width: 30, height: 30 }} />
            <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, marginLeft: 4 }}>
              <TextWidget text={t.title} maxLines={1} truncate="END" style={{ fontSize: 14.5, fontWeight: '600', color: hex(C.text) }} />
            </FlexWidget>
            {t.estimate != null && <TextWidget text={dur(t.estimate)} style={{ fontSize: 12, color: hex(C.muted), marginLeft: 8 }} />}
          </FlexWidget>
        ))}
        {later.length > 0 && (
          <FlexWidget clickAction="TOGGLE_LATER" style={{ width: 'match_parent', height: LATER_ROW + 2, flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget text={`${nowTodos.length ? 'LATER TODAY' : 'TODAY'} · ${later.length}`} style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1, color: hex(C.muted) }} />
            </FlexWidget>
            <TextWidget text={laterOpen ? '▾ hide' : '▸ show'} style={{ fontSize: 11.5, fontWeight: '600', color: hex(C.text2), paddingHorizontal: 4 }} />
          </FlexWidget>
        )}
        {later.slice(0, laterRows).map(t => (
          <FlexWidget key={t.id} style={{ width: 'match_parent', height: LATER_ROW, flexDirection: 'row', alignItems: 'center' }}>
            <SvgWidget svg={smallCheckSvg(t.color, t.high)} clickAction="TODO_DONE" clickActionData={{ id: t.id }} style={{ width: 26, height: 22 }} />
            <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, marginLeft: 4 }}>
              <TextWidget text={t.title} maxLines={1} truncate="END" style={{ fontSize: 12.5, color: hex(t.high ? C.text : C.text2) }} />
            </FlexWidget>
            <TextWidget text={t.blockStart ?? 'any time'} style={{ fontSize: 11, color: hex(C.muted), marginLeft: 8 }} />
          </FlexWidget>
        ))}
        {(laterOpen ? fit.hidden : nowTodos.length - fit.nowRows) > 0 && <TextWidget text={`+${laterOpen ? fit.hidden : nowTodos.length - fit.nowRows} more`} clickAction="OPEN_URI" clickActionData={{ uri: 'dailyflow:///tasks' }} style={{ fontSize: 11.5, color: hex(C.muted), marginTop: 2, marginLeft: 30 }} />}
      </FlexWidget>
    </FlexWidget>
  );
}
