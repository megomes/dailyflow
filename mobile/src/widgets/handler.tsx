import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import type { Snapshot } from '@shared/snapshot';
import { api, getCredential } from '../auth';
import { remoteSnapshot } from '../snapshot';
import { WIDGETS, type TaskList } from './render';

const ORDER: TaskList[] = ['today', 'inProgress', 'high'];
const listKey = (id: number) => `df.widget.list.${id}`;
const SNAP = 'df.widget.snap';
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

async function cached(): Promise<Snapshot | null> {
  try { return JSON.parse((await AsyncStorage.getItem(SNAP)) ?? 'null') as Snapshot | null; } catch { return null; }
}

/** Fresh from the server (and remembered, so taps can redraw instantly before the network answers). */
export async function freshSnapshot(): Promise<Snapshot | null> {
  const s = await remoteSnapshot();
  if (s) await AsyncStorage.setItem(SNAP, JSON.stringify(s));
  return s ?? (await cached());
}

/** Runs headless (app closed): fetch the snapshot and draw. Taps: Tasks cycles its list; Day starts/stops and checks off to-dos. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction, clickActionData } = props;
  if (widgetAction === 'WIDGET_DELETED') { await AsyncStorage.removeItem(listKey(widgetInfo.widgetId)); return; }
  const render = WIDGETS[widgetInfo.widgetName];
  if (!render) return;
  let list = ((await AsyncStorage.getItem(listKey(widgetInfo.widgetId))) as TaskList | null) ?? 'today';

  if (widgetAction === 'WIDGET_CLICK') {
    if (clickAction === 'CYCLE_LIST') {
      list = ORDER[(ORDER.indexOf(list) + 1) % ORDER.length];
      await AsyncStorage.setItem(listKey(widgetInfo.widgetId), list);
    }
    const cred = await getCredential();
    if (cred && clickAction === 'TODO_DONE' && typeof clickActionData?.id === 'string') {
      const id = clickActionData.id;
      // Optimistic: the circle disappears and the count goes up right away.
      props.renderWidget(render(await cached(), widgetInfo, { list, pending: [id] }));
      await api(cred, '/api/quick', { method: 'POST', body: JSON.stringify({ action: 'done', taskId: id, tz: tz() }) }).catch(() => null);
    }
    if (cred && (clickAction === 'QUICK_START' || clickAction === 'QUICK_STOP')) {
      await api(cred, '/api/quick', { method: 'POST', body: JSON.stringify({ action: clickAction === 'QUICK_START' ? 'start' : 'stop', tz: tz() }) }).catch(() => null);
    }
  }
  props.renderWidget(render(await freshSnapshot(), widgetInfo, { list }));
}
