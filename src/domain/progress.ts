export interface ReviewItem {
  vocabularyId: string
  dueAt: string
  strength: number
  attempts: number
  leitnerBox: number
}

export interface LessonProgress {
  lessonId: string
  masteryLevel: number
  attempts: number
  lastCompletedAt: string
}

export interface ProgressState {
  xp: number
  dailyXp: number
  hearts: number
  gems: number
  streakDays: number
  lastPracticeDate: string | null
  completedExerciseIds: string[]
  weakAreas: Record<string, number>
  reviewQueue: Record<string, ReviewItem>
  lessonProgress: Record<string, LessonProgress>
  dailyQuestClaims: Record<string, string[]>
  streakFreezes: number
}

export interface ExerciseResult {
  exerciseId: string
  correct: boolean
  skillTag: string
  xp: number
  vocabularyIds: string[]
  now: string
}

export type WeakSkillPriority = 'low' | 'medium' | 'high'

export interface WeakSkillSummary {
  skillTag: string
  label: string
  mistakes: number
  priority: WeakSkillPriority
}

export type AdaptiveDifficultyLevel = 'gentle' | 'steady' | 'challenge'

export interface AdaptiveDifficulty {
  level: AdaptiveDifficultyLevel
  reason: string
}

export interface AchievementSummary {
  code: string
  name: string
  description: string
  unlocked: boolean
  progressLabel: string
}

export interface LessonProgressSummary {
  completed: boolean
  masteryLevel: number
  attempts: number
  lastCompletedAt: string | null
}

export interface DailyQuest {
  id: string
  title: string
  description: string
  current: number
  target: number
  rewardGems: number
  completed: boolean
  claimed: boolean
}

export function createInitialProgress(): ProgressState {
  return {
    xp: 0,
    dailyXp: 0,
    hearts: 5,
    gems: 120,
    streakDays: 0,
    lastPracticeDate: null,
    completedExerciseIds: [],
    weakAreas: {},
    reviewQueue: {},
    lessonProgress: {},
    dailyQuestClaims: {},
    streakFreezes: 0,
  }
}

export function applyExerciseResult(state: ProgressState, result: ExerciseResult): ProgressState {
  const practiceDate = result.now.slice(0, 10)
  const shouldStartOrContinueStreak = state.lastPracticeDate !== practiceDate
  const earnedXp = result.correct ? result.xp : 0
  const reviewQueue = { ...state.reviewQueue }

  for (const vocabularyId of result.vocabularyIds) {
    const previous = reviewQueue[vocabularyId]
    const previousBox = clampLeitnerBox(previous?.leitnerBox ?? inferLeitnerBox(previous?.strength))
    const leitnerBox = result.correct ? clampLeitnerBox(previousBox + 1) : 1
    const strength = leitnerBox / 5
    const dueAt = result.correct ? addDays(result.now, getLeitnerIntervalDays(leitnerBox)) : result.now
    reviewQueue[vocabularyId] = {
      vocabularyId,
      dueAt,
      strength,
      attempts: (previous?.attempts ?? 0) + 1,
      leitnerBox,
    }
  }

  return {
    ...state,
    xp: state.xp + earnedXp,
    dailyXp: state.dailyXp + earnedXp,
    hearts: result.correct ? state.hearts : Math.max(0, state.hearts - 1),
    streakDays: shouldStartOrContinueStreak ? Math.max(1, state.streakDays + 1) : state.streakDays,
    lastPracticeDate: practiceDate,
    completedExerciseIds: state.completedExerciseIds.includes(result.exerciseId)
      ? state.completedExerciseIds
      : [...state.completedExerciseIds, result.exerciseId],
    weakAreas: result.correct
      ? state.weakAreas
      : {
          ...state.weakAreas,
          [result.skillTag]: (state.weakAreas[result.skillTag] ?? 0) + 1,
        },
    reviewQueue,
  }
}

export function completeLessonProgress(
  state: ProgressState,
  lessonId: string,
  completedAt: string,
): ProgressState {
  const previous = state.lessonProgress[lessonId]
  const masteryLevel = Math.min(5, (previous?.masteryLevel ?? 0) + 1)

  return {
    ...state,
    gems: state.gems + (previous ? 5 : 15),
    lessonProgress: {
      ...state.lessonProgress,
      [lessonId]: {
        lessonId,
        masteryLevel,
        attempts: (previous?.attempts ?? 0) + 1,
        lastCompletedAt: completedAt,
      },
    },
  }
}

