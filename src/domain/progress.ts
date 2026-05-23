export interface ReviewItem {
  vocabularyId: string
  dueAt: string
  strength: number
  attempts: number
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
  }
}

export function applyExerciseResult(state: ProgressState, result: ExerciseResult): ProgressState {
  const practiceDate = result.now.slice(0, 10)
  const shouldStartOrContinueStreak = state.lastPracticeDate !== practiceDate
  const earnedXp = result.correct ? result.xp : 0
  const reviewQueue = { ...state.reviewQueue }

  for (const vocabularyId of result.vocabularyIds) {
    const previous = reviewQueue[vocabularyId]
    const previousStrength = previous?.strength ?? 0.5
    const strength = result.correct
      ? Math.min(1, previousStrength + 0.2)
      : Math.max(0.1, previousStrength - 0.25)
    const dueAt = result.correct ? addDays(result.now, 2) : result.now
    reviewQueue[vocabularyId] = {
      vocabularyId,
      dueAt,
      strength,
      attempts: (previous?.attempts ?? 0) + 1,
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
    return { ...createInitialProgress(), ...JSON.parse(serialized) }
  } catch {
    return createInitialProgress()
  }
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
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
