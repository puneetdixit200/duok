import { describe, expect, it } from 'vitest'
import {
  applyExerciseResult,
  createInitialProgress,
  getDueReviewItems,
  hydrateProgress,
  serializeProgress,
} from './progress'

const now = '2026-05-23T09:00:00.000Z'

describe('learner progress', () => {
  it('awards XP, keeps hearts, advances lesson progress, and starts a streak for a correct answer', () => {
    const progress = applyExerciseResult(createInitialProgress(), {
      exerciseId: 'survival-translate-1',
      correct: true,
      skillTag: 'greetings',
      xp: 2,
      vocabularyIds: ['namaskara-saar'],
      now,
    })

    expect(progress.xp).toBe(2)
    expect(progress.hearts).toBe(5)
    expect(progress.streakDays).toBe(1)
    expect(progress.dailyXp).toBe(2)
    expect(progress.completedExerciseIds).toContain('survival-translate-1')
    expect(progress.reviewQueue['namaskara-saar'].strength).toBeGreaterThan(0.5)
  })

  it('tracks weak areas, removes a heart, and schedules review for incorrect answers', () => {
    const progress = applyExerciseResult(createInitialProgress(), {
      exerciseId: 'survival-fill-1',
      correct: false,
      skillTag: 'verbs',
      xp: 2,
      vocabularyIds: ['hogbeku'],
      now,
    })

    expect(progress.xp).toBe(0)
    expect(progress.hearts).toBe(4)
    expect(progress.weakAreas.verbs).toBe(1)
    expect(getDueReviewItems(progress, now)).toEqual(['hogbeku'])
  })

  it('round-trips through persistence without losing review queue dates', () => {
    const progress = applyExerciseResult(createInitialProgress(), {
      exerciseId: 'survival-listening-1',
      correct: true,
      skillTag: 'listening',
      xp: 3,
      vocabularyIds: ['ticket-eshtu'],
      now,
    })

    const restored = hydrateProgress(serializeProgress(progress))

    expect(restored).toEqual(progress)
    expect(getDueReviewItems(restored, '2026-05-25T09:00:00.000Z')).toEqual(['ticket-eshtu'])
  })
})
