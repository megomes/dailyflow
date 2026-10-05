import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { remoteSnapshot } from '../snapshot';
import { WIDGETS, type TaskList } from './render';

const ORDER: TaskList[] = ['today', 'inProgress', 'high'];
const listKey = (id: number) => `df.widget.list.${id}`;

/** Runs headless (app closed): fetch the snapshot and draw; the Tasks widget cycles its list on tap. */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction, clickAction } = props;
  if (widgetAction === 'WIDGET_DELETED') { await AsyncStorage.removeItem(listKey(widgetInfo.widgetId)); return; }
  const render = WIDGETS[widgetInfo.widgetName];
  if (!render) return;
  let list = ((await AsyncStorage.getItem(listKey(widgetInfo.widgetId))) as TaskList | null) ?? 'today';
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'CYCLE_LIST') {
    list = ORDER[(ORDER.indexOf(list) + 1) % ORDER.length];
    await AsyncStorage.setItem(listKey(widgetInfo.widgetId), list);
  }
  const snap = await remoteSnapshot();
  props.renderWidget(render(snap, widgetInfo, { list }));
}
