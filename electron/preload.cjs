const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('kannadaOS', {
  platform: process.platform,
})
