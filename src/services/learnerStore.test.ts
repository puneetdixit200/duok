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
    localStorage.setItem('kannadaos:learner-profile', '{"dailyGoalXp":20}')
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":false,"autoPlayAudio":true}')
    localStorage.setItem('kannadaos:progress', '{"xp":42}')
    localStorage.setItem('kannadaos:conversation-log', '{"auto-ride":[]}')
    localStorage.setItem('kannadaos:ai-expansion', '[{"prompt":"AI commute drill"}]')
    localStorage.setItem('foreign:key', 'ignore me')

    expect(collectLearnerStorage(localStorage)).toEqual({
      'kannadaos:onboarded': 'true',
      'kannadaos:learner-profile': '{"dailyGoalXp":20}',
      'kannadaos:sound-prefs': '{"soundEffects":false,"autoPlayAudio":true}',
      'kannadaos:progress': '{"xp":42}',
      'kannadaos:conversation-log': '{"auto-ride":[]}',
      'kannadaos:ai-expansion': '[{"prompt":"AI commute drill"}]',
    })
  })

  it('applies compatible desktop learner data to browser storage', () => {
    const payload: LearnerDataPayload = {
      schemaVersion: 1,
      appName: 'KannadaOS',
      savedAt: '2026-05-23T18:30:00.000Z',
      values: {
        'kannadaos:onboarded': 'true',
        'kannadaos:learner-profile': '{"dailyGoalXp":20}',
        'kannadaos:sound-prefs': '{"soundEffects":false,"autoPlayAudio":true}',
        'kannadaos:progress': '{"xp":42}',
        'kannadaos:ai-expansion': '[{"prompt":"AI commute drill"}]',
        'foreign:key': 'ignore me',
      },
    }

    expect(applyLearnerStorage(payload, localStorage)).toBe(true)
    expect(localStorage.getItem('kannadaos:onboarded')).toBe('true')
    expect(localStorage.getItem('kannadaos:learner-profile')).toBe('{"dailyGoalXp":20}')
    expect(localStorage.getItem('kannadaos:sound-prefs')).toBe('{"soundEffects":false,"autoPlayAudio":true}')
    expect(localStorage.getItem('kannadaos:progress')).toBe('{"xp":42}')
    expect(localStorage.getItem('kannadaos:ai-expansion')).toBe('[{"prompt":"AI commute drill"}]')
    expect(localStorage.getItem('foreign:key')).toBeNull()
  })

  it('rejects incompatible or malformed desktop learner data', () => {
    expect(hydrateLearnerData(null)).toBeNull()
    expect(hydrateLearnerData({ schemaVersion: 2, appName: 'KannadaOS', savedAt: '', values: {} })).toBeNull()
    expect(hydrateLearnerData({ schemaVersion: 1, appName: 'KannadaOS', savedAt: '', values: [] })).toBeNull()
  })
})
