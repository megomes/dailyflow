/**
 * DailyFlow desktop companion (note #20). A shell around the web app, like the Android one: the
 * floating window shows the web's /mini page (Now / Next, timer, actions, to-dos of now) always on
 * top in a corner, and a tray / menu-bar icon shows a progress ring in the area's color plus the
 * timer. Nothing is reimplemented here: features live in the web.
 */
const { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// The DailyFlow server: DAILYFLOW_URL, or desktop/config.json ({ "url": "…" }, git-ignored, bundled in the installer).
const APP_URL = (process.env.DAILYFLOW_URL || (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')).url; } catch { return ''; }
})() || '').replace(/\/$/, '');
if (!APP_URL) throw new Error('Set the DailyFlow server in desktop/config.json (see config.example.json) or DAILYFLOW_URL.');
const ORIGIN = new URL(APP_URL).origin;
const PARTITION = 'persist:dailyflow';
const PILL = { width: 340, height: 76 };
const LOGIN = { width: 400, height: 560 };
const MARGIN = 16;
const SHORTCUT = 'CommandOrControl+Alt+D';

let mini = null;
let main = null;
let tray = null;
let quitting = false;

// ── Saved state (position, visibility) ─────────────────────────────────────
const stateFile = () => path.join(app.getPath('userData'), 'state.json');
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } }
function writeState(patch) { try { fs.writeFileSync(stateFile(), JSON.stringify({ ...readState(), ...patch })); } catch { /* read-only disk */ } }

/** Bottom-right of the screen the window is on (or the primary one), unless the user moved it. */
function initialBounds(size) {
  const saved = readState().bounds;
  if (saved && screen.getAllDisplays().some(d => inside(saved, d.workArea))) return { ...saved, width: size.width, height: size.height };
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - size.width - MARGIN, y: wa.y + wa.height - size.height - MARGIN, ...size };
}
const inside = (b, wa) => b.x >= wa.x - 20 && b.y >= wa.y - 20 && b.x < wa.x + wa.width - 40 && b.y < wa.y + wa.height - 40;

// ── Windows ────────────────────────────────────────────────────────────────
const webPreferences = {
  preload: path.join(__dirname, 'preload.js'),
  partition: PARTITION,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  additionalArguments: [`--df-origin=${ORIGIN}`],
  backgroundThrottling: false, // keep the timer ticking while the window sits unfocused
};

/** Links to other sites open in the browser; DailyFlow stays in the app. */
function guard(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) { openApp(new URL(url).pathname); return { action: 'deny' }; }
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) { e.preventDefault(); void shell.openExternal(url); } });
}

function createMini() {
  const b = initialBounds(PILL);
  mini = new BrowserWindow({
    ...b,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    title: 'DailyFlow',
    backgroundColor: '#00000000',
    webPreferences,
  });
  mini.setAlwaysOnTop(true, 'floating');
  mini.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  guard(mini);
  mini.loadURL(`${APP_URL}/mini`);
  mini.once('ready-to-show', () => { if (readState().hidden !== true) mini.showInactive(); });
  mini.on('moved', () => { if (!onLogin()) writeState({ bounds: mini.getBounds() }); });
  mini.on('close', e => { if (!quitting) { e.preventDefault(); setMiniVisible(false); } });
  // Signing in happens in the same window, made bigger for the login form.
  mini.webContents.on('did-navigate', () => fitToPage());
  mini.webContents.on('did-navigate-in-page', () => fitToPage());
}

const onLogin = () => { try { return new URL(mini.webContents.getURL()).pathname.startsWith('/login'); } catch { return false; } };

function fitToPage() {
  if (!mini) return;
  if (onLogin()) {
    const wa = screen.getDisplayMatching(mini.getBounds()).workArea;
    mini.setResizable(true);
    mini.setBounds({ x: wa.x + wa.width - LOGIN.width - MARGIN, y: wa.y + wa.height - LOGIN.height - MARGIN, ...LOGIN });
    mini.setResizable(false);
    mini.show();
    mini.focus();
  }
}

/** The page asks for its size (pill ⇄ card). The window grows away from the screen edge it sits on. */
function resizeMini(size) {
  if (!mini || onLogin()) return;
  const w = Math.max(56, Math.min(600, Math.round(size.width)));
  const h = Math.max(56, Math.min(800, Math.round(size.height)));
  const b = mini.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  const bottomHalf = b.y + b.height / 2 > wa.y + wa.height / 2;
  const rightHalf = b.x + b.width / 2 > wa.x + wa.width / 2;
  let x = rightHalf ? b.x + b.width - w : b.x;
  let y = bottomHalf ? b.y + b.height - h : b.y;
  x = Math.max(wa.x, Math.min(x, wa.x + wa.width - w));
  y = Math.max(wa.y, Math.min(y, wa.y + wa.height - h));
  mini.setResizable(true);
  mini.setBounds({ x, y, width: w, height: h });
  mini.setResizable(false);
}

