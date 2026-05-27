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
  perfectCompletions: number
  lastCompletedAt: string
}

export interface ProgressState {
  xp: number
  dailyXp: number
  hearts: number
  gems: number
  streakDays: number
  lastPracticeDate: string | null
  lastHeartLostAt: string | null
  completedExerciseIds: string[]
  todayActivityIds: string[]
  completedStoryIds: string[]
  unlockedStoryIds: string[]
  weakAreas: Record<string, number>
  reviewQueue: Record<string, ReviewItem>
  lessonProgress: Record<string, LessonProgress>
  dailyQuestClaims: Record<string, string[]>
  scenarioChecklist: Record<string, string[]>
  totalPracticeTimeMs: number
  chatMessagesSent: number
  streakFreezes: number
  achievementRewardIds: string[]
}

export interface ExerciseResult {
  exerciseId: string
  correct: boolean
  skillTag: string
  xp: number
  vocabularyIds: string[]
  now: string
}

export interface PracticeActivityResult {
  activityId: string
  xp: number
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
export type ReviewRating = 'hard' | 'okay' | 'easy'

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
  perfectCompletions: number
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

export const maxHearts = 5
export const heartRegenerationIntervalMs = 4 * 60 * 60 * 1000
const practiceHeartRefillThreshold = 3
export const bangaloreScenarioChecklistXp = 10
export const bonusStoryUnlockCost = 75
const achievementGemReward = 25
const streakMilestones = [
  { days: 7, gems: 50 },
  { days: 30, gems: 200 },
] as const

export function createInitialProgress(): ProgressState {
  return {
    xp: 0,
    dailyXp: 0,
    hearts: 5,
    gems: 120,
    streakDays: 0,
    lastPracticeDate: null,
    lastHeartLostAt: null,
    completedExerciseIds: [],
    todayActivityIds: [],
    completedStoryIds: [],
    unlockedStoryIds: [],
    weakAreas: {},
    reviewQueue: {},
    lessonProgress: {},
    dailyQuestClaims: {},
    scenarioChecklist: {},
    totalPracticeTimeMs: 0,
    chatMessagesSent: 0,
    streakFreezes: 0,
    achievementRewardIds: [],
  }
}

export function applyExerciseResult(state: ProgressState, result: ExerciseResult): ProgressState {
  const practiceDate = result.now.slice(0, 10)
  const isSamePracticeDate = state.lastPracticeDate === practiceDate
  const earnedXp = result.correct ? result.xp : 0
  const baseDailyXp = isSamePracticeDate ? state.dailyXp : 0
  const baseTodayActivityIds = isSamePracticeDate ? state.todayActivityIds : []
  const streakUpdate = getPracticeStreakUpdate(state, result.now)
  const streakRewards = getNewStreakMilestoneRewards(state.completedExerciseIds, streakUpdate.streakDays)
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

  const nextState: ProgressState = {
    ...state,
    xp: state.xp + earnedXp,
    dailyXp: baseDailyXp + earnedXp,
    gems: state.gems + streakRewards.gems,
    hearts: result.correct ? state.hearts : Math.max(0, state.hearts - 1),
    lastHeartLostAt: result.correct ? state.lastHeartLostAt : result.now,
    streakDays: streakUpdate.streakDays,
    lastPracticeDate: streakUpdate.lastPracticeDate,
    streakFreezes: streakUpdate.streakFreezes,
    completedExerciseIds: state.completedExerciseIds.includes(result.exerciseId)
      ? [...state.completedExerciseIds, ...streakRewards.activityIds]
      : [...state.completedExerciseIds, result.exerciseId, ...streakRewards.activityIds],
    todayActivityIds: baseTodayActivityIds.includes(result.exerciseId)
      ? baseTodayActivityIds
      : [...baseTodayActivityIds, result.exerciseId],
    completedStoryIds: result.exerciseId.startsWith('story-') && !state.completedStoryIds.includes(result.exerciseId.slice(6))
      ? [...state.completedStoryIds, result.exerciseId.slice(6)]
      : state.completedStoryIds,
    weakAreas: result.correct
      ? state.weakAreas
      : {
          ...state.weakAreas,
          [result.skillTag]: (state.weakAreas[result.skillTag] ?? 0) + 1,
        },
    reviewQueue,
  }

  return awardNewAchievementRewards(state, nextState)
}

export function completeLessonProgress(
  state: ProgressState,
  lessonId: string,
  completedAt: string,
  perfect = false,
  durationMs = 0,
): ProgressState {
  const previous = state.lessonProgress[lessonId]
  const previousMasteryLevel = previous?.masteryLevel ?? 0
  const masteryLevel = Math.min(5, previousMasteryLevel + 1)
  const crownGemReward = getCrownGemReward(previousMasteryLevel, masteryLevel)

  const nextState: ProgressState = {
    ...state,
    gems: state.gems + crownGemReward,
    totalPracticeTimeMs: state.totalPracticeTimeMs + Math.max(0, Math.round(durationMs)),
    lessonProgress: {
      ...state.lessonProgress,
      [lessonId]: {
        lessonId,
        masteryLevel,
        attempts: (previous?.attempts ?? 0) + 1,
        perfectCompletions: (previous?.perfectCompletions ?? 0) + (perfect ? 1 : 0),
        lastCompletedAt: completedAt,
      },
    },
  }

  return awardNewAchievementRewards(state, nextState)
}

function getCrownGemReward(previousMasteryLevel: number, masteryLevel: number): number {
  if (masteryLevel <= previousMasteryLevel) {
    return 0
  }

  if (masteryLevel === 1 || masteryLevel === 5) {
    return 15
  }

  return 5
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
    perfectCompletions: progress?.perfectCompletions ?? 0,
    lastCompletedAt: progress?.lastCompletedAt ?? null,
  }
}

