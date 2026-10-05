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
  if (s.running) {
    const off = s.now && s.now.title !== s.running.title;
    return {
      mode: 'running', tag: off ? 'DOING · OFF PLAN' : 'NOW', title: s.running.title, color: s.running.color,
      sub: off ? `planned ${s.now!.title} until ${s.now!.endLabel}` : s.now ? `since ${s.running.sinceLabel} · until ${s.now.endLabel}` : `since ${s.running.sinceLabel}`,
      progress: s.now && !off ? s.now.progress : null, action: 'QUICK_STOP',
    };
  }
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

export function DayWidget({ s, info, pending }: { s: Snapshot | null; info: WidgetInfo; pending?: string[] }) {
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
  const pad = 14;
  const inner = W - pad * 2;
  const todos = s.todos.filter(t => !pending?.includes(t.id));
  const doneCount = s.todayCount.done + (s.todos.length - todos.length);
  const total = doneCount + todos.length;
  // Rows that fit: hero ~128, ribbon 40, next 34, to-do header 26, padding; each to-do row 30.
  const rows = Math.max(1, Math.min(todos.length, Math.floor((H - 128 - 40 - (s.next ? 34 : 0) - 26 - pad * 2 - 6) / 30)));
  const more = todos.length - rows;
  const heroClick = hz.mode === 'empty' ? { clickAction: 'OPEN_URI', clickActionData: { uri: 'dailyflow:///' } } : { clickAction: 'OPEN_APP' };

  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', backgroundColor: hex(C.surface), borderRadius: 26, borderWidth: 1, borderColor: hex(C.borderSubtle), padding: 6 }}>
      {/* Hero: the present moment */}
      <FlexWidget {...heroClick} style={{ width: 'match_parent', flexDirection: 'column', borderRadius: 21, padding: pad - 2, paddingBottom: 12,
        backgroundGradient: { from: hex(tint(hz.color, 0.34, C.surface)), to: hex(tint(hz.color, 0.1, C.surface)), orientation: 'TL_BR' } }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget text={hz.tag} style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1, color: hex(tint(hz.color, 0.55, C.text)) }} />
            <TextWidget text={hz.title} maxLines={2} truncate="END" style={{ fontSize: 22, fontWeight: '700', color: hex(C.text), marginTop: 2 }} />
            <TextWidget text={hz.sub} maxLines={1} truncate="END" style={{ fontSize: 12.5, color: hex(C.text2), marginTop: 2 }} />
          </FlexWidget>
          {hz.action && <SvgWidget svg={actionSvg(hz.action, hz.color)} clickAction={hz.action} style={{ width: 40, height: 40, marginLeft: 10 }} />}
        </FlexWidget>
        {hz.progress != null && <SvgWidget svg={barSvg(inner - 8, hz.progress, hz.color)} style={{ width: inner - 8, height: 6, marginTop: 10 }} />}
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', paddingHorizontal: pad - 6, paddingTop: 10 }}>
        {/* The day, as a ribbon */}
        {s.timeline.length > 0 && (
          <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flexDirection: 'column' }}>
            <SvgWidget svg={ribbonSvg(s, inner, 30)} style={{ width: inner, height: 30 }} />
          </FlexWidget>
        )}
        {s.next && (
          <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextWidget text="NEXT" style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1, color: hex(C.muted) }} />
            <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex(s.next.color), marginLeft: 10, marginRight: 7 }} />
            <FlexWidget style={{ flex: 1 }}><TextWidget text={s.next.title} maxLines={1} truncate="END" style={{ fontSize: 13.5, fontWeight: '600', color: hex(C.text) }} /></FlexWidget>
            <TextWidget text={s.next.startLabel} style={{ fontSize: 13, color: hex(C.text2), marginLeft: 8 }} />
          </FlexWidget>
        )}

        {/* To-dos: check off from here */}
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 2 }}>
          <TextWidget text="TO-DO" style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.1, color: hex(C.muted) }} />
          {total > 0 && <SvgWidget svg={dots(doneCount, total)} style={{ width: Math.min(total, 10) * 9, height: 8, marginLeft: 10 }} />}
          <FlexWidget style={{ flex: 1 }}><TextWidget text={total > 0 ? `${doneCount}/${total}` : ' '} style={{ fontSize: 11.5, color: hex(C.muted), marginLeft: 6 }} /></FlexWidget>
          <TextWidget text="+ Add" clickAction="OPEN_URI" clickActionData={{ uri: 'dailyflow:///tasks' }} style={{ fontSize: 12.5, fontWeight: '600', color: hex(C.text2), paddingHorizontal: 6, paddingVertical: 2 }} />
        </FlexWidget>
        {todos.length === 0 ? (
          <TextWidget text={total > 0 ? 'All done for today ✓' : 'Nothing on today'} style={{ fontSize: 13, color: hex(total > 0 ? C.ok : C.text2), marginTop: 6 }} />
        ) : todos.slice(0, rows).map(t => (
          <FlexWidget key={t.id} style={{ width: 'match_parent', height: 30, flexDirection: 'row', alignItems: 'center' }}>
            <SvgWidget svg={checkSvg(t.color, t.high)} clickAction="TODO_DONE" clickActionData={{ id: t.id }} style={{ width: 30, height: 30, paddingRight: 8 }} />
            <FlexWidget clickAction="OPEN_APP" style={{ flex: 1 }}><TextWidget text={t.title} maxLines={1} truncate="END" style={{ fontSize: 14, color: hex(t.inNow || t.high ? C.text : C.text2), fontWeight: t.inNow ? '600' : '400' }} /></FlexWidget>
            {t.estimate != null && <TextWidget text={dur(t.estimate)} style={{ fontSize: 12, color: hex(C.muted), marginLeft: 8 }} />}
          </FlexWidget>
        ))}
        {more > 0 && <TextWidget text={`+${more} more`} clickAction="OPEN_URI" clickActionData={{ uri: 'dailyflow:///tasks' }} style={{ fontSize: 12, color: hex(C.muted), marginTop: 2, marginLeft: 30 }} />}
      </FlexWidget>
    </FlexWidget>
  );
}