function setMiniVisible(show) {
  if (!mini) return;
  if (show) { mini.showInactive(); mini.setAlwaysOnTop(true, 'floating'); } else mini.hide();
  writeState({ hidden: !show });
  refreshMenu();
}

function openApp(p = '/') {
  if (main && !main.isDestroyed()) {
    main.loadURL(`${APP_URL}${p}`);
    main.show(); main.focus();
    return;
  }
  main = new BrowserWindow({ width: 1280, height: 860, minWidth: 380, minHeight: 500, title: 'DailyFlow', backgroundColor: '#141416', autoHideMenuBar: true, webPreferences, icon: path.join(__dirname, 'build', 'icon.png') });
  guard(main);
  main.loadURL(`${APP_URL}${p}`);
  main.on('closed', () => { main = null; });
}

// ── Tray / menu bar ────────────────────────────────────────────────────────
function trayImage(dataUrl) {
  const img = dataUrl ? nativeImage.createFromDataURL(dataUrl) : nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png'));
  return img.resize({ width: process.platform === 'darwin' ? 18 : 16, height: process.platform === 'darwin' ? 18 : 16, quality: 'best' });
}

function refreshMenu() {
  if (!tray) return;
  const visible = !!mini?.isVisible();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? 'Hide floating Now' : 'Show floating Now', accelerator: SHORTCUT, click: () => setMiniVisible(!visible) },
    { label: 'Open DailyFlow', click: () => openApp('/') },
    { label: 'Tasks', click: () => openApp('/tasks') },
    { type: 'separator' },
    { label: 'Put back in the corner', click: () => { writeState({ bounds: null }); if (mini) { const { width, height } = mini.getBounds(); mini.setBounds(initialBounds({ width, height })); } } },
    { label: 'Open at login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: i => { app.setLoginItemSettings({ openAtLogin: i.checked }); } },
    { type: 'separator' },
    { label: 'Quit DailyFlow', click: () => { quitting = true; app.quit(); } },
  ]));
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('DailyFlow');
  tray.on('click', () => setMiniVisible(!mini?.isVisible()));
  refreshMenu();
}

// Hover for the collapsed pill (note #32): a draggable window never gets mouse events in the page,
// so the shell watches the cursor and tells the page when it is over the window.
let hoverInside = false;
function watchHover() {
  setInterval(() => {
    if (!mini || mini.isDestroyed() || !mini.isVisible() || onLogin()) return;
    const p = screen.getCursorScreenPoint();
    const b = mini.getBounds();
    const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
    if (inside !== hoverInside) { hoverInside = inside; mini.webContents.send('df:hover', inside); }
  }, 60);
}

// ── IPC from the page ──────────────────────────────────────────────────────
const fromApp = e => { try { return new URL(e.senderFrame.url).origin === ORIGIN; } catch { return false; } };
ipcMain.on('df:setSize', (e, size) => { if (fromApp(e) && size) resizeMini(size); });
ipcMain.on('df:setTray', (e, t) => {
  if (!fromApp(e) || !tray || !t) return;
  if (t.icon) tray.setImage(trayImage(t.icon));
  tray.setToolTip(String(t.tooltip || 'DailyFlow').slice(0, 127));
  if (process.platform === 'darwin') tray.setTitle(String(t.title || '').slice(0, 40), { fontType: 'monospacedDigit' });
});
ipcMain.on('df:openApp', (e, p) => { if (fromApp(e)) openApp(typeof p === 'string' && p.startsWith('/') ? p : '/'); });
ipcMain.on('df:hide', e => { if (fromApp(e)) setMiniVisible(false); });

// ── Lifecycle ──────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => setMiniVisible(true));
  app.whenReady().then(() => {
    if (process.platform === 'darwin') app.dock?.hide();
    app.setAppUserModelId('app.dailyflow.desktop');
    createTray();
    createMini();
    watchHover();
    globalShortcut.register(SHORTCUT, () => setMiniVisible(!mini?.isVisible()));
    screen.on('display-removed', () => { if (mini) { const { width, height } = mini.getBounds(); mini.setBounds(initialBounds({ width, height })); } });
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => { /* lives in the tray */ });
}