export function getAchievementSummaries(state: ProgressState): AchievementSummary[] {
  const survivalExerciseCount = state.completedExerciseIds.filter((exerciseId) =>
    exerciseId.startsWith('survival-'),
  ).length
  const practicedWordCount = Object.keys(state.reviewQueue).length
  const storyCount = countCompletedStories(state)
  const scriptLessonCount = countCompletedScriptLessons(state)
  const practicedScenarioCount = Object.values(state.scenarioChecklist).filter((items) => items.length > 0).length
  const chatMessageCount = state.chatMessagesSent
  const masteredUnitCount = countMasteredUnits(state)
  const perfectLessonCount = Object.values(state.lessonProgress).filter((lesson) => lesson.perfectCompletions > 0).length

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
      unlocked: storyCount > 0,
      progressLabel: storyCount > 0
        ? `${storyCount} ${storyCount === 1 ? 'story' : 'stories'} complete`
        : 'No stories complete',
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
    {
      code: 'script_reader',
      name: 'Script Reader',
      description: 'Complete all nine Kannada Script Academy lessons.',
      unlocked: scriptLessonCount >= 9,
      progressLabel: `${Math.min(9, scriptLessonCount)}/9 script lessons`,
    },
    {
      code: 'bangalore_pro',
      name: 'Bangalore Pro',
      description: 'Practice every Bangalore Mode scenario.',
      unlocked: practicedScenarioCount >= 6,
      progressLabel: `${Math.min(6, practicedScenarioCount)}/6 scenarios`,
    },
    {
      code: 'chat_master',
      name: 'Chat Master',
      description: 'Send 100 messages to the Kannada tutor.',
      unlocked: chatMessageCount >= 100,
      progressLabel: `${Math.min(100, chatMessageCount)}/100 messages`,
    },
    {
      code: 'streak_30',
      name: '30 Day Streak',
      description: 'Build a thirty-day learning streak.',
      unlocked: state.streakDays >= 30,
      progressLabel: `${Math.min(30, state.streakDays)}/30 streak days`,
    },
    {
      code: 'unit_champion',
      name: 'Unit Champion',
      description: 'Master every lesson in any unit to crown level five.',
      unlocked: masteredUnitCount > 0,
      progressLabel: `${masteredUnitCount} ${masteredUnitCount === 1 ? 'unit' : 'units'} mastered`,
    },
    {
      code: 'perfect_lesson',
      name: 'Perfect Lesson',
      description: 'Complete a lesson without mistakes.',
      unlocked: perfectLessonCount > 0,
      progressLabel: `${perfectLessonCount} perfect ${perfectLessonCount === 1 ? 'lesson' : 'lessons'}`,
    },
  ]
}

function countCompletedStories(state: ProgressState): number {
  const storyIds = new Set(state.completedStoryIds)

  for (const exerciseId of state.completedExerciseIds) {
    if (exerciseId.startsWith('story-')) {
      storyIds.add(exerciseId.slice('story-'.length))
    }
  }

  return storyIds.size
}

function countCompletedScriptLessons(state: ProgressState): number {
  return Object.values(state.lessonProgress).filter((lesson) => lesson.lessonId.startsWith('script-')).length
}

