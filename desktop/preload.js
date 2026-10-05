// Bridge for the /mini page (web/src/lib/desktop.ts). Only DailyFlow's own origin gets it.
const { contextBridge, ipcRenderer } = require('electron');

const allowed = process.argv.find(a => a.startsWith('--df-origin='))?.slice('--df-origin='.length);

if (allowed && location.origin === allowed) {
  contextBridge.exposeInMainWorld('dailyflowDesktop', {
    setSize: size => ipcRenderer.send('df:setSize', size),
    setTray: t => ipcRenderer.send('df:setTray', t),
    openApp: path => ipcRenderer.send('df:openApp', path),
    hide: () => ipcRenderer.send('df:hide'),
  });
}
