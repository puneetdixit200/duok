const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kannadaOS', {
  platform: process.platform,
  inspectLocalRuntime: (config) => ipcRenderer.invoke('local-runtime:inspect', config),
  loadLearnerData: () => ipcRenderer.invoke('learner-store:load'),
  saveLearnerData: (values) => ipcRenderer.invoke('learner-store:save', values),
})
