const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')
const {
  generateNativeExerciseInMain,
  inspectLocalRuntimeInMain,
  runLocalRuntimeSmokeInMain,
  synthesizeNativeSpeechInMain,
  transcribeNativeAudioInMain,
  transcribeRecordedAudioInMain,
} = require('./local-runtime.cjs')
const {
  getLearnerDataStorePath,
  loadLearnerDataFromDisk,
  saveLearnerDataToDisk,
} = require('./learner-store.cjs')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

if (process.env.KANNADAOS_USER_DATA_DIR) {
  app.setPath('userData', process.env.KANNADAOS_USER_DATA_DIR)
}

ipcMain.handle('local-runtime:inspect', (_event, config) => inspectLocalRuntimeInMain(config))
ipcMain.handle('local-runtime:smoke', (_event, config) => runLocalRuntimeSmokeInMain(config))
ipcMain.handle('local-runtime:generate-exercise', (_event, request) =>
  generateNativeExerciseInMain(request?.runtimeConfig, request?.prompt),
)
ipcMain.handle('local-runtime:transcribe-audio', (_event, request) =>
  transcribeNativeAudioInMain(request?.runtimeConfig, request?.audioPath),
)
ipcMain.handle('local-runtime:transcribe-recorded-audio', (_event, request) =>
  transcribeRecordedAudioInMain(
    request?.runtimeConfig,
    request?.audioBytes,
    request?.source,
    path.join(app.getPath('userData'), 'recordings'),
  ),
)
ipcMain.handle('local-runtime:synthesize-speech', (_event, request) =>
  synthesizeNativeSpeechInMain(request?.runtimeConfig, request?.text, path.join(app.getPath('userData'), 'tts')),
)
ipcMain.handle('learner-store:load', () => loadLearnerDataFromDisk(getLearnerDataStorePath(app)))
ipcMain.handle('learner-store:save', (_event, values) =>
  saveLearnerDataToDisk(getLearnerDataStorePath(app), values),
)

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'KannadaOS',
    backgroundColor: '#101018',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || process.env.E2E === '1') {
    app.quit()
  }
})
