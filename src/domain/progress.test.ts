import { describe, expect, it } from 'vitest'
import {
  applyExerciseResult,
  createInitialProgress,
  getAdaptiveDifficulty,
  getAchievementSummaries,
  getDueReviewItems,
  getWeakSkillSummaries,
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

  it('summarizes weak skills and lowers adaptive difficulty when review pressure is high', () => {
    const progress = {
      ...createInitialProgress(),
      hearts: 2,
      xp: 36,
      weakAreas: {
        verbs: 3,
        listening: 1,
      },
      reviewQueue: {
        hogbeku: {
          vocabularyId: 'hogbeku',
          dueAt: now,
          strength: 0.2,
          attempts: 3,
        },
        'ticket-eshtu': {
          vocabularyId: 'ticket-eshtu',
          dueAt: '2026-05-30T09:00:00.000Z',
          strength: 0.8,
          attempts: 1,
        },
      },
    }

    expect(getWeakSkillSummaries(progress)).toEqual([
      { skillTag: 'verbs', label: 'Verbs', mistakes: 3, priority: 'high' },
      { skillTag: 'listening', label: 'Listening', mistakes: 1, priority: 'low' },
    ])
    expect(getAdaptiveDifficulty(progress, now)).toEqual({
      level: 'gentle',
      reason: '2 weak skills and 1 due review',
    })
  })

  it('summarizes unlocked achievements from learner progress', () => {
    const progress = {
      ...createInitialProgress(),
      xp: 92,
      streakDays: 7,
      completedExerciseIds: [
        'survival-translate-1',
        'survival-arrange-1',
        'survival-fill-1',
        'survival-listening-1',
        'survival-speaking-1',
        'survival-match-1',
        'story-first-day-bangalore',
      ],
      reviewQueue: {
        hogbeku: {
          vocabularyId: 'hogbeku',
          dueAt: '2026-05-25T09:00:00.000Z',
          strength: 0.85,
          attempts: 3,
        },
      },
    }

    expect(getAchievementSummaries(progress)).toEqual([
      expect.objectContaining({ code: 'first_word', unlocked: true, progressLabel: '7 activities' }),
      expect.objectContaining({ code: 'first_lesson', unlocked: true, progressLabel: '6/6 lesson exercises' }),
      expect.objectContaining({ code: 'voice_ready', unlocked: true }),
      expect.objectContaining({ code: 'story_starter', unlocked: true }),
      expect.objectContaining({ code: 'streak_7', unlocked: true, progressLabel: '7/7 streak days' }),
      expect.objectContaining({ code: 'review_pro', unlocked: true, progressLabel: '1 practiced word' }),
    ])
  })
})
