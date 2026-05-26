const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kannadaOS', {
  platform: process.platform,
  e2e: process.env.E2E === '1',
  inspectLocalRuntime: (config) => ipcRenderer.invoke('local-runtime:inspect', config),
  smokeLocalRuntime: (config) => ipcRenderer.invoke('local-runtime:smoke', config),
  generateNativeExercise: (request) => ipcRenderer.invoke('local-runtime:generate-exercise', request),
  transcribeNativeAudio: (request) => ipcRenderer.invoke('local-runtime:transcribe-audio', request),
  transcribeRecordedAudio: (request) => ipcRenderer.invoke('local-runtime:transcribe-recorded-audio', request),
  synthesizeNativeSpeech: (request) => ipcRenderer.invoke('local-runtime:synthesize-speech', request),
  generateHostedChat: (request) => ipcRenderer.invoke('hosted-ai:chat', request),
  loadLearnerData: () => ipcRenderer.invoke('learner-store:load'),
  saveLearnerData: (values) => ipcRenderer.invoke('learner-store:save', values),
})