export function getLessonProgressSummary(
  state: ProgressState,
  lessonId: string,
): LessonProgressSummary {
  const progress = state.lessonProgress[lessonId]

  return {
    completed: Boolean(progress),
    masteryLevel: progress?.masteryLevel ?? 0,
    attempts: progress?.attempts ?? 0,
    lastCompletedAt: progress?.lastCompletedAt ?? null,
  }
}

export function getAchievementSummaries(state: ProgressState): AchievementSummary[] {
  const survivalExerciseCount = state.completedExerciseIds.filter((exerciseId) =>
    exerciseId.startsWith('survival-'),
  ).length
  const practicedWordCount = Object.keys(state.reviewQueue).length

  return [
    {
      code: 'first_word',
      name: 'First Word',
      description: 'Complete any Kannada activity.',
      unlocked: state.completedExerciseIds.length > 0,
      progressLabel: `${state.completedExerciseIds.length} ${state.completedExerciseIds.length === 1 ? 'activity' : 'activities'}`,
    },
    {
      code: 'first_lesson',
      name: 'Getting Started',
      description: 'Complete the six-exercise survival lesson.',
      unlocked: survivalExerciseCount >= 6,
      progressLabel: `${Math.min(6, survivalExerciseCount)}/6 lesson exercises`,
    },
    {
      code: 'voice_ready',
      name: 'Voice Ready',
      description: 'Finish a pronunciation exercise.',
      unlocked: state.completedExerciseIds.includes('survival-speaking-1'),
      progressLabel: state.completedExerciseIds.includes('survival-speaking-1') ? 'Pronunciation scored' : 'Pronunciation pending',
    },
    {
      code: 'story_starter',
      name: 'Story Starter',
      description: 'Complete your first Kannada story.',
      unlocked: state.completedExerciseIds.some((exerciseId) => exerciseId.startsWith('story-')),
      progressLabel: state.completedExerciseIds.some((exerciseId) => exerciseId.startsWith('story-')) ? '1 story complete' : 'No stories complete',
    },
    {
      code: 'streak_7',
      name: 'One Week',
      description: 'Build a seven-day learning streak.',
      unlocked: state.streakDays >= 7,
      progressLabel: `${Math.min(7, state.streakDays)}/7 streak days`,
    },
    {
      code: 'review_pro',
      name: 'Review Pro',
      description: 'Practice words enough to strengthen memory.',
      unlocked: Object.values(state.reviewQueue).some((item) => item.attempts >= 3 && item.strength >= 0.7),
      progressLabel: `${practicedWordCount} practiced ${practicedWordCount === 1 ? 'word' : 'words'}`,
    },
  ]
}

export function getDueReviewItems(state: ProgressState, now: string): string[] {
  const nowTime = new Date(now).getTime()
  return Object.values(state.reviewQueue)
    .filter((item) => new Date(item.dueAt).getTime() <= nowTime)
    .map((item) => item.vocabularyId)
    .sort()
}

export function getWeakSkillSummaries(state: ProgressState, limit = 3): WeakSkillSummary[] {
  return Object.entries(state.weakAreas)
    .filter(([, mistakes]) => mistakes > 0)
    .sort(([leftTag, leftMistakes], [rightTag, rightMistakes]) => {
      if (rightMistakes !== leftMistakes) {
        return rightMistakes - leftMistakes
      }
      return leftTag.localeCompare(rightTag)
    })
    .slice(0, limit)
    .map(([skillTag, mistakes]) => ({
      skillTag,
      label: formatSkillLabel(skillTag),
      mistakes,
      priority: getWeakSkillPriority(mistakes),
    }))
}

export function getAdaptiveDifficulty(state: ProgressState, now: string): AdaptiveDifficulty {
  const weakSkillCount = getWeakSkillSummaries(state).length
  const dueReviewCount = getDueReviewItems(state, now).length
  const highestMistakeCount = Math.max(0, ...Object.values(state.weakAreas))

  if (state.hearts <= 2 || dueReviewCount > 0 || highestMistakeCount >= 3) {
    return {
      level: 'gentle',
      reason: describePracticePressure(weakSkillCount, dueReviewCount),
    }
  }

  if (state.xp >= 80 && weakSkillCount === 0) {
    return {
      level: 'challenge',
      reason: 'Strong recent accuracy',
    }
  }

  return {
    level: 'steady',
    reason: weakSkillCount > 0 ? describePracticePressure(weakSkillCount, dueReviewCount) : 'Balanced practice',
  }
}

export function serializeProgress(state: ProgressState): string {
  return JSON.stringify(state)
}

