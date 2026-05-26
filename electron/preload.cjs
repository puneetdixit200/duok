const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kannadaOS', {
  platform: process.platform,
  inspectLocalRuntime: (config) => ipcRenderer.invoke('local-runtime:inspect', config),
  smokeLocalRuntime: (config) => ipcRenderer.invoke('local-runtime:smoke', config),
  generateNativeExercise: (request) => ipcRenderer.invoke('local-runtime:generate-exercise', request),
  transcribeNativeAudio: (request) => ipcRenderer.invoke('local-runtime:transcribe-audio', request),
  transcribeRecordedAudio: (request) => ipcRenderer.invoke('local-runtime:transcribe-recorded-audio', request),
  synthesizeNativeSpeech: (request) => ipcRenderer.invoke('local-runtime:synthesize-speech', request),
  loadLearnerData: () => ipcRenderer.invoke('learner-store:load'),
  saveLearnerData: (values) => ipcRenderer.invoke('learner-store:save', values),
})
