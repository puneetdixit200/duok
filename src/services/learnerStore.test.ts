import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyLearnerStorage,
  collectLearnerStorage,
  hydrateLearnerData,
  type LearnerDataPayload,
} from './learnerStore'

describe('renderer learner storage repository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('collects only durable KannadaOS learner domains from browser storage', () => {
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', '{"xp":42}')
    localStorage.setItem('kannadaos:conversation-log', '{"auto-ride":[]}')
    localStorage.setItem('foreign:key', 'ignore me')

    expect(collectLearnerStorage(localStorage)).toEqual({
      'kannadaos:onboarded': 'true',
      'kannadaos:progress': '{"xp":42}',
      'kannadaos:conversation-log': '{"auto-ride":[]}',
    })
  })

  it('applies compatible desktop learner data to browser storage', () => {
    const payload: LearnerDataPayload = {
      schemaVersion: 1,
      appName: 'KannadaOS',
      savedAt: '2026-05-23T18:30:00.000Z',
      values: {
        'kannadaos:onboarded': 'true',
        'kannadaos:progress': '{"xp":42}',
        'foreign:key': 'ignore me',
      },
    }

    expect(applyLearnerStorage(payload, localStorage)).toBe(true)
    expect(localStorage.getItem('kannadaos:onboarded')).toBe('true')
    expect(localStorage.getItem('kannadaos:progress')).toBe('{"xp":42}')
    expect(localStorage.getItem('foreign:key')).toBeNull()
  })

  it('rejects incompatible or malformed desktop learner data', () => {
    expect(hydrateLearnerData(null)).toBeNull()
    expect(hydrateLearnerData({ schemaVersion: 2, appName: 'KannadaOS', savedAt: '', values: {} })).toBeNull()
    expect(hydrateLearnerData({ schemaVersion: 1, appName: 'KannadaOS', savedAt: '', values: [] })).toBeNull()
  })
})