export function hydrateProgress(serialized: string | null): ProgressState {
  if (!serialized) {
    return createInitialProgress()
  }

  try {
    const hydrated = { ...createInitialProgress(), ...JSON.parse(serialized) } as ProgressState
    hydrated.reviewQueue = hydrateReviewQueue(hydrated.reviewQueue)
    return hydrated
  } catch {
    return createInitialProgress()
  }
}

export function getDailyQuests(state: ProgressState, now: string): DailyQuest[] {
  const dateKey = now.slice(0, 10)
  const claimed = new Set(state.dailyQuestClaims[dateKey] ?? [])
  const completedToday = state.completedExerciseIds.length

  return [
    {
      id: 'daily-xp-10',
      title: 'Earn 10 XP',
      description: 'Hit the daily XP goal.',
      current: Math.min(10, state.dailyXp),
      target: 10,
      rewardGems: 10,
      completed: state.dailyXp >= 10,
      claimed: claimed.has('daily-xp-10'),
    },
    {
      id: 'daily-activities-3',
      title: 'Complete 3 activities',
      description: 'Finish any three lesson, story, or review activities.',
      current: Math.min(3, completedToday),
      target: 3,
      rewardGems: 15,
      completed: completedToday >= 3,
      claimed: claimed.has('daily-activities-3'),
    },
    {
      id: 'daily-perfect-lesson',
      title: 'Keep every heart',
      description: 'Finish a lesson while still holding all five hearts.',
      current: state.hearts >= 5 && state.dailyXp >= 18 ? 1 : 0,
      target: 1,
      rewardGems: 20,
      completed: state.hearts >= 5 && state.dailyXp >= 18,
      claimed: claimed.has('daily-perfect-lesson'),
    },
  ]
}

export function claimDailyQuestReward(state: ProgressState, quest: DailyQuest, now = '2026-05-27T00:00:00.000Z'): ProgressState {
  if (!quest.completed) {
    return state
  }

  const dateKey = now.slice(0, 10)
  const claimed = state.dailyQuestClaims[dateKey] ?? []

  if (claimed.includes(quest.id)) {
    return state
  }

  return {
    ...state,
    gems: state.gems + quest.rewardGems,
    dailyQuestClaims: {
      ...state.dailyQuestClaims,
      [dateKey]: [...claimed, quest.id],
    },
  }
}

export function refillHeartsWithGems(state: ProgressState, cost = 50): ProgressState {
  if (state.hearts >= 5 || state.gems < cost) {
    return state
  }

  return {
    ...state,
    hearts: 5,
    gems: state.gems - cost,
  }
}

export function buyStreakFreeze(state: ProgressState, cost = 100): ProgressState {
  if (state.gems < cost) {
    return state
  }

  return {
    ...state,
    gems: state.gems - cost,
    streakFreezes: state.streakFreezes + 1,
  }
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function getLeitnerIntervalDays(box: number): number {
  return [1, 3, 7, 14, 30][clampLeitnerBox(box) - 1]
}

function clampLeitnerBox(box: number): number {
  return Math.max(1, Math.min(5, Math.round(box)))
}

function inferLeitnerBox(strength: number | undefined): number {
  if (typeof strength !== 'number') {
    return 1
  }

  return clampLeitnerBox(Math.ceil(strength * 5))
}

function hydrateReviewQueue(reviewQueue: ProgressState['reviewQueue']): ProgressState['reviewQueue'] {
  return Object.fromEntries(
    Object.entries(reviewQueue).map(([vocabularyId, item]) => {
      const leitnerBox = clampLeitnerBox(item.leitnerBox ?? inferLeitnerBox(item.strength))
      return [
        vocabularyId,
        {
          ...item,
          vocabularyId: item.vocabularyId ?? vocabularyId,
          leitnerBox,
          strength: item.strength ?? leitnerBox / 5,
        },
      ]
    }),
  )
}

function getWeakSkillPriority(mistakes: number): WeakSkillPriority {
  if (mistakes >= 3) {
    return 'high'
  }

  if (mistakes >= 2) {
    return 'medium'
  }

  return 'low'
}

function formatSkillLabel(skillTag: string): string {
  return skillTag
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function describePracticePressure(weakSkillCount: number, dueReviewCount: number): string {
  const parts: string[] = []

  if (weakSkillCount > 0) {
    parts.push(`${weakSkillCount} weak ${weakSkillCount === 1 ? 'skill' : 'skills'}`)
  }

  if (dueReviewCount > 0) {
    parts.push(`${dueReviewCount} due ${dueReviewCount === 1 ? 'review' : 'reviews'}`)
  }

  return parts.length ? parts.join(' and ') : 'Low confidence practice'
}
