import { describe, expect, it } from 'vitest'
import {
  applyExerciseResult,
  buyStreakFreeze,
  claimDailyQuestReward,
  completeLessonProgress,
  createInitialProgress,
  getAdaptiveDifficulty,
  getAchievementSummaries,
  getDailyQuests,
  getDueReviewItems,
  getLessonProgressSummary,
  getWeakSkillSummaries,
  hydrateProgress,
  rateReviewItem,
  recordChatMessageSent,
  recordPracticeActivity,
  refillHeartsWithGems,
  serializeProgress,
  toggleScenarioChecklistItem,
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
    expect(progress.todayActivityIds).toEqual(['survival-translate-1'])
    expect(progress.completedExerciseIds).toContain('survival-translate-1')
    expect(progress.reviewQueue['namaskara-saar'].leitnerBox).toBe(2)
    expect(progress.reviewQueue['namaskara-saar'].strength).toBe(0.4)
  })

  it('resets daily XP and activity counts when practice moves to a new day', () => {
    const firstDay = applyExerciseResult(createInitialProgress(), {
      exerciseId: 'survival-translate-1',
      correct: true,
      skillTag: 'greetings',
      xp: 2,
      vocabularyIds: ['namaskara-saar'],
      now: '2026-05-23T09:00:00.000Z',
    })
    const nextDay = applyExerciseResult(firstDay, {
      exerciseId: 'survival-arrange-1',
      correct: true,
      skillTag: 'greetings',
      xp: 3,
      vocabularyIds: ['namaskara-saar'],
      now: '2026-05-24T09:00:00.000Z',
    })

    expect(nextDay.dailyXp).toBe(3)
    expect(nextDay.todayActivityIds).toEqual(['survival-arrange-1'])
    expect(nextDay.completedExerciseIds).toEqual(['survival-translate-1', 'survival-arrange-1'])
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
    expect(progress.lastHeartLostAt).toBe(now)
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
    expect(getDueReviewItems(restored, '2026-05-26T09:00:00.000Z')).toEqual(['ticket-eshtu'])
  })

  it('regenerates one heart every four hours when persisted progress is restored', () => {
    const progress = {
      ...createInitialProgress(),
      hearts: 1,
      lastHeartLostAt: '2026-05-27T00:00:00.000Z',
    }

    const restored = hydrateProgress(serializeProgress(progress), '2026-05-27T09:30:00.000Z')

    expect(restored.hearts).toBe(3)
    expect(restored.lastHeartLostAt).toBe('2026-05-27T08:00:00.000Z')

    const full = hydrateProgress(serializeProgress({ ...progress, hearts: 4 }), '2026-05-27T04:30:00.000Z')
    expect(full.hearts).toBe(5)
    expect(full.lastHeartLostAt).toBeNull()
  })

  it('uses Leitner boxes for spaced repetition scheduling', () => {
    const firstCorrect = applyExerciseResult(createInitialProgress(), {
      exerciseId: 'prices-translate-1',
      correct: true,
      skillTag: 'prices',
      xp: 2,
      vocabularyIds: ['eshtu'],
      now,
    })

    expect(firstCorrect.reviewQueue.eshtu.leitnerBox).toBe(2)
    expect(firstCorrect.reviewQueue.eshtu.dueAt).toBe('2026-05-26T09:00:00.000Z')

    const secondCorrect = applyExerciseResult(firstCorrect, {
      exerciseId: 'prices-listening-1',
      correct: true,
      skillTag: 'prices',
      xp: 3,
      vocabularyIds: ['eshtu'],
      now: '2026-05-26T09:00:00.000Z',
    })

    expect(secondCorrect.reviewQueue.eshtu.leitnerBox).toBe(3)
    expect(secondCorrect.reviewQueue.eshtu.dueAt).toBe('2026-06-02T09:00:00.000Z')

    const wrong = applyExerciseResult(secondCorrect, {
      exerciseId: 'prices-type-1',
      correct: false,
      skillTag: 'prices',
      xp: 4,
      vocabularyIds: ['eshtu'],
      now: '2026-06-02T09:00:00.000Z',
    })

    expect(wrong.reviewQueue.eshtu.leitnerBox).toBe(1)
    expect(wrong.reviewQueue.eshtu.dueAt).toBe('2026-06-02T09:00:00.000Z')
  })

  it('updates Leitner boxes from Hard, Okay, and Easy flashcard ratings', () => {
    const initial = applyExerciseResult(createInitialProgress(), {
      exerciseId: 'prices-translate-1',
      correct: true,
      skillTag: 'prices',
      xp: 2,
      vocabularyIds: ['eshtu'],
      now,
    })

    const hard = rateReviewItem(initial, 'eshtu', 'hard', '2026-05-26T09:00:00.000Z')
    expect(hard.reviewQueue.eshtu.leitnerBox).toBe(1)
    expect(hard.reviewQueue.eshtu.dueAt).toBe('2026-05-26T09:00:00.000Z')

    const okay = rateReviewItem(hard, 'eshtu', 'okay', '2026-05-26T09:30:00.000Z')
    expect(okay.reviewQueue.eshtu.leitnerBox).toBe(1)
    expect(okay.reviewQueue.eshtu.dueAt).toBe('2026-05-27T09:30:00.000Z')

    const easy = rateReviewItem(okay, 'eshtu', 'easy', '2026-05-29T09:30:00.000Z')
    expect(easy.reviewQueue.eshtu.leitnerBox).toBe(2)
    expect(easy.reviewQueue.eshtu.dueAt).toBe('2026-06-01T09:30:00.000Z')
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
    const scriptLessonProgress = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [
        `script-lesson-${index + 1}`,
        {
          lessonId: `script-lesson-${index + 1}`,
          masteryLevel: 1,
          attempts: 1,
          perfectCompletions: 0,
          lastCompletedAt: '2026-05-23T10:00:00.000Z',
        },
      ]),
    )
    const masteredUnitProgress = Object.fromEntries(
      Array.from({ length: 5 }, (_, index) => [
        `unit-1-greetings-lesson-${index + 1}`,
        {
          lessonId: `unit-1-greetings-lesson-${index + 1}`,
          masteryLevel: 5,
          attempts: 5,
          perfectCompletions: index === 0 ? 1 : 0,
          lastCompletedAt: '2026-05-23T10:00:00.000Z',
        },
      ]),
    )
    const progress = {
      ...createInitialProgress(),
      xp: 92,
      streakDays: 30,
      chatMessagesSent: 100,
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
      lessonProgress: {
        ...scriptLessonProgress,
        ...masteredUnitProgress,
      },
      scenarioChecklist: {
        'bmtc-bus': ['Ask the fare'],
        'auto-ride': ['Say destination'],
        darshini: ['Order food'],
        kirana: ['Ask price'],
        office: ['Greet coworker'],
        'pg-owner': ['Explain issue'],
      },
    }

    expect(getAchievementSummaries(progress)).toEqual([
      expect.objectContaining({ code: 'first_word', unlocked: true, progressLabel: '7 activities' }),
      expect.objectContaining({ code: 'first_lesson', unlocked: true, progressLabel: '6/6 lesson exercises' }),
      expect.objectContaining({ code: 'voice_ready', unlocked: true }),
      expect.objectContaining({ code: 'story_starter', unlocked: true, progressLabel: '1 story complete' }),
      expect.objectContaining({ code: 'streak_7', unlocked: true, progressLabel: '7/7 streak days' }),
      expect.objectContaining({ code: 'review_pro', unlocked: true, progressLabel: '1 practiced word' }),
      expect.objectContaining({ code: 'script_reader', unlocked: true, progressLabel: '9/9 script lessons' }),
      expect.objectContaining({ code: 'bangalore_pro', unlocked: true, progressLabel: '6/6 scenarios' }),
      expect.objectContaining({ code: 'chat_master', unlocked: true, progressLabel: '100/100 messages' }),
      expect.objectContaining({ code: 'streak_30', unlocked: true, progressLabel: '30/30 streak days' }),
      expect.objectContaining({ code: 'unit_champion', unlocked: true, progressLabel: '1 unit mastered' }),
      expect.objectContaining({ code: 'perfect_lesson', unlocked: true, progressLabel: '1 perfect lesson' }),
    ])
  })

  it('tracks lesson mastery crowns independently from exercise attempts', () => {
    const firstCompletion = completeLessonProgress(
      createInitialProgress(),
      'unit-1-greetings-lesson-1',
      '2026-05-27T10:00:00.000Z',
    )
    const secondCompletion = completeLessonProgress(
      firstCompletion,
      'unit-1-greetings-lesson-1',
      '2026-05-28T10:00:00.000Z',
    )

    const perfectCompletion = completeLessonProgress(
      secondCompletion,
      'unit-1-greetings-lesson-1',
      '2026-05-29T10:00:00.000Z',
      true,
    )

    expect(getLessonProgressSummary(perfectCompletion, 'unit-1-greetings-lesson-1')).toEqual({
      completed: true,
      masteryLevel: 3,
      attempts: 3,
      perfectCompletions: 1,
      lastCompletedAt: '2026-05-29T10:00:00.000Z',
    })
  })

  it('adds lesson duration to total practice time when a lesson is completed', () => {
    const progress = completeLessonProgress(
      createInitialProgress(),
      'unit-1-greetings-lesson-1',
      '2026-05-27T10:00:00.000Z',
      false,
      204_000,
    )

    expect(progress.totalPracticeTimeMs).toBe(204_000)
  })

  it('tracks chat message count and Bangalore scenario checklist completions', () => {
    const afterChat = recordChatMessageSent(createInitialProgress())
    const checked = toggleScenarioChecklistItem(afterChat, 'bmtc-bus', 'Ask the fare')
    const unchecked = toggleScenarioChecklistItem(checked, 'bmtc-bus', 'Ask the fare')

    expect(afterChat.chatMessagesSent).toBe(1)
    expect(checked.scenarioChecklist['bmtc-bus']).toEqual(['Ask the fare'])
    expect(unchecked.scenarioChecklist['bmtc-bus']).toEqual([])
  })

  it('supports daily quests plus gem economy actions for hearts and streak freezes', () => {
    const progress = {
      ...createInitialProgress(),
      dailyXp: 18,
      hearts: 1,
      gems: 160,
      completedExerciseIds: ['survival-translate-1', 'survival-arrange-1', 'survival-fill-1'],
      todayActivityIds: ['survival-translate-1', 'survival-arrange-1', 'survival-fill-1'],
    }
    const quests = getDailyQuests(progress, '2026-05-27T10:00:00.000Z', 20)

    expect(quests).toEqual([
      expect.objectContaining({ id: 'daily-xp-20', title: 'Earn 20 XP', current: 18, target: 20, completed: false, rewardGems: 10 }),
      expect.objectContaining({ id: 'daily-activities-3', completed: true, rewardGems: 15 }),
      expect.objectContaining({ id: 'daily-perfect-lesson', completed: false, rewardGems: 20 }),
    ])

    const rewarded = claimDailyQuestReward(progress, quests[1])
    expect(rewarded.gems).toBe(175)
    expect(rewarded.dailyQuestClaims['2026-05-27']).toContain('daily-activities-3')
    expect(claimDailyQuestReward(rewarded, quests[1]).gems).toBe(175)

    const refilled = refillHeartsWithGems(rewarded)
    expect(refilled.hearts).toBe(5)
    expect(refilled.gems).toBe(125)

    const protectedStreak = buyStreakFreeze(refilled)
    expect(protectedStreak.streakFreezes).toBe(1)
    expect(protectedStreak.gems).toBe(25)
  })

  it('restores a heart when three new practice activities are completed', () => {
    const progress = {
      ...createInitialProgress(),
      hearts: 1,
      lastHeartLostAt: '2026-05-27T06:00:00.000Z',
      lastPracticeDate: '2026-05-27',
      todayActivityIds: ['review-dhanyavada', 'review-hogbeku'],
      completedExerciseIds: ['review-dhanyavada', 'review-hogbeku'],
    }

    const restored = recordPracticeActivity(progress, {
      activityId: 'review-namaskara-saar',
      xp: 1,
      now: '2026-05-27T07:00:00.000Z',
    })

    expect(restored.hearts).toBe(2)
    expect(restored.lastHeartLostAt).toBe('2026-05-27T06:00:00.000Z')
    expect(restored.dailyXp).toBe(1)
    expect(restored.todayActivityIds).toEqual(['review-dhanyavada', 'review-hogbeku', 'review-namaskara-saar'])

    const duplicate = recordPracticeActivity(restored, {
      activityId: 'review-namaskara-saar',
      xp: 1,
      now: '2026-05-27T07:05:00.000Z',
    })

    expect(duplicate.hearts).toBe(2)
    expect(duplicate.todayActivityIds).toEqual(restored.todayActivityIds)
  })
})