function countMasteredUnits(state: ProgressState): number {
  const masteredLessonsByUnit = new Map<string, Set<string>>()

  for (const lesson of Object.values(state.lessonProgress)) {
    if (lesson.lessonId.startsWith('script-') || lesson.masteryLevel < 5) {
      continue
    }

    const [unitId] = lesson.lessonId.split('-lesson-')
    if (!unitId || unitId === lesson.lessonId) {
      continue
    }

    const masteredLessons = masteredLessonsByUnit.get(unitId) ?? new Set<string>()
    masteredLessons.add(lesson.lessonId)
    masteredLessonsByUnit.set(unitId, masteredLessons)
  }

  return Array.from(masteredLessonsByUnit.values()).filter((lessonIds) => lessonIds.size >= 5).length
}

export function getDueReviewItems(state: ProgressState, now: string): string[] {
  const nowTime = new Date(now).getTime()
  return Object.values(state.reviewQueue)
    .filter((item) => new Date(item.dueAt).getTime() <= nowTime)
    .map((item) => item.vocabularyId)
    .sort()
}

export function rateReviewItem(
  state: ProgressState,
  vocabularyId: string,
  rating: ReviewRating,
  now: string,
): ProgressState {
  const previous = state.reviewQueue[vocabularyId]
  const previousBox = clampLeitnerBox(previous?.leitnerBox ?? inferLeitnerBox(previous?.strength))
  const leitnerBox =
    rating === 'hard'
      ? Math.max(1, previousBox - 1)
      : rating === 'easy'
        ? clampLeitnerBox(previousBox + 1)
        : previousBox
  const dueAt = rating === 'hard' ? now : addDays(now, getLeitnerIntervalDays(leitnerBox))

  const nextState: ProgressState = {
    ...state,
    reviewQueue: {
      ...state.reviewQueue,
      [vocabularyId]: {
        vocabularyId,
        dueAt,
        strength: leitnerBox / 5,
        attempts: (previous?.attempts ?? 0) + 1,
        leitnerBox,
      },
    },
  }

  return awardNewAchievementRewards(state, nextState)
}

export function recordPracticeActivity(state: ProgressState, result: PracticeActivityResult): ProgressState {
  const practiceDate = result.now.slice(0, 10)
  const isSamePracticeDate = state.lastPracticeDate === practiceDate
  const baseDailyXp = isSamePracticeDate ? state.dailyXp : 0
  const baseTodayActivityIds = isSamePracticeDate ? state.todayActivityIds : []
  const alreadyCompletedToday = baseTodayActivityIds.includes(result.activityId)
  const todayActivityIds = alreadyCompletedToday ? baseTodayActivityIds : [...baseTodayActivityIds, result.activityId]
  const shouldRestoreHeart =
    !alreadyCompletedToday &&
    state.hearts < maxHearts &&
    Math.floor(baseTodayActivityIds.length / practiceHeartRefillThreshold) <
      Math.floor(todayActivityIds.length / practiceHeartRefillThreshold)
  const hearts = shouldRestoreHeart ? Math.min(maxHearts, state.hearts + 1) : state.hearts
  const streakUpdate = getPracticeStreakUpdate(state, result.now)
  const streakRewards = getNewStreakMilestoneRewards(state.completedExerciseIds, streakUpdate.streakDays)

  const nextState: ProgressState = {
    ...state,
    xp: state.xp + result.xp,
    dailyXp: baseDailyXp + result.xp,
    gems: state.gems + streakRewards.gems,
    hearts,
    lastHeartLostAt: hearts >= maxHearts ? null : state.lastHeartLostAt,
    streakDays: streakUpdate.streakDays,
    lastPracticeDate: streakUpdate.lastPracticeDate,
    streakFreezes: streakUpdate.streakFreezes,
    completedExerciseIds: state.completedExerciseIds.includes(result.activityId)
      ? [...state.completedExerciseIds, ...streakRewards.activityIds]
      : [...state.completedExerciseIds, result.activityId, ...streakRewards.activityIds],
    todayActivityIds,
  }

  return awardNewAchievementRewards(state, nextState)
}

export function recordChatMessageSent(state: ProgressState): ProgressState {
  const nextState: ProgressState = {
    ...state,
    chatMessagesSent: state.chatMessagesSent + 1,
  }

  return awardNewAchievementRewards(state, nextState)
}

