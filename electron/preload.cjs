const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure context bridge exposing desktop integration to the renderer window.
 * Matches PautelloDesktopBridge in src/utils/download.ts.
 */
const bridge = {
  platform: process.platform,
  version: process.versions.electron,

  saveFile: async (options) => {
    return await ipcRenderer.invoke('pautello:save-file', options);
  },

  printToPdf: async (options) => {
    return await ipcRenderer.invoke('pautello:print-to-pdf', options);
  },
};

contextBridge.exposeInMainWorld('pautello', bridge);
contextBridge.exposeInMainWorld('stavio', bridge);
contextBridge.exposeInMainWorld('sonata', bridge);
