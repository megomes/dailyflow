/**
 * Inside the desktop companion (Electron, `desktop/`) the /mini page talks to the shell through
 * `window.dailyflowDesktop` (preload): window size, the tray/menu-bar icon and title, opening the app.
 */
export interface DesktopBridge {
  setSize(size: { width: number; height: number }): void;
  setTray(t: { title: string; tooltip: string; icon?: string }): void;
  openApp(path?: string): void;
  hide(): void;
}

declare global { interface Window { dailyflowDesktop?: DesktopBridge } }

export const desktop = (): DesktopBridge | undefined => (typeof window !== 'undefined' ? window.dailyflowDesktop : undefined);
export const inDesktopApp = () => !!desktop();