export function toggleScenarioChecklistItem(
  state: ProgressState,
  scenarioId: string,
  item: string,
  scenarioItems: string[] = [],
  now = '2026-05-27T00:00:00.000Z',
): ProgressState {
  const completedItems = state.scenarioChecklist[scenarioId] ?? []
  const nextItems = completedItems.includes(item)
    ? completedItems.filter((completedItem) => completedItem !== item)
    : [...completedItems, item]
  const activityId = getScenarioChecklistActivityId(scenarioId)
  const wasComplete = isScenarioChecklistComplete(completedItems, scenarioItems)
  const isComplete = isScenarioChecklistComplete(nextItems, scenarioItems)
  const shouldAwardXp =
    isComplete &&
    !wasComplete &&
    !state.completedExerciseIds.includes(activityId)

  if (!shouldAwardXp) {
    const nextState: ProgressState = {
      ...state,
      scenarioChecklist: {
        ...state.scenarioChecklist,
        [scenarioId]: nextItems,
      },
    }

    return awardNewAchievementRewards(state, nextState)
  }

  const practiceDate = now.slice(0, 10)
  const isSamePracticeDate = state.lastPracticeDate === practiceDate
  const baseDailyXp = isSamePracticeDate ? state.dailyXp : 0
  const baseTodayActivityIds = isSamePracticeDate ? state.todayActivityIds : []
  const streakUpdate = getPracticeStreakUpdate(state, now)
  const streakRewards = getNewStreakMilestoneRewards(state.completedExerciseIds, streakUpdate.streakDays)

  const nextState: ProgressState = {
    ...state,
    xp: state.xp + bangaloreScenarioChecklistXp,
    dailyXp: baseDailyXp + bangaloreScenarioChecklistXp,
    gems: state.gems + streakRewards.gems,
    streakDays: streakUpdate.streakDays,
    lastPracticeDate: streakUpdate.lastPracticeDate,
    streakFreezes: streakUpdate.streakFreezes,
    completedExerciseIds: [...state.completedExerciseIds, activityId, ...streakRewards.activityIds],
    todayActivityIds: baseTodayActivityIds.includes(activityId)
      ? baseTodayActivityIds
      : [...baseTodayActivityIds, activityId],
    scenarioChecklist: {
      ...state.scenarioChecklist,
      [scenarioId]: nextItems,
    },
  }

  return awardNewAchievementRewards(state, nextState)
}

