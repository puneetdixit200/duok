const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kannadaOS', {
  platform: process.platform,
  inspectLocalRuntime: (config) => ipcRenderer.invoke('local-runtime:inspect', config),
})
