const fs = require('node:fs')
const path = require('node:path')

const learnerDataFileName = 'learner-data.json'
const schemaVersion = 1
const appName = 'KannadaOS'

function getLearnerDataStorePath(appInstance) {
  return path.join(appInstance.getPath('userData'), learnerDataFileName)
}

function loadLearnerDataFromDisk(storePath) {
  try {
    if (!fs.existsSync(storePath)) {
      return null
    }

    return hydrateLearnerData(JSON.parse(fs.readFileSync(storePath, 'utf8')))
  } catch {
    return null
  }
}

function saveLearnerDataToDisk(storePath, values, savedAt = new Date().toISOString()) {
  const payload = {
    schemaVersion,
    appName,
    savedAt,
    values: sanitizeLearnerValues(values),
  }
  const directory = path.dirname(storePath)
  const tempPath = path.join(directory, `${path.basename(storePath)}.${process.pid}.${Date.now()}.tmp`)

  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2))
  fs.renameSync(tempPath, storePath)

  return payload
}

function hydrateLearnerData(value) {
  if (!isRecord(value) || value.schemaVersion !== schemaVersion || value.appName !== appName) {
    return null
  }

  if (typeof value.savedAt !== 'string' || !isRecord(value.values)) {
    return null
  }

  return {
    schemaVersion,
    appName,
    savedAt: value.savedAt,
    values: sanitizeLearnerValues(value.values),
  }
}

function sanitizeLearnerValues(values) {
  if (!isRecord(values)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => key.startsWith('kannadaos:') && typeof value === 'string'),
  )
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

module.exports = {
  getLearnerDataStorePath,
  loadLearnerDataFromDisk,
  saveLearnerDataToDisk,
}