export function getScenarioChecklistActivityId(scenarioId: string): string {
  return `scenario-${scenarioId}-checklist`
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

export function hydrateProgress(serialized: string | null, now?: string): ProgressState {
  if (!serialized) {
    return createInitialProgress()
  }

  try {
    const hydrated = { ...createInitialProgress(), ...JSON.parse(serialized) } as ProgressState
    hydrated.reviewQueue = hydrateReviewQueue(hydrated.reviewQueue)
    hydrated.lessonProgress = hydrateLessonProgress(hydrated.lessonProgress)
    hydrated.unlockedStoryIds = hydrateStringList(hydrated.unlockedStoryIds)
    hydrated.achievementRewardIds = hydrateStringList(hydrated.achievementRewardIds)
    return now ? regenerateHearts(hydrated, now) : hydrated
  } catch {
    return createInitialProgress()
  }
}

export function regenerateHearts(state: ProgressState, now: string): ProgressState {
  const hearts = Math.max(0, Math.min(maxHearts, Math.round(state.hearts)))

  if (hearts >= maxHearts) {
    return { ...state, hearts: maxHearts, lastHeartLostAt: null }
  }

  if (!state.lastHeartLostAt) {
    return { ...state, hearts }
  }

  const lostAtMs = new Date(state.lastHeartLostAt).getTime()
  const nowMs = new Date(now).getTime()

  if (!Number.isFinite(lostAtMs) || !Number.isFinite(nowMs) || nowMs <= lostAtMs) {
    return { ...state, hearts }
  }

  const regeneratedCount = Math.floor((nowMs - lostAtMs) / heartRegenerationIntervalMs)
  if (regeneratedCount <= 0) {
    return { ...state, hearts }
  }

  const nextHearts = Math.min(maxHearts, hearts + regeneratedCount)
  if (nextHearts >= maxHearts) {
    return {
      ...state,
      hearts: maxHearts,
      lastHeartLostAt: null,
    }
  }

  return {
    ...state,
    hearts: nextHearts,
    lastHeartLostAt: new Date(lostAtMs + regeneratedCount * heartRegenerationIntervalMs).toISOString(),
  }
}

export function getDailyQuests(state: ProgressState, now: string, dailyGoalXp = 10): DailyQuest[] {
  const dateKey = now.slice(0, 10)
  const claimed = new Set(state.dailyQuestClaims[dateKey] ?? [])
  const completedToday = state.todayActivityIds.length
  const dailyXpQuestId = `daily-xp-${dailyGoalXp}`

  return [
    {
      id: dailyXpQuestId,
      title: `Earn ${dailyGoalXp} XP`,
      description: 'Hit the daily XP goal.',
      current: Math.min(dailyGoalXp, state.dailyXp),
      target: dailyGoalXp,
      rewardGems: 10,
      completed: state.dailyXp >= dailyGoalXp,
      claimed: claimed.has(dailyXpQuestId),
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
    lastHeartLostAt: null,
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

export function unlockStoryWithGems(
  state: ProgressState,
  storyId: string,
  cost = bonusStoryUnlockCost,
): ProgressState {
  if (
    !storyId ||
    state.gems < cost ||
    state.unlockedStoryIds.includes(storyId) ||
    state.completedStoryIds.includes(storyId) ||
    state.completedExerciseIds.includes(`story-${storyId}`)
  ) {
    return state
  }

  return {
    ...state,
    gems: state.gems - cost,
    unlockedStoryIds: [...state.unlockedStoryIds, storyId],
  }
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function hydrateStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function getPracticeStreakUpdate(
  state: ProgressState,
  now: string,
): Pick<ProgressState, 'streakDays' | 'lastPracticeDate' | 'streakFreezes'> {
  const today = now.slice(0, 10)

  if (state.lastPracticeDate === today) {
    return {
      streakDays: state.streakDays,
      lastPracticeDate: state.lastPracticeDate,
      streakFreezes: state.streakFreezes,
    }
  }

  if (state.lastPracticeDate === getDateKeyWithOffset(today, -1)) {
    return {
      streakDays: state.streakDays + 1,
      lastPracticeDate: today,
      streakFreezes: state.streakFreezes,
    }
  }

  if (state.streakFreezes > 0 && state.lastPracticeDate === getDateKeyWithOffset(today, -2)) {
    return {
      streakDays: state.streakDays + 1,
      lastPracticeDate: today,
      streakFreezes: state.streakFreezes - 1,
    }
  }

  return {
    streakDays: 1,
    lastPracticeDate: today,
    streakFreezes: state.streakFreezes,
  }
}

function getDateKeyWithOffset(dateKey: string, offsetDays: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`)

  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function awardNewAchievementRewards(previousState: ProgressState, nextState: ProgressState): ProgressState {
  const previouslyUnlocked = new Set(
    getAchievementSummaries(previousState)
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => achievement.code),
  )
  const alreadyRewarded = new Set(nextState.achievementRewardIds)
  const newlyUnlocked = getAchievementSummaries(nextState)
    .filter((achievement) =>
      achievement.unlocked &&
      !previouslyUnlocked.has(achievement.code) &&
      !alreadyRewarded.has(achievement.code),
    )
    .map((achievement) => achievement.code)

  if (!newlyUnlocked.length) {
    return nextState
  }

  return {
    ...nextState,
    gems: nextState.gems + newlyUnlocked.length * achievementGemReward,
    achievementRewardIds: [...nextState.achievementRewardIds, ...newlyUnlocked],
  }
}

function isScenarioChecklistComplete(completedItems: string[], scenarioItems: string[]): boolean {
  return scenarioItems.length > 0 && scenarioItems.every((item) => completedItems.includes(item))
}

function getNewStreakMilestoneRewards(
  completedExerciseIds: string[],
  streakDays: number,
): { gems: number; activityIds: string[] } {
  const activityIds: string[] = []
  let gems = 0

  for (const milestone of streakMilestones) {
    const activityId = getStreakMilestoneActivityId(milestone.days)
    if (streakDays >= milestone.days && !completedExerciseIds.includes(activityId)) {
      activityIds.push(activityId)
      gems += milestone.gems
    }
  }

  return { gems, activityIds }
}

function getStreakMilestoneActivityId(days: number): string {
  return `streak-milestone-${days}`
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

function hydrateLessonProgress(lessonProgress: ProgressState['lessonProgress']): ProgressState['lessonProgress'] {
  return Object.fromEntries(
    Object.entries(lessonProgress).map(([lessonId, progress]) => [
      lessonId,
      {
        ...progress,
        lessonId: progress.lessonId ?? lessonId,
        perfectCompletions: progress.perfectCompletions ?? 0,
      },
    ]),
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
