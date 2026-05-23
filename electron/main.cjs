const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')
const { inspectLocalRuntimeInMain } = require('./local-runtime.cjs')
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
