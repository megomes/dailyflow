import React from 'react';
import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import type { Snapshot } from '@shared/snapshot';
import type { WidgetInfo } from 'react-native-android-widget';
import { C } from '../theme';

/**
 * Home-screen widgets (spec §81), drawn from the server snapshot. Informational first:
 * tapping opens the app; the Tasks widget cycles its list on tap.
 */
type Render = (s: Snapshot | null, info: WidgetInfo, opts?: { list?: TaskList }) => React.JSX.Element;
export type TaskList = 'inProgress' | 'high' | 'today';

const hex = (s: string) => s as ColorProp;
const card = { height: 'match_parent' as const, width: 'match_parent' as const, backgroundColor: hex(C.surface), borderRadius: 18, borderWidth: 1, borderColor: hex(C.border), padding: 14 };
const label = (text: string) => <TextWidget text={text.toUpperCase()} style={{ fontSize: 10, color: hex(C.muted), letterSpacing: 0.08, fontWeight: '600' }} />;

function Empty({ text }: { text: string }) {
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...card, justifyContent: 'center', alignItems: 'center' }}>
      <TextWidget text={text} style={{ fontSize: 13, color: hex(C.text2), textAlign: 'center' }} />
    </FlexWidget>
  );
}

const Now: Render = s => {
  if (!s) return <Empty text="Open DailyFlow to pair this phone" />;
  const color = s.running?.color ?? s.now?.color ?? C.focus;
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...card, flexDirection: 'column', flexGap: 4, borderLeftWidth: 4, borderLeftColor: hex(color) }}>
      <TextWidget text={s.clock} style={{ fontSize: 12, color: hex(C.muted) }} />
      <TextWidget text={(s.running?.title ?? s.now?.title ?? 'Nothing planned').toUpperCase()} maxLines={1} truncate="END" style={{ fontSize: 20, fontWeight: '700', color: hex(C.text) }} />
      {s.now && <TextWidget text={`${s.now.startLabel}–${s.now.endLabel} · ${s.now.remainingMin} min left`} style={{ fontSize: 13, color: hex(C.text2) }} />}
      {s.focus && <TextWidget text={s.focus.leftSec != null ? `Focus · ${Math.max(0, Math.ceil(s.focus.leftSec / 60))} min` : 'Focus'} style={{ fontSize: 12, color: hex(color) }} />}
      {s.next && <TextWidget text={`Next: ${s.next.title} · ${s.next.startLabel}`} maxLines={1} truncate="END" style={{ fontSize: 12, color: hex(C.muted) }} />}
    </FlexWidget>
  );
};

const Timeline: Render = s => {
  if (!s) return <Empty text="Open DailyFlow to pair this phone" />;
  const items = s.timeline.filter(b => b.end > s.minute - 60).slice(0, 8);
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...card, flexDirection: 'column', flexGap: 5 }}>
      {label(`Today · ${s.clock}`)}
      {items.length === 0 ? <TextWidget text="Nothing left today" style={{ fontSize: 13, color: hex(C.text2) }} /> : items.map((b, i) => {
        const current = b.start <= s.minute && s.minute < b.end;
        return (
          <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', flexGap: 8, width: 'match_parent' }}>
            <TextWidget text={b.startLabel} style={{ fontSize: 12, color: hex(current ? C.text : C.muted) }} />
            <FlexWidget style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: hex(b.color) }} />
            <TextWidget text={b.title} maxLines={1} truncate="END" style={{ fontSize: 13, color: hex(current ? C.text : C.text2), fontWeight: current ? '700' : '400' }} />
          </FlexWidget>
        );
      })}
    </FlexWidget>
  );
};

const TITLES: Record<TaskList, string> = { inProgress: 'In progress', high: 'High priority', today: 'Today' };
const Tasks: Render = (s, _info, opts) => {
  if (!s) return <Empty text="Open DailyFlow to pair this phone" />;
  const list = opts?.list ?? 'today';
  const items = s.tasks[list];
  return (
    <FlexWidget clickAction="CYCLE_LIST" style={{ ...card, flexDirection: 'column', flexGap: 5 }}>
      {label(`${TITLES[list]} · tap to switch`)}
      {items.length === 0 ? <TextWidget text="Nothing here" style={{ fontSize: 13, color: hex(C.text2) }} /> : items.slice(0, 6).map((t, i) => (
        <TextWidget key={i} text={`○  ${t}`} maxLines={1} truncate="END" style={{ fontSize: 13, color: hex(C.text) }} />
      ))}
    </FlexWidget>
  );
};

const NextTasks: Render = s => {
  if (!s) return <Empty text="Pair DailyFlow" />;
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...card, flexDirection: 'column', flexGap: 5 }}>
      {label('Next tasks')}
      {s.tasks.next.length === 0 ? <TextWidget text="No tasks for now" style={{ fontSize: 12, color: hex(C.text2) }} /> : s.tasks.next.map((t, i) => (
        <TextWidget key={i} text={t} maxLines={1} truncate="END" style={{ fontSize: 13, color: hex(i === 0 ? C.text : C.text2), fontWeight: i === 0 ? '600' : '400' }} />
      ))}
    </FlexWidget>
  );
};

const Progress: Render = s => {
  if (!s) return <Empty text="Pair DailyFlow" />;
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ ...card, padding: 10, flexDirection: 'row', alignItems: 'center', flexGap: 12 }}>
      <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
        {label('Now')}
        <TextWidget text={s.running?.title ?? s.now?.title ?? '—'} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '700', color: hex(C.text) }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
        {label('Next')}
        <TextWidget text={s.next ? `${s.next.title} · ${s.next.startLabel}` : '—'} maxLines={1} truncate="END" style={{ fontSize: 13, color: hex(C.text2) }} />
      </FlexWidget>
    </FlexWidget>
  );
};

export const WIDGETS: Record<string, Render> = { Now, Timeline, Tasks, NextTasks, Progress };
