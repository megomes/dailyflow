// Entry: expo-router app + the headless handlers that run without the UI (widgets, background refresh).
import 'expo-router/entry';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/handler';
import { registerBackgroundRefresh } from './src/background';

registerWidgetTaskHandler(widgetTaskHandler);
registerBackgroundRefresh();
