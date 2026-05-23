import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { loadLearnerDataFromDisk, saveLearnerDataToDisk } = require('../../electron/learner-store.cjs') as {
  loadLearnerDataFromDisk: (storePath: string) => {
    schemaVersion: 1
    appName: 'KannadaOS'
    savedAt: string
    values: Record<string, string>
  } | null
  saveLearnerDataToDisk: (
    storePath: string,
    values: Record<string, unknown>,
    savedAt?: string,
  ) => {
    schemaVersion: 1
    appName: 'KannadaOS'
    savedAt: string
    values: Record<string, string>
  }
}

describe('electron learner data store', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-store-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('saves and restores only KannadaOS learner storage values atomically', () => {
    const storePath = path.join(tempDir, 'nested', 'learner-data.json')

    const saved = saveLearnerDataToDisk(
      storePath,
      {
        'kannadaos:onboarded': 'true',
        'kannadaos:progress': '{"xp":42}',
        'kannadaos:conversation-log': '{"auto-ride":[]}',
        'foreign:key': 'ignore me',
        'kannadaos:not-string': 42,
      },
      '2026-05-23T18:30:00.000Z',
    )

    expect(saved).toEqual({
      schemaVersion: 1,
      appName: 'KannadaOS',
      savedAt: '2026-05-23T18:30:00.000Z',
      values: {
        'kannadaos:onboarded': 'true',
        'kannadaos:progress': '{"xp":42}',
        'kannadaos:conversation-log': '{"auto-ride":[]}',
      },
    })
    expect(loadLearnerDataFromDisk(storePath)).toEqual(saved)
  })

  it('returns null for missing, corrupt, or incompatible learner data', () => {
    const storePath = path.join(tempDir, 'learner-data.json')

    expect(loadLearnerDataFromDisk(storePath)).toBeNull()

    fs.writeFileSync(storePath, '{ broken json')
    expect(loadLearnerDataFromDisk(storePath)).toBeNull()

    fs.writeFileSync(storePath, JSON.stringify({ schemaVersion: 99, values: {} }))
    expect(loadLearnerDataFromDisk(storePath)).toBeNull()
  })
})
