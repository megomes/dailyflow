// Entry: the app (a native shell around the web app) + the headless handlers that run without the UI (widgets, background refresh).
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './src/App';
import { registerBackgroundRefresh } from './src/background';
import { widgetTaskHandler } from './src/widgets/handler';

registerWidgetTaskHandler(widgetTaskHandler);
registerBackgroundRefresh();
registerRootComponent(App);
