'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vault', {
  load: () => ipcRenderer.invoke('vault:load'),
  save: (items) => ipcRenderer.invoke('vault:save', items),
  copy: (text) => ipcRenderer.invoke('vault:copy', text),
  hide: () => ipcRenderer.invoke('vault:hide'),
  onFocusSearch: (cb) => ipcRenderer.on('focus-search', () => cb()),
  onReload: (cb) => ipcRenderer.on('vault:reload', (_e, added) => cb(added))
});
