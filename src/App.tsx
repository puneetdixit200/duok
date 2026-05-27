import { useEffect, useMemo, useState } from 'react'
import {
  bangaloreScenarios,
  coreCurriculumUnits,
  getNextAvailableLesson,
  getPhraseByVocabularyId,
  getScriptCurriculumUnit,
  getStoryLockState,
  getLevelOneCurriculum,
  getLessonById,
  getUnlockedCurriculumUnits,
  isLessonUnlocked,
  lessonExercises,
  stories,
  survivalPhrases,
  transliterateLatinToKannada,
  tutorPersonas,
} from './domain/curriculum'
import {
  applyExerciseResult,
  buyStreakFreeze,
  claimDailyQuestReward,
  completeLessonProgress,
  createInitialProgress,
  getAdaptiveDifficulty,
  getAchievementSummaries,
  getDailyQuests,
  getLessonProgressSummary,
  getDueReviewItems,
  getWeakSkillSummaries,
  hydrateProgress,
  rateReviewItem,
  recordPracticeActivity,
  recordChatMessageSent,
  refillHeartsWithGems,
  serializeProgress,
  toggleScenarioChecklistItem,
  type DailyQuest,
  type ProgressState,
  type ReviewRating,
} from './domain/progress'
import { checkOllamaStatus, generateExerciseWithOllama } from './services/ollama'
import { generateExerciseWithNativeRuntime } from './services/nativeExercise'
import {
  generateExerciseWithHostedProvider,
  generateTutorReplyWithHostedProvider,
  getAiProviderLabel,
  hydrateAiProviderSettings,
  isHostedProviderConfigured,
  sanitizeAiProviderSettingsForExport,
  type AiProviderSettings,
} from './services/hostedProvider'
import {
  createMissingLocalRuntimeSummary,
  emptyLocalRuntimeConfig,
  inspectLocalRuntime,
  type LocalRuntimeConfig,
  type LocalRuntimeSmokeSummary,
  type LocalRuntimeSummary,
} from './services/localRuntime'
import { scorePronunciation, type PronunciationScoreResult } from './services/pronunciation'
import { encodePcmWav, startVoiceCapture, type RecordedAudio, type VoiceCaptureSession } from './services/voiceCapture'
import { buildExportSnapshot, serializeExportSnapshot } from './services/exportSnapshot'
import {
  appendScenarioMessages,
  getScenarioMessages,
  hydrateConversationStore,
  serializeConversationStore,
  type ConversationStore,
} from './services/conversationLog'
import { applyLearnerStorage, collectLearnerStorage } from './services/learnerStore'
import type { GeneratedExercise, LessonExercise, Phrase, Scenario, StoryWord, TutorPersona } from './types'
import './styles.css'

type Tab = 'home' | 'learn' | 'chat' | 'practice' | 'stories' | 'blr' | 'me'
type Screen = 'onboarding' | 'app' | 'lesson' | 'models'
type OnboardingStep = 'welcome' | 'motivation' | 'level' | 'goal'
type StoryMode = 'list' | 'reader' | 'quiz' | 'complete'
type VoiceRecordingTarget = 'chat' | 'pronunciation' | 'lesson'

interface ChatMessage {
  id: string
  speaker: 'tutor' | 'learner'
  text: string
  subtext?: string
}

interface ModelSetupItem {
  name: string
  category: string
  size: string
  status: string
  progress: number
  required: boolean
  description: string
}

interface ReminderPreference {
  enabled: boolean
  time: string
  permission: 'default' | 'granted' | 'denied'
}

interface LearnerProfile {
  motivation: string
  startingLevel: string
  dailyGoalXp: number
  onboardedAt: string
}

interface SoundPreferences {
  soundEffects: boolean
  autoPlayAudio: boolean
}

interface PronunciationAttempt {
  id: string
  phraseId: string
  phrase: string
  transcript: string
  score: number
  level: PronunciationScoreResult['level']
  feedback: string
  tip: string
  problemParts: string[]
  createdAt: string
}

interface ExportStatus {
  statusText: string
  runtimeText: string
}

type LearnerStoreStatus = 'loading' | 'saving' | 'synced' | 'browser' | 'error'

const progressKey = 'kannadaos:progress'
const onboardedKey = 'kannadaos:onboarded'
const learnerProfileKey = 'kannadaos:learner-profile'
const soundPrefsKey = 'kannadaos:sound-prefs'
const reminderKey = 'kannadaos:reminder'
const runtimeKey = 'kannadaos:local-runtime'
const aiProviderKey = 'kannadaos:ai-provider'
const pronunciationKey = 'kannadaos:pronunciation-history'
const conversationKey = 'kannadaos:conversation-log'
const aiExpansionKey = 'kannadaos:ai-expansion'
const defaultChatScenario = bangaloreScenarios.find((scenario) => scenario.id === 'auto-ride') ?? bangaloreScenarios[0]
const defaultTutorPersona = tutorPersonas[0]
const pronunciationPhrases = survivalPhrases.filter((phrase) =>
  ['namaskara-saar', 'ticket-eshtu', 'swalpa-adjust-maadi', 'majestic-ge-hogbeku', 'illi-nillisi'].includes(phrase.id),
)
const defaultReminderPreference: ReminderPreference = {
  enabled: false,
  time: '7:30 PM',
  permission: 'default',
}
const defaultLearnerProfile: LearnerProfile = {
  motivation: 'moved-to-bangalore',
  startingLevel: 'zero',
  dailyGoalXp: 10,
  onboardedAt: '',
}
const defaultSoundPreferences: SoundPreferences = {
  soundEffects: true,
  autoPlayAudio: true,
}
const motivationOptions = [
  { id: 'moved-to-bangalore', label: 'Moved to Bangalore', detail: 'Autos, buses, PGs, darshinis, and office Kannada.' },
  { id: 'work-and-friends', label: 'Work and friends', detail: 'Everyday conversation with coworkers and locals.' },
  { id: 'family-and-culture', label: 'Family and culture', detail: 'Read signs, greetings, and respectful phrases.' },
] as const
const startingLevelOptions = [
  { id: 'zero', label: 'Zero. Teach me everything.', detail: 'Start with script, greetings, and survival phrases.' },
  { id: 'can-read-script', label: 'I can read Kannada script', detail: 'Keep script available but focus on speaking.' },
  { id: 'basic-conversations', label: 'I know basic conversations', detail: 'Start with Bangalore situations and review basics.' },
] as const
const dailyGoalOptions = [5, 10, 20, 30] as const
const tabShortcutByKey: Record<string, Tab> = {
  '1': 'home',
  '2': 'learn',
  '3': 'practice',
  '4': 'stories',
  '5': 'chat',
  '6': 'blr',
  '7': 'me',
}

interface ReadableSubtitle {
  romanization: string
  english: string
}

const kannadaWordGlossary: Record<string, ReadableSubtitle> = {
  'ನಮಸ್ಕಾರ': { romanization: 'namaskara', english: 'hello' },
  'ಸಾರ್': { romanization: 'saar', english: 'sir' },
  'ಹೇಗಿದ್ದೀರಾ': { romanization: 'hegiddira', english: 'how are you' },
  'ಚೆನ್ನಾಗಿದ್ದೇನೆ': { romanization: 'chennagiddene', english: 'I am fine' },
  'ಹೋಗಬೇಕು': { romanization: 'hogbeku', english: 'need to go' },
  'ಟಿಕೆಟ್': { romanization: 'ticket', english: 'ticket' },
  'ಎಷ್ಟು': { romanization: 'eshtu', english: 'how much' },
  'ಧನ್ಯವಾದ': { romanization: 'dhanyavada', english: 'thank you' },
  'ಹೋಗಿ': { romanization: 'hogi', english: 'go' },
  'ಹೋಗು': { romanization: 'hogu', english: 'go' },
  'ಬನ್ನಿ': { romanization: 'banni', english: 'come back' },
  'ಬಾ': { romanization: 'baa', english: 'come' },
  'ನಾನು': { romanization: 'naanu', english: 'I' },
  'ಶಾಲೆಗೆ': { romanization: 'shaalege', english: 'to school' },
  'ಬರುತ್ತೇನೆ': { romanization: 'baruttene', english: 'I will come' },
  'ತಿನ್ನುತ್ತೇನೆ': { romanization: 'tinnuttini', english: 'I will eat' },
  'ಮಾಡುತ್ತೇನೆ': { romanization: 'maduttene', english: 'I will do' },
  'ನನಗೆ': { romanization: 'nanage', english: 'to me' },
  'ನೀರು': { romanization: 'neeru', english: 'water' },
  'ಬೇಕು': { romanization: 'beku', english: 'want' },
  'ಬೇಡ': { romanization: 'beda', english: 'do not want' },
  'ಸ್ವಲ್ಪ': { romanization: 'swalpa', english: 'a little' },
  'ಕನ್ನಡ': { romanization: 'kannada', english: 'Kannada' },
  'ಬರುತ್ತದೆ': { romanization: 'baruttade', english: 'comes' },
  'ಊಟ': { romanization: 'oota', english: 'meal' },
  'ಆಯ್ತಾ': { romanization: 'aayta', english: 'done?' },
  'ಇಲ್ಲಿ': { romanization: 'illi', english: 'here' },
  'ನಿಲ್ಲಿಸಿ': { romanization: 'nillisi', english: 'stop' },
}

const independentVowels: Record<string, string> = {
  ಅ: 'a',
  ಆ: 'aa',
  ಇ: 'i',
  ಈ: 'ii',
  ಉ: 'u',
  ಊ: 'uu',
  ಎ: 'e',
  ಏ: 'ee',
  ಐ: 'ai',
  ಒ: 'o',
  ಓ: 'oo',
  ಔ: 'au',
}

const consonants: Record<string, string> = {
  ಕ: 'k',
  ಖ: 'kh',
  ಗ: 'g',
  ಘ: 'gh',
  ಚ: 'ch',
  ಜ: 'j',
  ಟ: 't',
  ಡ: 'd',
  ಣ: 'na',
  ತ: 't',
  ದ: 'd',
  ನ: 'n',
  ಪ: 'p',
  ಬ: 'b',
  ಭ: 'bh',
  ಮ: 'm',
  ಯ: 'y',
  ರ: 'r',
  ಲ: 'l',
  ವ: 'v',
  ಶ: 'sh',
  ಷ: 'sh',
  ಸ: 's',
  ಹ: 'h',
  ಳ: 'la',
}

const vowelSigns: Record<string, string> = {
  'ಾ': 'aa',
  'ಿ': 'i',
  'ೀ': 'ii',
  'ು': 'u',
  'ೂ': 'uu',
  'ೆ': 'e',
  'ೇ': 'ee',
  'ೈ': 'ai',
  'ೊ': 'o',
  'ೋ': 'oo',
  'ೌ': 'au',
  'ೃ': 'ru',
}

const knownKannadaSubtitles = buildKnownKannadaSubtitles()

const pendingModels: ModelSetupItem[] = [
  {
    name: 'Aya 8B Q4',
    category: 'Language Model',
    size: '4.8 GB',
    status: 'Ready to download',
    progress: 0,
    required: true,
    description: 'Main Kannada generation model for offline tutoring.',
  },
  {
    name: 'Whisper Small',
    category: 'Speech Model',
    size: '466 MB',
    status: 'Queued',
    progress: 0,
    required: true,
    description: 'Speech recognition for pronunciation scoring.',
  },
  {
    name: 'Piper Kannada Voice',
    category: 'Voice Model',
    size: '75 MB',
    status: 'Queued',
    progress: 0,
    required: true,
    description: 'Text-to-speech voice for Kannada reference audio.',
  },
  {
    name: 'Whisper Large V3',
    category: 'Optional Speech Model',
    size: '3.1 GB',
    status: 'Optional',
    progress: 0,
    required: false,
    description: 'Higher accuracy speech recognition for later setup.',
  },
]

const activeSetupModels: ModelSetupItem[] = pendingModels.map((model) => {
  if (model.name === 'Aya 8B Q4') {
    return { ...model, status: 'Downloading 78%', progress: 78 }
  }

  if (model.name === 'Whisper Small') {
    return { ...model, status: 'Downloaded', progress: 100 }
  }

  if (model.name === 'Piper Kannada Voice') {
    return { ...model, status: 'Waiting', progress: 0 }
  }

  return model
})

function SubtitleLines({ text, context }: { text: string; context?: LessonExercise }) {
  const subtitle = getKannadaSubtitle(text, context)

  if (!subtitle) {
    return null
  }

  const hasEnglishSubtitle = hasDistinctEnglishSubtitle(subtitle)

  return (
    <span className="kannada-subtitles">
      {hasEnglishSubtitle && (
        <small className="english-subtitle">{subtitle.english}</small>
      )}
      <small className="romanization">{subtitle.romanization}</small>
    </span>
  )
}

function ChoiceText({ text, context }: { text: string; context?: LessonExercise }) {
  if (!containsKannada(text)) {
    return text
  }

  const subtitle = getKannadaSubtitle(text, context)
  if (!subtitle) {
    return <span lang="kn">{text}</span>
  }

  const hasEnglishSubtitle = hasDistinctEnglishSubtitle(subtitle)

  return (
    <span className="choice-text" aria-label={formatReadableKannadaChoice(text, subtitle)}>
      {hasEnglishSubtitle && <span className="english-subtitle choice-primary-english">{subtitle.english}</span>}
      <span lang="kn">{text}</span>
      <small className="romanization">{subtitle.romanization}</small>
    </span>
  )
}

function ListeningChoiceText({ text, context, revealed }: { text: string; context?: LessonExercise; revealed: boolean }) {
  if (!containsKannada(text) || revealed) {
    return <ChoiceText text={text} context={context} />
  }

  const subtitle = getKannadaSubtitle(text, context)

  return (
    <span className="choice-text">
      <span>Audio choice</span>
      {subtitle && (
        <span className="kannada-subtitles">
          <small className="romanization">{subtitle.romanization}</small>
          {subtitle.english && <small className="english-subtitle">{subtitle.english}</small>}
        </span>
      )}
    </span>
  )
}

function ReadableStatusText({ text, context }: { text: string; context?: LessonExercise }) {
  return (
    <>
      <span>{text}</span>
      <SubtitleLines text={text} context={context} />
    </>
  )
}

function hasDistinctEnglishSubtitle(subtitle: ReadableSubtitle): boolean {
  return Boolean(subtitle.english && subtitle.english.toLowerCase() !== subtitle.romanization.toLowerCase())
}

function formatReadableKannadaChoice(text: string, subtitle: ReadableSubtitle): string {
  return [
    hasDistinctEnglishSubtitle(subtitle) ? subtitle.english : '',
    text,
    subtitle.romanization,
  ]
    .filter(Boolean)
    .join(' ')
}

function isFlashcardAudioStatus(status: string): boolean {
  return /^Playing flashcard audio:|^Flashcard Piper/i.test(status)
}

function getKannadaSubtitle(text: string, context?: LessonExercise): ReadableSubtitle | null {
  if (!containsKannada(text)) {
    return null
  }

  const segments = extractKannadaSegments(text)
  const normalizedSegments = normalizeKannadaText(segments.join(' '))
  const normalizedText = normalizeKannadaText(text)

  if (segments.length > 0 && normalizedSegments && normalizedSegments !== normalizedText) {
    return combineSubtitles(segments.map((segment) => getKannadaOnlySubtitle(segment, context)))
  }

  return getKannadaOnlySubtitle(text, context)
}

function getKannadaOnlySubtitle(text: string, context?: LessonExercise): ReadableSubtitle {
  const words = splitKannadaWords(text)
  if (words.length === 1) {
    const wordGloss = kannadaWordGlossary[words[0]]
    if (wordGloss) {
      return wordGloss
    }
  }

  const knownSubtitle = knownKannadaSubtitles.get(normalizeKannadaText(text))
  if (knownSubtitle) {
    return knownSubtitle
  }

  if (context && (text === context.kannada || text === context.answer)) {
    return {
      romanization: context.transliteration || romanizeKannadaWords(text),
      english: context.english || (containsKannada(context.answer) ? glossKannadaWords(text) : context.answer),
    }
  }

  const contextWordSubtitle = getContextWordSubtitle(text, context)
  if (contextWordSubtitle) {
    return contextWordSubtitle
  }

  return {
    romanization: romanizeKannadaWords(text),
    english: glossKannadaWords(text),
  }
}

function buildKnownKannadaSubtitles(): Map<string, ReadableSubtitle> {
  const subtitleMap = new Map<string, ReadableSubtitle>()
  const allCurriculum = [...coreCurriculumUnits, getScriptCurriculumUnit()]

  for (const phrase of survivalPhrases) {
    addKnownKannadaSubtitle(subtitleMap, phrase.kannada, {
      romanization: phrase.transliteration,
      english: phrase.english,
    })
  }

  for (const unit of allCurriculum) {
    for (const lesson of unit.lessons) {
      for (const exercise of lesson.exercises) {
        const exerciseSubtitle = {
          romanization: exercise.transliteration ?? romanizeKannadaWords(exercise.kannada),
          english: exercise.english ?? (containsKannada(exercise.answer) ? exercise.explanation : exercise.answer),
        }
        addKnownKannadaSubtitle(subtitleMap, exercise.kannada, exerciseSubtitle)

        if (containsKannada(exercise.answer)) {
          addKnownKannadaSubtitle(subtitleMap, exercise.answer, exerciseSubtitle)
        }
      }
    }
  }

  for (const scenario of bangaloreScenarios) {
    addKnownKannadaSubtitle(subtitleMap, scenario.openingLine.kannada, {
      romanization: scenario.openingLine.transliteration,
      english: scenario.openingLine.english,
    })

    for (const phrase of scenario.usefulPhrases) {
      addKnownKannadaSubtitle(subtitleMap, phrase.kannada, {
        romanization: phrase.transliteration,
        english: phrase.english,
      })
    }
  }

  for (const story of stories) {
    for (const sentence of story.sentences) {
      addKnownKannadaSubtitle(subtitleMap, sentence.kannada, {
        romanization: sentence.transliteration,
        english: sentence.english,
      })

      for (const word of sentence.words) {
        addKnownKannadaSubtitle(subtitleMap, word.text, {
          romanization: word.transliteration,
          english: word.english,
        })
      }
    }
  }

  return subtitleMap
}

function addKnownKannadaSubtitle(
  subtitleMap: Map<string, ReadableSubtitle>,
  text: string,
  subtitle: ReadableSubtitle,
) {
  if (!containsKannada(text)) {
    return
  }

  const key = normalizeKannadaText(text)
  if (!key) {
    return
  }

  const existing = subtitleMap.get(key)
  if (!existing || (!existing.english && subtitle.english)) {
    subtitleMap.set(key, subtitle)
  }
}

function getContextWordSubtitle(text: string, context?: LessonExercise): ReadableSubtitle | null {
  if (!context?.english || splitKannadaWords(text).length !== 1) {
    return null
  }

  const normalizedText = normalizeKannadaText(text)
  const contextWords = new Set([
    ...splitKannadaWords(context.kannada),
    ...splitKannadaWords(context.answer),
  ])

  if (!contextWords.has(normalizedText)) {
    return null
  }

  return {
    romanization: getContextWordRomanization(normalizedText, context) ?? romanizeKannadaWords(text),
    english: `phrase: ${context.english}`,
  }
}

function getContextWordRomanization(normalizedText: string, context: LessonExercise): string | null {
  if (!context.transliteration) {
    return null
  }

  const contextWords = splitKannadaWords(context.kannada)
  const romanizedWords = context.transliteration.split(/\s+/).map((word) => word.replace(/[?!.,:;]/g, ''))
  const wordIndex = contextWords.findIndex((word) => word === normalizedText)

  return wordIndex >= 0 ? romanizedWords[wordIndex] ?? null : null
}

function extractKannadaSegments(text: string): string[] {
  const matches = text.match(/[\u0C80-\u0CFF][\u0C80-\u0CFF\u200c\u200d\s?!.,:;'"-]*/g) ?? []
  return matches
    .map((segment) => normalizeKannadaText(segment))
    .filter((segment) => segment.length > 0)
}

function combineSubtitles(subtitles: ReadableSubtitle[]): ReadableSubtitle {
  const romanization = subtitles
    .map((subtitle) => subtitle.romanization)
    .filter(Boolean)
    .join(' / ')
  const english = subtitles
    .map((subtitle) => subtitle.english)
    .filter(Boolean)
    .join(' / ')

  return { romanization, english }
}

function containsKannada(text: string): boolean {
  return /[\u0C80-\u0CFF]/.test(text)
}

function normalizeKannadaText(text: string): string {
  return text.normalize('NFC').replace(/[?!.,:;]/g, '').replace(/\s+/g, ' ').trim()
}

function splitKannadaWords(text: string): string[] {
  return normalizeKannadaText(text).split(/\s+/).filter(Boolean)
}

function romanizeKannadaWords(text: string): string {
  return splitKannadaWords(text)
    .map((word) => kannadaWordGlossary[word]?.romanization ?? romanizeKannadaScript(word))
    .join(' ')
}

function glossKannadaWords(text: string): string {
  return splitKannadaWords(text)
    .map((word) => kannadaWordGlossary[word]?.english ?? '')
    .filter(Boolean)
    .join(' ')
}

function romanizeKannadaScript(text: string): string {
  let output = ''
  let pendingConsonant = ''

  for (const character of Array.from(text)) {
    const consonant = consonants[character]
    if (consonant) {
      output += flushKannadaConsonant(pendingConsonant)
      pendingConsonant = consonant
      continue
    }

    if (character in vowelSigns) {
      output += pendingConsonant ? `${pendingConsonant}${vowelSigns[character]}` : vowelSigns[character]
      pendingConsonant = ''
      continue
    }

    if (character === '್') {
      output += pendingConsonant
      pendingConsonant = ''
      continue
    }

    const vowel = independentVowels[character]
    if (vowel) {
      output += flushKannadaConsonant(pendingConsonant)
      output += vowel
      pendingConsonant = ''
      continue
    }

    if (character === 'ಂ') {
      output += flushKannadaConsonant(pendingConsonant)
      output += 'm'
      pendingConsonant = ''
      continue
    }

    output += flushKannadaConsonant(pendingConsonant)
    output += character
    pendingConsonant = ''
  }

  return `${output}${flushKannadaConsonant(pendingConsonant)}`.replace(/\s+/g, ' ').trim()
}

function flushKannadaConsonant(consonant: string): string {
  return consonant ? `${consonant}a` : ''
}

function formatReadableExample(example: string): string {
  const subtitle = getKannadaSubtitle(example)

  if (!subtitle) {
    return example
  }

  const english = subtitle.english ? ` - ${subtitle.english}` : ''
  return `${example} (${subtitle.romanization}${english})`
}

function buildReviewOptions(phrase: Phrase): string[] {
  const distractors = survivalPhrases
    .map((item) => item.english)
    .filter((english) => english !== phrase.english)

  return [phrase.english, ...distractors].slice(0, 4)
}

function applyStartingLevelPlacement(
  progress: ProgressState,
  startingLevel: string,
  completedAt: string,
): ProgressState {
  let nextProgress = progress

  if (startingLevel === 'can-read-script') {
    nextProgress = markPlacementLessonsCompleted(nextProgress, getScriptCurriculumUnit().lessons, completedAt)
  }

  if (startingLevel === 'basic-conversations') {
    const prerequisiteLessons = coreCurriculumUnits.slice(0, 2).flatMap((unit) => unit.lessons)
    nextProgress = markPlacementLessonsCompleted(nextProgress, prerequisiteLessons, completedAt)
  }

  return nextProgress
}

function markPlacementLessonsCompleted(
  progress: ProgressState,
  lessons: Array<{ id: string }>,
  completedAt: string,
): ProgressState {
  return lessons.reduce((nextProgress, lesson) => {
    if (nextProgress.lessonProgress[lesson.id]) {
      return nextProgress
    }

    return {
      ...nextProgress,
      lessonProgress: {
        ...nextProgress.lessonProgress,
        [lesson.id]: {
          lessonId: lesson.id,
          masteryLevel: 1,
          attempts: 1,
          perfectCompletions: 0,
          lastCompletedAt: completedAt,
        },
      },
    }
  }, progress)
}

function evaluateTypedKannadaAnswer(typedAnswer: string, expectedAnswer: string) {
  const typed = normalizeKannadaAnswer(typedAnswer)
  const expected = normalizeKannadaAnswer(expectedAnswer)
  const correct = typed === expected
  const distance = levenshteinDistance(typed, expected)

  return {
    correct,
    distance,
    almost: !correct && typed.length > 0 && distance <= 2,
  }
}

function normalizeKannadaAnswer(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[?!.,:;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1]

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = current[rightIndex] + 1
      const deletion = previous[rightIndex + 1] + 1
      const substitution = previous[rightIndex] + (left[leftIndex] === right[rightIndex] ? 0 : 1)
      current.push(Math.min(insertion, deletion, substitution))
    }

    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

function getNowMs(): number {
  return Date.now()
}

function App() {
  const curriculum = useMemo(() => getLevelOneCurriculum(), [])
  const allCurriculumUnits = useMemo(() => [getScriptCurriculumUnit(), ...coreCurriculumUnits], [])
  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem(onboardedKey) === 'true' ? 'app' : 'onboarding',
  )
  const [tab, setTab] = useState<Tab>('home')
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('welcome')
  const [selectedMotivation, setSelectedMotivation] = useState(defaultLearnerProfile.motivation)
  const [selectedStartingLevel, setSelectedStartingLevel] = useState(defaultLearnerProfile.startingLevel)
  const [selectedDailyGoalXp, setSelectedDailyGoalXp] = useState(defaultLearnerProfile.dailyGoalXp)
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile>(() =>
    hydrateLearnerProfile(localStorage.getItem(learnerProfileKey)),
  )
  const [soundPreferences, setSoundPreferences] = useState<SoundPreferences>(() =>
    hydrateSoundPreferences(localStorage.getItem(soundPrefsKey)),
  )
  const [progress, setProgress] = useState<ProgressState>(() =>
    hydrateProgress(localStorage.getItem(progressKey), new Date().toISOString()),
  )
  const [reminder, setReminder] = useState<ReminderPreference>(() =>
    hydrateReminder(localStorage.getItem(reminderKey)),
  )
  const [runtimeConfig, setRuntimeConfig] = useState<LocalRuntimeConfig>(() =>
    hydrateLocalRuntimeConfig(localStorage.getItem(runtimeKey)),
  )
  const [aiProviderSettings, setAiProviderSettings] = useState<AiProviderSettings>(() =>
    hydrateAiProviderSettings(localStorage.getItem(aiProviderKey)),
  )
  const [runtimeSummary, setRuntimeSummary] = useState<LocalRuntimeSummary>(() =>
    createMissingLocalRuntimeSummary(hydrateLocalRuntimeConfig(localStorage.getItem(runtimeKey))),
  )
  const [runtimeCheckStatus, setRuntimeCheckStatus] = useState<'idle' | 'checking' | 'checked' | 'error'>('idle')
  const [runtimeSmokeStatus, setRuntimeSmokeStatus] = useState<'idle' | 'checking' | 'checked' | 'error'>('idle')
  const [runtimeSmokeSummary, setRuntimeSmokeSummary] = useState<LocalRuntimeSmokeSummary | null>(null)
  const [pronunciationPhraseId, setPronunciationPhraseId] = useState(pronunciationPhrases[0].id)
  const [pronunciationTranscript, setPronunciationTranscript] = useState('')
  const [pronunciationAudioPath, setPronunciationAudioPath] = useState('')
  const [pronunciationAudioStatus, setPronunciationAudioStatus] = useState('')
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationScoreResult | null>(null)
  const [pronunciationHistory, setPronunciationHistory] = useState<PronunciationAttempt[]>(() =>
    hydratePronunciationHistory(localStorage.getItem(pronunciationKey)),
  )
  const [exportPayload, setExportPayload] = useState('')
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null)
  const [resetStatus, setResetStatus] = useState('')
  const [conversationStore, setConversationStore] = useState<ConversationStore>(() =>
    hydrateConversationStore(localStorage.getItem(conversationKey)),
  )
  const hasDesktopLearnerStore = Boolean(window.kannadaOS?.loadLearnerData && window.kannadaOS?.saveLearnerData)
  const [learnerStoreReady, setLearnerStoreReady] = useState(!hasDesktopLearnerStore)
  const [learnerStoreStatus, setLearnerStoreStatus] = useState<LearnerStoreStatus>(
    hasDesktopLearnerStore ? 'loading' : 'browser',
  )
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [typedAnswer, setTypedAnswer] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'almost' | null>(null)
  const [almostTypingDistance, setAlmostTypingDistance] = useState<number | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultChatScenario.id)
  const [activeBangaloreScenarioId, setActiveBangaloreScenarioId] = useState<string | null>(null)
  const [scenarioDialogueAnswer, setScenarioDialogueAnswer] = useState('')
  const [scenarioDialogueFeedback, setScenarioDialogueFeedback] = useState('')
  const [selectedTutorPersonaId, setSelectedTutorPersonaId] = useState(defaultTutorPersona.id)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    ...getScenarioMessages(
      hydrateConversationStore(localStorage.getItem(conversationKey)),
      defaultChatScenario.id,
      [createOpeningMessage(defaultChatScenario)],
    ),
  ])
  const [voiceStatus, setVoiceStatus] = useState('')
  const [flashcardBack, setFlashcardBack] = useState(false)
  const [reviewSessionIds, setReviewSessionIds] = useState<string[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewSelectedAnswer, setReviewSelectedAnswer] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [reviewCorrectCount, setReviewCorrectCount] = useState(0)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [generatedExercise, setGeneratedExercise] = useState('')
  const [aiExpansionDeck, setAiExpansionDeck] = useState<GeneratedExercise[]>(() =>
    hydrateAiExpansionDeck(localStorage.getItem(aiExpansionKey)),
  )
  const [modelSetupStarted, setModelSetupStarted] = useState(false)
  const [storyMode, setStoryMode] = useState<StoryMode>('list')
  const [selectedStoryId, setSelectedStoryId] = useState(stories[0].id)
  const [selectedStoryWord, setSelectedStoryWord] = useState<StoryWord | null>(null)
  const [selectedStoryAnswer, setSelectedStoryAnswer] = useState('')
  const [storyFeedback, setStoryFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [tipsUnitId, setTipsUnitId] = useState<string | null>(null)
  const [activeLessonId, setActiveLessonId] = useState(coreCurriculumUnits[0].lessons[0].id)
  const [lessonRunExercises, setLessonRunExercises] = useState<LessonExercise[]>(() => [
    ...lessonExercises,
  ])
  const [lessonIndex, setLessonIndex] = useState(0)
  const [totalLessonXp, setTotalLessonXp] = useState(0)
  const [lessonStartedAtMs, setLessonStartedAtMs] = useState(getNowMs)
  const [completedLessonDurationMs, setCompletedLessonDurationMs] = useState(0)
  const [lessonCorrectCount, setLessonCorrectCount] = useState(0)
  const [lessonWrongCount, setLessonWrongCount] = useState(0)
  const [placedWords, setPlacedWords] = useState<string[]>([])
  const [audioStatus, setAudioStatus] = useState('')
  const [speakingScore, setSpeakingScore] = useState<number | null>(null)
  const [speakingTip, setSpeakingTip] = useState('')
  const [selectedMatch, setSelectedMatch] = useState<{ left?: string; right?: string }>({})
  const [matchedPairs, setMatchedPairs] = useState<string[]>([])
  const [voiceCaptureSession, setVoiceCaptureSession] = useState<VoiceCaptureSession | null>(null)
  const [recordingTarget, setRecordingTarget] = useState<VoiceRecordingTarget | null>(null)

  const activeLesson =
    getLessonById(activeLessonId) ?? getNextAvailableLesson(coreCurriculumUnits, progress) ?? coreCurriculumUnits[0].lessons[0]
  const activeExercise = lessonRunExercises[Math.min(lessonIndex, lessonRunExercises.length - 1)]
  const activeStory = stories.find((story) => story.id === selectedStoryId) ?? stories[0]
  const selectedScenario =
    bangaloreScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? defaultChatScenario
  const activeBangaloreScenario = activeBangaloreScenarioId
    ? bangaloreScenarios.find((scenario) => scenario.id === activeBangaloreScenarioId) ?? null
    : null
  const selectedTutorPersona =
    tutorPersonas.find((persona) => persona.id === selectedTutorPersonaId) ?? defaultTutorPersona
  const activePronunciationPhrase =
    pronunciationPhrases.find((phrase) => phrase.id === pronunciationPhraseId) ?? pronunciationPhrases[0]
  const latestPronunciationAttempt = pronunciationHistory[0]
  const completedInCurrentLesson = Math.min(
    lessonIndex + (feedback === 'correct' ? 1 : 0),
    lessonRunExercises.length,
  )

  useEffect(() => {
    localStorage.setItem(progressKey, serializeProgress(progress))
  }, [progress])

  useEffect(() => {
    localStorage.setItem(learnerProfileKey, JSON.stringify(learnerProfile))
  }, [learnerProfile])

  useEffect(() => {
    localStorage.setItem(soundPrefsKey, JSON.stringify(soundPreferences))
  }, [soundPreferences])

  useEffect(() => {
    localStorage.setItem(reminderKey, JSON.stringify(reminder))
  }, [reminder])

  useEffect(() => {
    localStorage.setItem(runtimeKey, JSON.stringify(runtimeConfig))
  }, [runtimeConfig])

  useEffect(() => {
    localStorage.setItem(aiProviderKey, JSON.stringify(aiProviderSettings))
  }, [aiProviderSettings])

  useEffect(() => {
    localStorage.setItem(pronunciationKey, JSON.stringify(pronunciationHistory))
  }, [pronunciationHistory])

  useEffect(() => {
    localStorage.setItem(conversationKey, serializeConversationStore(conversationStore))
  }, [conversationStore])

  useEffect(() => {
    localStorage.setItem(aiExpansionKey, JSON.stringify(aiExpansionDeck))
  }, [aiExpansionDeck])

  useEffect(() => {
    const bridge = window.kannadaOS
    if (!bridge?.loadLearnerData) {
      return
    }

    let active = true
    bridge
      .loadLearnerData()
      .then((payload) => {
        if (!active) {
          return
        }

        if (applyLearnerStorage(payload, localStorage)) {
          const nextProgress = hydrateProgress(localStorage.getItem(progressKey), new Date().toISOString())
          const nextLearnerProfile = hydrateLearnerProfile(localStorage.getItem(learnerProfileKey))
          const nextSoundPreferences = hydrateSoundPreferences(localStorage.getItem(soundPrefsKey))
          const nextReminder = hydrateReminder(localStorage.getItem(reminderKey))
          const nextRuntimeConfig = hydrateLocalRuntimeConfig(localStorage.getItem(runtimeKey))
          const nextAiProviderSettings = hydrateAiProviderSettings(localStorage.getItem(aiProviderKey))
          const nextConversationStore = hydrateConversationStore(localStorage.getItem(conversationKey))
          const nextAiExpansionDeck = hydrateAiExpansionDeck(localStorage.getItem(aiExpansionKey))

          setScreen(localStorage.getItem(onboardedKey) === 'true' ? 'app' : 'onboarding')
          setProgress(nextProgress)
          setLearnerProfile(nextLearnerProfile)
          setSelectedMotivation(nextLearnerProfile.motivation)
          setSelectedStartingLevel(nextLearnerProfile.startingLevel)
          setSelectedDailyGoalXp(nextLearnerProfile.dailyGoalXp)
          setSoundPreferences(nextSoundPreferences)
          setReminder(nextReminder)
          setRuntimeConfig(nextRuntimeConfig)
          setAiProviderSettings(nextAiProviderSettings)
          setRuntimeSummary(createMissingLocalRuntimeSummary(nextRuntimeConfig))
          setPronunciationHistory(hydratePronunciationHistory(localStorage.getItem(pronunciationKey)))
          setConversationStore(nextConversationStore)
          setAiExpansionDeck(nextAiExpansionDeck)
          setChatMessages(
            getScenarioMessages(nextConversationStore, defaultChatScenario.id, [
              createOpeningMessage(defaultChatScenario),
            ]),
          )
        }

        setLearnerStoreReady(true)
        setLearnerStoreStatus('synced')
      })
      .catch(() => {
        if (active) {
          setLearnerStoreReady(true)
          setLearnerStoreStatus('error')
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const saveLearnerData = window.kannadaOS?.saveLearnerData
    if (!learnerStoreReady || !saveLearnerData) {
      return
    }

    let active = true
    saveLearnerData(collectLearnerStorage(localStorage))
      .then(() => {
        if (active) {
          setLearnerStoreStatus('synced')
        }
      })
      .catch(() => {
        if (active) {
          setLearnerStoreStatus('error')
        }
      })

    return () => {
      active = false
    }
  }, [aiProviderSettings, conversationStore, learnerProfile, learnerStoreReady, progress, pronunciationHistory, reminder, runtimeConfig, soundPreferences])

  useEffect(() => {
    let active = true
    checkOllamaStatus().then((status) => {
      if (active) {
        setOllamaStatus(status)
      }
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (screen !== 'lesson' || lessonIndex >= lessonRunExercises.length || !activeExercise?.kannada) {
      return
    }

    let cancelled = false
    if (!soundPreferences.autoPlayAudio) {
      queueMicrotask(() => {
        if (!cancelled) {
          setAudioStatus('Auto reference audio paused in sound preferences.')
        }
      })
      return () => {
        cancelled = true
      }
    }

    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (
      activeExercise.type === 'speaking' ||
      !synthesizeNativeSpeech ||
      !runtimeConfig.piperVoicePath.trim() ||
      !runtimeConfig.piperBinaryPath.trim()
    ) {
      queueMicrotask(() => {
        if (!cancelled) {
          setAudioStatus(`Auto reference audio: ${activeExercise.transliteration ?? activeExercise.kannada}`)
        }
      })
      return () => {
        cancelled = true
      }
    }

    synthesizeNativeSpeech({
      runtimeConfig,
      text: activeExercise.kannada,
    }).then((result) => {
      if (!cancelled) {
        setAudioStatus(
          result.ok
            ? `Auto Piper audio ready: ${result.audioPath}`
            : result.error ?? 'Auto reference audio unavailable.',
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeExercise, lessonIndex, lessonRunExercises.length, runtimeConfig, screen, soundPreferences.autoPlayAudio])

  function startLearning() {
    const nextLearnerProfile: LearnerProfile = {
      motivation: selectedMotivation,
      startingLevel: selectedStartingLevel,
      dailyGoalXp: selectedDailyGoalXp,
      onboardedAt: new Date().toISOString(),
    }
    localStorage.setItem(onboardedKey, 'true')
    localStorage.setItem(learnerProfileKey, JSON.stringify(nextLearnerProfile))
    localStorage.setItem(soundPrefsKey, JSON.stringify(soundPreferences))
    setLearnerProfile(nextLearnerProfile)
    setProgress((current) => applyStartingLevelPlacement(current, selectedStartingLevel, nextLearnerProfile.onboardedAt))
    setScreen('app')
  }

  function resetExerciseInteraction() {
    setSelectedAnswer('')
    setTypedAnswer('')
    setFeedback(null)
    setAlmostTypingDistance(null)
    setPlacedWords([])
    setAudioStatus('')
    setSpeakingScore(null)
    setSpeakingTip('')
    setSelectedMatch({})
    setMatchedPairs([])
  }

  function openLesson(lessonId?: string) {
    const nextLesson =
      (lessonId ? getLessonById(lessonId) : getNextAvailableLesson(coreCurriculumUnits, progress)) ??
      coreCurriculumUnits[0].lessons[0]
    setActiveLessonId(nextLesson.id)
    setLessonRunExercises([...nextLesson.exercises])
    setLessonIndex(0)
    setTotalLessonXp(0)
    setLessonStartedAtMs(getNowMs())
    setCompletedLessonDurationMs(0)
    setLessonCorrectCount(0)
    setLessonWrongCount(0)
    resetExerciseInteraction()
    setScreen('lesson')
  }

  function checkAnswer(exercise: LessonExercise) {
    if (feedback) {
      return
    }

    const typingEvaluation = exercise.type === 'typeKannada'
      ? evaluateTypedKannadaAnswer(selectedAnswer, exercise.answer)
      : null
    if (typingEvaluation?.almost) {
      setFeedback('almost')
      setAlmostTypingDistance(typingEvaluation.distance)
      return
    }

    const correct = typingEvaluation ? typingEvaluation.correct : selectedAnswer === exercise.answer
    const now = new Date().toISOString()
    const completesLesson = correct && lessonIndex === lessonRunExercises.length - 1
    const nextCorrectCount = lessonCorrectCount + (correct ? 1 : 0)
    const nextWrongCount = lessonWrongCount + (correct ? 0 : 1)
    const completesPerfectLesson = completesLesson && nextWrongCount === 0
    const lessonDurationMs = completesLesson ? getNowMs() - lessonStartedAtMs : 0
    setFeedback(correct ? 'correct' : 'wrong')

    if (correct) {
      setTotalLessonXp((current) => current + exercise.xp)
      setLessonCorrectCount(nextCorrectCount)
    } else {
      setLessonWrongCount(nextWrongCount)
      setLessonRunExercises((current) =>
        current.slice(lessonIndex + 1).some((queuedExercise) => queuedExercise.id === exercise.id)
          ? current
          : [...current, exercise],
      )
    }

    setProgress((current) =>
      {
        const nextProgress = applyExerciseResult(current, {
          exerciseId: exercise.id,
          correct,
          skillTag: exercise.skillTag,
          xp: exercise.xp,
          vocabularyIds: exercise.vocabularyIds,
          now,
        })

        return completesLesson ? completeLessonProgress(nextProgress, activeLesson.id, now, completesPerfectLesson, lessonDurationMs) : nextProgress
      },
    )

    if (completesLesson) {
      setCompletedLessonDurationMs(lessonDurationMs)
      setLessonIndex(lessonRunExercises.length)
      setSelectedAnswer('')
      setFeedback(null)
    }
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const hasCommandModifier = event.metaKey || event.ctrlKey

      if (hasCommandModifier) {
        const shortcutTab = tabShortcutByKey[event.key]
        if (shortcutTab) {
          event.preventDefault()
          setScreen('app')
          setTab(shortcutTab)
          return
        }

        if (event.key.toLowerCase() === 'm') {
          event.preventDefault()
          if (screen === 'lesson' && activeExercise?.type === 'speaking') {
            void recordPhrase(activeExercise)
            return
          }

          if (screen === 'app' && tab === 'chat') {
            void recordVoiceInput()
            return
          }

          if (screen === 'app' && tab === 'practice') {
            void recordPronunciationAudio()
          }
          return
        }

        if (event.key.toLowerCase() === 'r' && screen === 'lesson' && activeExercise) {
          event.preventDefault()
          void playExerciseReference(activeExercise)
          return
        }
      }

      if (isEditableShortcutTarget(event.target)) {
        return
      }

      if (screen !== 'lesson' || !activeExercise) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setScreen('app')
        return
      }

      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault()
        selectExerciseOptionByIndex(activeExercise, Number(event.key) - 1)
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        void playExerciseReference(activeExercise)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (feedback === 'correct' || feedback === 'wrong') {
          goToNextExercise()
          return
        }

        if (!feedback && selectedAnswer) {
          checkAnswer(activeExercise)
        }
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  // The shortcut handler intentionally uses the latest render's lesson actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExercise, feedback, screen, selectedAnswer, tab])

  function selectExerciseOptionByIndex(exercise: LessonExercise, optionIndex: number) {
    if (feedback || optionIndex < 0 || optionIndex >= exercise.options.length) {
      return
    }

    const option = exercise.options[optionIndex]
    if (exercise.type === 'arrange') {
      selectArrangeWord(option)
      return
    }

    if (exercise.type === 'typeKannada') {
      setTypedAnswer(option)
      setSelectedAnswer(transliterateLatinToKannada(option))
      return
    }

    setSelectedAnswer(option)
  }

  function goToNextExercise() {
    if (lessonIndex + 1 >= lessonRunExercises.length) {
      setLessonIndex(lessonRunExercises.length)
      resetExerciseInteraction()
      return
    }

    setLessonIndex((current) => current + 1)
    resetExerciseInteraction()
  }

  function selectArrangeWord(word: string) {
    if (placedWords.includes(word)) {
      return
    }

    const nextWords = [...placedWords, word]
    setPlacedWords(nextWords)
    setSelectedAnswer(nextWords.join(' '))
  }

  async function recordPhrase(exercise: LessonExercise) {
    await toggleVoiceRecording(
      'lesson',
      'lesson-speaking',
      async (transcript) => {
        const result = scorePronunciation({
          expectedText: exercise.kannada ?? exercise.answer,
          expectedTransliteration: exercise.transliteration ?? exercise.answer,
          transcript,
          targetParts: getPronunciationParts(exercise.kannada ?? exercise.answer),
        })
        setSpeakingScore(result.score)
        setSpeakingTip(result.tip)

        if (result.score >= 70) {
          setSelectedAnswer(exercise.answer)
        }
      },
      setAudioStatus,
    )
  }

  function handleMatchSelection(value: string, side: 'left' | 'right', exercise: LessonExercise) {
    const nextSelection = { ...selectedMatch, [side]: value }
    const pairs = parseMatchPairs(exercise.answer)

    if (nextSelection.left && nextSelection.right) {
      const pairId = `${nextSelection.left}=${nextSelection.right}`
      const isCorrect = pairs.some(
        (pair) => pair.left === nextSelection.left && pair.right === nextSelection.right,
      )

      if (isCorrect && !matchedPairs.includes(pairId)) {
        const nextMatches = [...matchedPairs, pairId]
        setMatchedPairs(nextMatches)
        if (nextMatches.length === pairs.length) {
          setSelectedAnswer(exercise.answer)
        }
      }

      setSelectedMatch({})
      return
    }

    setSelectedMatch(nextSelection)
  }

  async function generateAiExercise() {
    const weakArea = Object.keys(progress.weakAreas)[0] ?? 'verbs'
    const result =
      aiProviderSettings.activeProvider === 'openrouter' || aiProviderSettings.activeProvider === 'nvidia'
        ? await generateExerciseWithHostedProvider({
            hostedChatCompletion: window.kannadaOS?.generateHostedChat,
            providerSettings: aiProviderSettings,
            weakArea,
          })
        : aiProviderSettings.activeProvider === 'ollama'
          ? await generateExerciseWithOllama({ weakArea })
          : await generateExerciseWithLocalPreference(weakArea)

    setGeneratedExercise(
      `${formatGeneratedExerciseSource(result.source)}: ${result.exercise.prompt} ${result.exercise.kannada}`,
    )
    setAiExpansionDeck((current) => [result.exercise, ...current].slice(0, 8))
  }

  async function generateExerciseWithLocalPreference(weakArea: string) {
    const nativeGenerator = window.kannadaOS?.generateNativeExercise
    const smokeSummary = runtimeSmokeSummary
    const canUseNative =
      runtimeSummary.readyCount === runtimeSummary.totalCount &&
      smokeSummary !== null &&
      smokeSummary.passedCount === smokeSummary.totalCount &&
      nativeGenerator
    const nativeResult = canUseNative
      ? await generateExerciseWithNativeRuntime({
          runtimeConfig,
          weakArea,
          generateNativeExercise: nativeGenerator,
        })
      : null

    return nativeResult?.source === 'native' ? nativeResult : generateExerciseWithOllama({ weakArea })
  }

  async function sendChatMessage() {
    const trimmed = chatInput.trim()
    if (!trimmed) {
      return
    }

    setChatInput('')
    setVoiceStatus('')
    await appendChatTurn(trimmed)
  }

  async function appendChatTurn(text: string, subtext?: string) {
    let tutorReply = buildTutorReply(text, selectedScenario, selectedTutorPersona)

    if (aiProviderSettings.activeProvider === 'openrouter' || aiProviderSettings.activeProvider === 'nvidia') {
      const providerLabel = getAiProviderLabel(aiProviderSettings.activeProvider)
      setVoiceStatus(`Asking ${providerLabel}...`)
      const hostedReply = await generateTutorReplyWithHostedProvider({
        hostedChatCompletion: window.kannadaOS?.generateHostedChat,
        providerSettings: aiProviderSettings,
        learnerText: text,
        scenarioTitle: selectedScenario.title,
        personaName: selectedTutorPersona.name,
        personaStyle: selectedTutorPersona.style,
        usefulPhrases: selectedScenario.usefulPhrases.map((phrase) => `${phrase.transliteration} = ${phrase.english}`),
      })

      if (hostedReply.source === aiProviderSettings.activeProvider) {
        tutorReply = {
          text: hostedReply.text,
          subtext: `${providerLabel}: ${getActiveHostedModel(aiProviderSettings)}`,
        }
        setVoiceStatus(`${providerLabel} tutor reply ready.`)
      } else {
        setVoiceStatus(`${providerLabel} unavailable; using offline tutor. ${hostedReply.error ?? ''}`.trim())
      }
    }

    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { id: `learner-${getNowMs()}`, speaker: 'learner', text, subtext },
      { id: `tutor-${getNowMs()}`, speaker: 'tutor', ...tutorReply },
    ]
    setChatMessages(nextMessages)
    setProgress((current) => recordChatMessageSent(current))
    setConversationStore((current) => appendScenarioMessages(current, selectedScenario.id, nextMessages))
  }

  function selectChatScenario(scenarioId: string) {
    const scenario = bangaloreScenarios.find((item) => item.id === scenarioId) ?? defaultChatScenario
    setSelectedScenarioId(scenario.id)
    setChatMessages(getScenarioMessages(conversationStore, scenario.id, [createOpeningMessage(scenario)]))
    setChatInput('')
    setVoiceStatus('')
  }

  function toggleScenarioChecklist(scenarioId: string, item: string) {
    setProgress((current) => toggleScenarioChecklistItem(current, scenarioId, item))
  }

  function openBangaloreScenario(scenarioId: string) {
    setActiveBangaloreScenarioId(scenarioId)
    setScenarioDialogueAnswer('')
    setScenarioDialogueFeedback('')
    setAudioStatus('')
  }

  async function playScenarioPhraseAudio(phrase: Phrase) {
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      setAudioStatus(`Playing scenario audio: ${phrase.transliteration}`)
      return
    }

    setAudioStatus('Scenario Piper synthesis running...')
    const result = await synthesizeNativeSpeech({
      runtimeConfig,
      text: phrase.kannada,
    })

    if (result.ok) {
      if (result.audioUrl) {
        try {
          const audio = new Audio(result.audioUrl)
          await audio.play()
        } catch {
          setAudioStatus(`Scenario Piper audio ready: ${result.audioPath} (playback unavailable)`)
          return
        }
      }

      setAudioStatus(`Scenario Piper audio ready: ${result.audioPath}`)
      return
    }

    setAudioStatus(result.error ?? 'Scenario Piper synthesis failed.')
  }

  function practiceScenarioPhrase(phrase: Phrase) {
    selectPronunciationPhrase(phrase.id)
    setTab('practice')
  }

  function checkScenarioDialogue(scenario: Scenario) {
    const correctAnswer = scenario.usefulPhrases[0]?.kannada ?? ''
    setScenarioDialogueFeedback(
      scenarioDialogueAnswer === correctAnswer
        ? `Good reply for ${scenario.title}.`
        : 'Try the destination phrase first.',
    )
  }

  async function recordVoiceInput() {
    await toggleVoiceRecording(
      'chat',
      'chat',
      async (transcript) => {
        await appendChatTurn(transcript, getTranscriptCompanion(transcript))
      },
      setVoiceStatus,
    )
  }

  function updateAiProviderSetting<K extends keyof AiProviderSettings>(key: K, value: AiProviderSettings[K]) {
    setAiProviderSettings((current) => ({ ...current, [key]: value }))
  }

  function toggleDailyReminder() {
    setReminder((current) => ({ ...current, enabled: !current.enabled }))
  }

  function setReminderTime(time: string) {
    setReminder((current) => ({ ...current, time }))
  }

  function setDailyGoal(goal: number) {
    setLearnerProfile((current) => ({ ...current, dailyGoalXp: goal }))
  }

  function toggleSoundPreference(key: keyof SoundPreferences) {
    setSoundPreferences((current) => ({ ...current, [key]: !current[key] }))
  }

  function allowReminderAlerts() {
    setReminder((current) => ({ ...current, permission: 'granted' }))
  }

  function claimQuestReward(quest: DailyQuest) {
    setProgress((current) => claimDailyQuestReward(current, quest, new Date().toISOString()))
  }

  function rateFlashcard(vocabularyId: string, rating: ReviewRating) {
    setProgress((current) => rateReviewItem(current, vocabularyId, rating, new Date().toISOString()))
    setFlashcardBack(false)
  }

  function startReviewSession(vocabularyIds: string[]) {
    const reviewableIds = vocabularyIds.filter((vocabularyId) => getPhraseByVocabularyId(vocabularyId))

    if (!reviewableIds.length) {
      return
    }

    setReviewSessionIds(reviewableIds)
    setReviewIndex(0)
    setReviewSelectedAnswer('')
    setReviewFeedback(null)
    setReviewCorrectCount(0)
  }

  function checkReviewAnswer(phrase: Phrase) {
    if (reviewFeedback || !reviewSelectedAnswer) {
      return
    }

    const correct = reviewSelectedAnswer === phrase.english
    const now = new Date().toISOString()
    const reviewExerciseId = `review-${phrase.id}`
    setReviewFeedback(correct ? 'correct' : 'wrong')

    if (correct) {
      setReviewCorrectCount((current) => current + 1)
    }

    setProgress((current) => {
      const ratedProgress = rateReviewItem(current, phrase.id, correct ? 'easy' : 'hard', now)

      if (!correct) {
        return ratedProgress
      }

      return recordPracticeActivity(ratedProgress, {
        activityId: reviewExerciseId,
        xp: 1,
        now,
      })
    })
  }

  function goToNextReview() {
    if (!reviewFeedback) {
      return
    }

    if (reviewIndex + 1 >= reviewSessionIds.length) {
      setReviewIndex(reviewSessionIds.length)
    } else {
      setReviewIndex((current) => current + 1)
    }

    setReviewSelectedAnswer('')
    setReviewFeedback(null)
  }

  function resetReviewSession() {
    setReviewSessionIds([])
    setReviewIndex(0)
    setReviewSelectedAnswer('')
    setReviewFeedback(null)
    setReviewCorrectCount(0)
  }

  function refillHearts() {
    setProgress((current) => refillHeartsWithGems(current))
  }

  function purchaseStreakFreeze() {
    setProgress((current) => buyStreakFreeze(current))
  }

  function updateRuntimePath(key: keyof LocalRuntimeConfig, value: string) {
    const nextConfig = { ...runtimeConfig, [key]: value }
    setRuntimeConfig(nextConfig)
    setRuntimeSummary(createMissingLocalRuntimeSummary(nextConfig))
    setRuntimeCheckStatus('idle')
    setRuntimeSmokeStatus('idle')
    setRuntimeSmokeSummary(null)
  }

  async function playExerciseReference(exercise: LessonExercise, playbackRate = 1) {
    const slow = playbackRate < 1
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      setAudioStatus(
        slow
          ? `Playing slow reference audio at 0.7x: ${exercise.transliteration ?? exercise.kannada}`
          : `Playing reference audio: ${exercise.transliteration ?? exercise.kannada}`,
      )
      return
    }

    setAudioStatus(slow ? 'Piper slow synthesis running...' : 'Piper synthesis running...')
    const result = await synthesizeNativeSpeech({
      runtimeConfig,
      text: exercise.kannada,
    })

    if (result.ok) {
      if (result.audioUrl) {
        try {
          const audio = new Audio(result.audioUrl)
          audio.playbackRate = playbackRate
          await audio.play()
        } catch {
          setAudioStatus(
            slow
              ? `Piper slow audio ready at 0.7x: ${result.audioPath} (playback unavailable)`
              : `Piper audio ready: ${result.audioPath} (playback unavailable)`,
          )
          return
        }
      }

      setAudioStatus(slow ? `Piper slow audio ready at 0.7x: ${result.audioPath}` : `Piper audio ready: ${result.audioPath}`)
      return
    }

    setAudioStatus(result.error ?? 'Piper synthesis failed.')
  }

  async function playFlashcardAudio(phrase: Phrase) {
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      setAudioStatus(`Playing flashcard audio: ${phrase.transliteration}`)
      return
    }

    setAudioStatus('Flashcard Piper synthesis running...')
    const result = await synthesizeNativeSpeech({
      runtimeConfig,
      text: phrase.kannada,
    })

    if (result.ok) {
      if (result.audioUrl) {
        try {
          const audio = new Audio(result.audioUrl)
          await audio.play()
        } catch {
          setAudioStatus(`Flashcard Piper audio ready: ${result.audioPath} (playback unavailable)`)
          return
        }
      }

      setAudioStatus(`Flashcard Piper audio ready: ${result.audioPath}`)
      return
    }

    setAudioStatus(result.error ?? 'Flashcard Piper synthesis failed.')
  }

  async function checkLocalRuntime() {
    setRuntimeCheckStatus('checking')
    setRuntimeSmokeStatus('idle')
    setRuntimeSmokeSummary(null)

    try {
      const summary = window.kannadaOS?.inspectLocalRuntime
        ? await window.kannadaOS.inspectLocalRuntime(runtimeConfig)
        : await inspectLocalRuntime(runtimeConfig, async () => false)
      setRuntimeSummary(summary)
      setRuntimeCheckStatus('checked')
    } catch {
      setRuntimeSummary(createMissingLocalRuntimeSummary(runtimeConfig))
      setRuntimeCheckStatus('error')
    }
  }

  async function runRuntimeSmoke() {
    setRuntimeSmokeStatus('checking')

    try {
      if (!window.kannadaOS?.smokeLocalRuntime) {
        throw new Error('Native runtime smoke is only available in the desktop app.')
      }

      const summary = await window.kannadaOS.smokeLocalRuntime(runtimeConfig)
      setRuntimeSmokeSummary(summary)
      setRuntimeSmokeStatus('checked')
    } catch {
      setRuntimeSmokeSummary(null)
      setRuntimeSmokeStatus('error')
    }
  }

  function selectPronunciationPhrase(phraseId: string) {
    setPronunciationPhraseId(phraseId)
    setPronunciationTranscript('')
    setPronunciationAudioPath('')
    setPronunciationAudioStatus('')
    setPronunciationResult(null)
  }

  async function playPronunciationReference(playbackRate = 1) {
    const slow = playbackRate < 1
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      setPronunciationAudioStatus(
        slow
          ? `Slow reference audio at 0.7x: ${activePronunciationPhrase.transliteration}`
          : `Reference audio: ${activePronunciationPhrase.transliteration}`,
      )
      return
    }

    setPronunciationAudioStatus(slow ? 'Piper slow synthesis running...' : 'Piper synthesis running...')
    const result = await synthesizeNativeSpeech({
      runtimeConfig,
      text: activePronunciationPhrase.kannada,
    })

    if (result.ok) {
      if (result.audioUrl) {
        try {
          const audio = new Audio(result.audioUrl)
          audio.playbackRate = playbackRate
          await audio.play()
        } catch {
          setPronunciationAudioStatus(
            slow
              ? `Piper slow audio ready at 0.7x: ${result.audioPath} (playback unavailable)`
              : `Piper audio ready: ${result.audioPath} (playback unavailable)`,
          )
          return
        }
      }

      setPronunciationAudioStatus(slow ? `Piper slow audio ready at 0.7x: ${result.audioPath}` : `Piper audio ready: ${result.audioPath}`)
      return
    }

    setPronunciationAudioStatus(result.error ?? 'Piper synthesis failed.')
  }

  async function transcribePronunciationAudio() {
    const audioPath = pronunciationAudioPath.trim()
    if (!audioPath) {
      setPronunciationAudioStatus('Add an audio file path first.')
      return
    }

    if (!window.kannadaOS?.transcribeNativeAudio) {
      setPronunciationAudioStatus('Whisper bridge unavailable in browser preview.')
      return
    }

    setPronunciationAudioStatus('Whisper transcription running...')

    const result = await window.kannadaOS.transcribeNativeAudio({ runtimeConfig, audioPath })
    if (result.ok) {
      setPronunciationTranscript(result.text)
      setPronunciationAudioStatus('Whisper transcript ready.')
      return
    }

    setPronunciationAudioStatus(result.error ?? 'Whisper transcription failed.')
  }

  function scorePronunciationPractice() {
    const transcript = pronunciationTranscript.trim() || getSimulatedPronunciationTranscript(activePronunciationPhrase)
    scorePronunciationTranscript(transcript)
  }

  function scorePronunciationTranscript(transcript: string) {
    const result = scorePronunciation({
      expectedText: activePronunciationPhrase.kannada,
      expectedTransliteration: activePronunciationPhrase.transliteration,
      transcript,
      targetParts: getPronunciationParts(activePronunciationPhrase.kannada),
    })
    const attempt: PronunciationAttempt = {
      id: `pronunciation-${getNowMs()}`,
      phraseId: activePronunciationPhrase.id,
      phrase: activePronunciationPhrase.kannada,
      transcript,
      score: result.score,
      level: result.level,
      feedback: result.feedback,
      tip: result.tip,
      problemParts: result.problemParts,
      createdAt: new Date().toISOString(),
    }

    setPronunciationTranscript(transcript)
    setPronunciationResult(result)
    setPronunciationHistory((current) => [attempt, ...current].slice(0, 5))
  }

  async function recordPronunciationAudio() {
    await toggleVoiceRecording(
      'pronunciation',
      'pronunciation',
      async (transcript) => {
        setPronunciationTranscript(transcript)
        scorePronunciationTranscript(transcript)
      },
      setPronunciationAudioStatus,
    )
  }

  async function toggleVoiceRecording(
    target: VoiceRecordingTarget,
    source: string,
    onTranscript: (transcript: string) => Promise<void> | void,
    setStatus: (status: string) => void,
  ) {
    if (recordingTarget === target && voiceCaptureSession) {
      setStatus('Transcribing recorded speech...')

      try {
        const recording = await voiceCaptureSession.stop()
        setVoiceCaptureSession(null)
        setRecordingTarget(null)
        const result = await transcribeRecordedAudio(recording, source)

        if (result.ok) {
          setStatus(formatVoiceTranscriptStatus(result.text))
          await onTranscript(result.text)
          return
        }

        setStatus(result.error ?? 'Whisper transcription failed.')
      } catch (error) {
        setVoiceCaptureSession(null)
        setRecordingTarget(null)
        setStatus(error instanceof Error ? error.message : 'Voice recording failed.')
      }
      return
    }

    if (recordingTarget) {
      setStatus('Finish the current recording first.')
      return
    }

    if (window.kannadaOS?.e2e) {
      setVoiceCaptureSession(createE2EVoiceCaptureSession())
      setRecordingTarget(target)
      setStatus('Recording... click Stop Recording when done.')
      return
    }

    try {
      const session = await startVoiceCapture()
      setVoiceCaptureSession(session)
      setRecordingTarget(target)
      setStatus('Recording... click Stop Recording when done.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Microphone recording failed.')
    }
  }

  async function transcribeRecordedAudio(recording: RecordedAudio, source: string) {
    if (!window.kannadaOS?.transcribeRecordedAudio) {
      return {
        ok: false,
        text: '',
        error: 'Whisper recorder unavailable in browser preview.',
      }
    }

    return window.kannadaOS.transcribeRecordedAudio({
      runtimeConfig,
      audioBytes: Array.from(recording.audioBytes),
      source,
    })
  }

  function exportLearnerData() {
    const snapshot = buildExportSnapshot({
      exportedAt: new Date().toISOString(),
      progress,
      reminder,
      runtimeConfig,
      aiProviderSettings: sanitizeAiProviderSettingsForExport(aiProviderSettings),
      conversationStore,
      pronunciationHistory,
    })

    setExportPayload(serializeExportSnapshot(snapshot))
    setExportStatus({
      statusText: `Export ready: ${snapshot.summary.completedActivities} ${snapshot.summary.completedActivities === 1 ? 'activity' : 'activities'}, ${snapshot.summary.practicedWords} practiced ${snapshot.summary.practicedWords === 1 ? 'word' : 'words'}, ${snapshot.summary.pronunciationAttempts} pronunciation ${snapshot.summary.pronunciationAttempts === 1 ? 'attempt' : 'attempts'}`,
      runtimeText: `${snapshot.summary.runtimePathsConfigured} runtime ${snapshot.summary.runtimePathsConfigured === 1 ? 'path' : 'paths'} configured`,
    })
  }

  function resetAllProgress() {
    const shouldReset = window.confirm(
      'Reset all lesson progress, pronunciation attempts, and chat history? AI model paths and hosted AI keys will be kept.',
    )

    if (!shouldReset) {
      return
    }

    const nextProgress = createInitialProgress()
    setProgress(nextProgress)
    setPronunciationTranscript('')
    setPronunciationAudioPath('')
    setPronunciationAudioStatus('')
    setPronunciationResult(null)
    setPronunciationHistory([])
    setConversationStore({})
    setSelectedScenarioId(defaultChatScenario.id)
    setSelectedTutorPersonaId(defaultTutorPersona.id)
    setChatMessages([createOpeningMessage(defaultChatScenario)])
    setChatInput('')
    setVoiceStatus('')
    resetExerciseInteraction()
    setLessonStartedAtMs(getNowMs())
    setCompletedLessonDurationMs(0)
    setLessonCorrectCount(0)
    setLessonWrongCount(0)
    setLessonIndex(0)
    setTotalLessonXp(0)
    setExportPayload('')
    setExportStatus(null)
    setResetStatus('Progress reset. Your AI model paths and hosted AI keys were kept.')
    localStorage.setItem(progressKey, serializeProgress(nextProgress))
    localStorage.setItem(pronunciationKey, '[]')
    localStorage.setItem(conversationKey, '{}')
  }

  function openStory(storyId: string) {
    setSelectedStoryId(storyId)
    setSelectedStoryWord(null)
    setSelectedStoryAnswer('')
    setStoryFeedback(null)
    setStoryMode('reader')
  }

  function checkStoryAnswer() {
    if (selectedStoryAnswer === activeStory.quiz.answer) {
      setStoryFeedback('correct')
      setStoryMode('complete')
      setProgress((current) =>
        applyExerciseResult(current, {
          exerciseId: `story-${activeStory.id}`,
          correct: true,
          skillTag: 'story',
          xp: 20,
          vocabularyIds: activeStory.sentences.flatMap((sentence) =>
            sentence.words.map((word) => `${activeStory.id}:${word.text}`),
          ),
          now: new Date().toISOString(),
        }),
      )
      return
    }

    setStoryFeedback('wrong')
  }

  if (screen === 'onboarding') {
    const selectedMotivationOption = motivationOptions.find((option) => option.id === selectedMotivation) ?? motivationOptions[0]
    const selectedStartingLevelOption = startingLevelOptions.find((option) => option.id === selectedStartingLevel) ?? startingLevelOptions[0]

    return (
      <main className="app-shell onboarding-shell">
        <section className="splash-panel" aria-labelledby="onboarding-title">
          <div className="logo-mark" aria-hidden="true">
            ಕ
          </div>
          {onboardingStep === 'welcome' && (
            <>
              <p className="eyebrow">Offline Kannada AI teacher</p>
              <h1 id="onboarding-title">KannadaOS</h1>
              <p className="lead">
                Real Bangalore Kannada for buses, autos, darshinis, offices, and daily life.
              </p>
              <button className="primary-action" onClick={() => setOnboardingStep('motivation')} type="button">
                Continue onboarding
              </button>
            </>
          )}

          {onboardingStep === 'motivation' && (
            <>
              <p className="eyebrow">Step 1 of 3</p>
              <h1 id="onboarding-title">Why are you learning Kannada?</h1>
              <div className="level-grid" aria-label="Choose learning motivation">
                {motivationOptions.map((option) => (
                  <button
                    className={selectedMotivation === option.id ? 'choice-card selected' : 'choice-card'}
                    key={option.id}
                    onClick={() => setSelectedMotivation(option.id)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
              <button className="primary-action" onClick={() => setOnboardingStep('level')} type="button">
                Next: choose level
              </button>
            </>
          )}

          {onboardingStep === 'level' && (
            <>
              <p className="eyebrow">Step 2 of 3 - {selectedMotivationOption.label}</p>
              <h1 id="onboarding-title">What is your current level?</h1>
              <div className="level-grid" aria-label="Choose Kannada level">
                {startingLevelOptions.map((option) => (
                  <button
                    className={selectedStartingLevel === option.id ? 'choice-card selected' : 'choice-card'}
                    key={option.id}
                    onClick={() => setSelectedStartingLevel(option.id)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    <small>{option.detail}</small>
                  </button>
                ))}
              </div>
              <button className="primary-action" onClick={() => setOnboardingStep('goal')} type="button">
                Next: set goal
              </button>
            </>
          )}

          {onboardingStep === 'goal' && (
            <>
              <p className="eyebrow">Step 3 of 3 - {selectedStartingLevelOption.label}</p>
              <h1 id="onboarding-title">Set a daily XP goal</h1>
              <div className="level-grid compact-grid" aria-label="Choose daily XP goal">
                {dailyGoalOptions.map((goal) => (
                  <button
                    className={selectedDailyGoalXp === goal ? 'choice-card selected' : 'choice-card'}
                    key={goal}
                    onClick={() => setSelectedDailyGoalXp(goal)}
                    type="button"
                  >
                    <span>{goal} XP</span>
                    <small>{goal <= 10 ? 'Light daily practice' : goal === 20 ? 'Focused beginner pace' : 'Intensive practice'}</small>
                  </button>
                ))}
              </div>
              <button className="primary-action" onClick={startLearning} type="button">
                Start Learning
              </button>
            </>
          )}
        </section>
      </main>
    )
  }

  if (screen === 'lesson') {
    if (lessonIndex >= lessonRunExercises.length) {
      const lessonAttemptCount = lessonCorrectCount + lessonWrongCount
      const lessonAccuracy = lessonAttemptCount > 0 ? Math.round((lessonCorrectCount / lessonAttemptCount) * 100) : 0
      const lessonTime = formatLessonDuration(completedLessonDurationMs)
      const newWordCount = new Set(activeLesson.exercises.flatMap((exercise) => exercise.vocabularyIds)).size

      return (
        <main className="app-shell lesson-shell">
          <section className="lesson-card lesson-complete" aria-labelledby="lesson-complete-title">
            <p className="eyebrow">lesson complete</p>
            <h1 id="lesson-complete-title">Lesson Complete!</h1>
            <div className="confetti-burst" aria-label="Confetti celebration">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="star-row" aria-label="Three stars earned">
              <span>★</span>
              <span>★</span>
              <span>★</span>
            </div>
            <article className="xp-card">
              <strong>+{totalLessonXp} XP</strong>
              <span>Total: {progress.xp} XP</span>
              <small>{activeLesson.title} mastery crown earned</small>
            </article>
            <div className="completion-stats">
              <Stat value={lessonAccuracy} label="Accuracy" />
              <Stat value={lessonCorrectCount} label="Correct" />
              <Stat value={lessonWrongCount} label="Wrong" />
              <Stat value={newWordCount} label="New words" />
              <Stat value={lessonTime} label="Time" />
            </div>
            <button className="primary-action" onClick={() => setScreen('app')} type="button">
              Continue
            </button>
          </section>
        </main>
      )
    }

    return (
      <main className="app-shell lesson-shell">
        <header className="lesson-topbar">
          <button className="icon-button" onClick={() => setScreen('app')} type="button" aria-label="Close lesson">
            x
          </button>
          <div
            className="lesson-progress"
            aria-label={`Lesson progress: ${completedInCurrentLesson} of ${lessonRunExercises.length} exercises complete`}
          >
            <span style={{ width: `${Math.max(12, (completedInCurrentLesson / lessonRunExercises.length) * 100)}%` }} />
          </div>
          <strong>Heart {progress.hearts}</strong>
        </header>
        <section className="lesson-card" aria-labelledby="lesson-title">
          <p className="eyebrow">
            <span>{activeExercise.type}</span>
            <small>{activeLesson.title}</small>
          </p>
          <h1 id="lesson-title">{activeExercise.prompt}</h1>
          {renderExerciseContent(activeExercise)}
          <button
            className="primary-action"
            disabled={!selectedAnswer}
            onClick={() => checkAnswer(activeExercise)}
            type="button"
          >
            Check
          </button>
          {feedback && (
            <div
              className={
                feedback === 'correct'
                  ? 'feedback correct'
                  : feedback === 'almost'
                    ? 'feedback almost'
                    : 'feedback wrong'
              }
              role="status"
            >
              <strong>
                {feedback === 'correct'
                  ? 'Correct'
                  : feedback === 'almost'
                    ? `Almost! Check: ${almostTypingDistance}`
                    : 'Try again'}
              </strong>
              <span>
                {feedback === 'correct'
                  ? `+${activeExercise.xp} XP`
                  : feedback === 'almost'
                    ? 'Fix the Kannada spelling and try again.'
                    : activeExercise.explanation}
              </span>
            </div>
          )}
          {feedback === 'correct' && (
            <button className="secondary-action" onClick={goToNextExercise} type="button">
              Next Exercise
            </button>
          )}
          {feedback === 'wrong' && (
            <button className="secondary-action" onClick={goToNextExercise} type="button">
              Continue. This question will return.
            </button>
          )}
        </section>
      </main>
    )
  }

  if (screen === 'models') {
    const models = modelSetupStarted ? activeSetupModels : pendingModels
    return (
      <main className="app-shell lesson-shell">
        <section className="lesson-card models-panel" aria-labelledby="model-setup-title">
          <button className="icon-button" onClick={() => setScreen('app')} type="button" aria-label="Back to app">
            x
          </button>
          <p className="eyebrow">model download</p>
          <h1 id="model-setup-title">Setting up your AI Teacher...</h1>
          <div className="model-grid">
            {models.map((model) => (
              <article className="model-card" key={model.name}>
                <div>
                  <span className="model-category">{model.category}</span>
                  <strong>{model.name}</strong>
                  <small>{model.required ? 'Required' : 'Optional'} - {model.size}</small>
                </div>
                <p>{model.description}</p>
                <div className="model-progress" aria-label={`${model.name} ${model.progress}%`}>
                  <span style={{ width: `${model.progress}%` }} />
                </div>
                <strong className={model.progress === 100 ? 'model-state downloaded' : 'model-state'}>
                  {model.status}
                </strong>
              </article>
            ))}
          </div>
          <p className="model-note">You can start learning while models download.</p>
          <button
            className="primary-action"
            disabled={modelSetupStarted}
            onClick={() => setModelSetupStarted(true)}
            type="button"
          >
            {modelSetupStarted ? 'Setup in Progress' : 'Start Model Setup'}
          </button>
          <section className="runtime-card" aria-labelledby="provider-title">
            <header className="runtime-header">
              <div>
                <span className="model-category">AI provider</span>
                <h2 id="provider-title">Choose Generation Provider</h2>
              </div>
              <span className="metric-pill">{formatProviderStatus(aiProviderSettings)}</span>
            </header>
            <div className="runtime-path-grid">
              <label className="runtime-field">
                <span>Active AI provider</span>
                <select
                  onChange={(event) =>
                    updateAiProviderSetting('activeProvider', event.target.value as AiProviderSettings['activeProvider'])
                  }
                  value={aiProviderSettings.activeProvider}
                >
                  <option value="local">Local first: Native, Ollama, Offline</option>
                  <option value="ollama">Ollama only</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="nvidia">NVIDIA hosted</option>
                </select>
              </label>
              <label className="runtime-field">
                <span>OpenRouter API key</span>
                <input
                  onChange={(event) => updateAiProviderSetting('openRouterApiKey', event.target.value)}
                  placeholder="sk-or-..."
                  type="password"
                  value={aiProviderSettings.openRouterApiKey}
                />
              </label>
              <label className="runtime-field">
                <span>OpenRouter model</span>
                <input
                  onChange={(event) => updateAiProviderSetting('openRouterModel', event.target.value)}
                  placeholder="openai/gpt-4o-mini"
                  value={aiProviderSettings.openRouterModel}
                />
              </label>
              <label className="runtime-field">
                <span>OpenRouter base URL</span>
                <input
                  onChange={(event) => updateAiProviderSetting('openRouterBaseUrl', event.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  value={aiProviderSettings.openRouterBaseUrl}
                />
              </label>
              <label className="runtime-field">
                <span>NVIDIA API key</span>
                <input
                  onChange={(event) => updateAiProviderSetting('nvidiaApiKey', event.target.value)}
                  placeholder="nvapi-..."
                  type="password"
                  value={aiProviderSettings.nvidiaApiKey}
                />
              </label>
              <label className="runtime-field">
                <span>NVIDIA model</span>
                <input
                  onChange={(event) => updateAiProviderSetting('nvidiaModel', event.target.value)}
                  placeholder="sarvamai/sarvam-m"
                  value={aiProviderSettings.nvidiaModel}
                />
              </label>
              <label className="runtime-field">
                <span>NVIDIA base URL</span>
                <input
                  onChange={(event) => updateAiProviderSetting('nvidiaBaseUrl', event.target.value)}
                  placeholder="https://integrate.api.nvidia.com/v1"
                  value={aiProviderSettings.nvidiaBaseUrl}
                />
              </label>
            </div>
            <p className="runtime-status" role="status">
              Current provider: {formatProviderStatus(aiProviderSettings)}.
            </p>
          </section>
          <section className="runtime-card" aria-labelledby="runtime-title">
            <header className="runtime-header">
              <div>
                <span className="model-category">native runtime</span>
                <h2 id="runtime-title">On-device Runtime</h2>
              </div>
              <span className="metric-pill">{runtimeSummary.statusText}</span>
            </header>
            <div className="runtime-path-grid">
              <label className="runtime-field">
                <span>Aya GGUF model path</span>
                <input
                  onChange={(event) => updateRuntimePath('llmModelPath', event.target.value)}
                  placeholder="/models/aya-8b-q4_K_M.gguf"
                  value={runtimeConfig.llmModelPath}
                />
              </label>
              <label className="runtime-field">
                <span>Llama.cpp executable path</span>
                <input
                  onChange={(event) => updateRuntimePath('llamaBinaryPath', event.target.value)}
                  placeholder="/usr/local/bin/llama-cli"
                  value={runtimeConfig.llamaBinaryPath}
                />
              </label>
              <label className="runtime-field">
                <span>Whisper model path</span>
                <input
                  onChange={(event) => updateRuntimePath('whisperModelPath', event.target.value)}
                  placeholder="/models/whisper-small.bin"
                  value={runtimeConfig.whisperModelPath}
                />
              </label>
              <label className="runtime-field">
                <span>Whisper.cpp executable path</span>
                <input
                  onChange={(event) => updateRuntimePath('whisperBinaryPath', event.target.value)}
                  placeholder="/usr/local/bin/whisper-cli"
                  value={runtimeConfig.whisperBinaryPath}
                />
              </label>
              <label className="runtime-field">
                <span>Piper voice path</span>
                <input
                  onChange={(event) => updateRuntimePath('piperVoicePath', event.target.value)}
                  placeholder="/models/kn_IN-piper-medium.onnx"
                  value={runtimeConfig.piperVoicePath}
                />
              </label>
              <label className="runtime-field">
                <span>Piper executable path</span>
                <input
                  onChange={(event) => updateRuntimePath('piperBinaryPath', event.target.value)}
                  placeholder="/usr/local/bin/piper"
                  value={runtimeConfig.piperBinaryPath}
                />
              </label>
            </div>
            <button
              className="primary-action runtime-check"
              disabled={runtimeCheckStatus === 'checking'}
              onClick={checkLocalRuntime}
              type="button"
            >
              {runtimeCheckStatus === 'checking' ? 'Checking Runtime' : 'Check Local Runtime'}
            </button>
            <button
              className="secondary-action runtime-check"
              disabled={runtimeSmokeStatus === 'checking'}
              onClick={runRuntimeSmoke}
              type="button"
            >
              {runtimeSmokeStatus === 'checking' ? 'Running Runtime Smoke' : 'Run Runtime Smoke'}
            </button>
            {runtimeCheckStatus === 'checked' && (
              <p className="runtime-status" role="status">
                Local runtime scan complete.
              </p>
            )}
            {runtimeCheckStatus === 'error' && (
              <p className="runtime-status error" role="status">
                Local runtime scan failed.
              </p>
            )}
            {runtimeSmokeStatus === 'error' && (
              <p className="runtime-status error" role="status">
                Native runtime smoke failed.
              </p>
            )}
            {runtimeSmokeSummary && (
              <section className="runtime-smoke" aria-label="Runtime smoke results">
                <strong>{runtimeSmokeSummary.statusText}</strong>
                <div className="runtime-component-grid">
                  {runtimeSmokeSummary.components.map((component) => (
                    <article className="runtime-component-card" key={component.id}>
                      <span className="model-category">{component.label}</span>
                      <strong className={component.ok ? 'model-state downloaded' : 'model-state'}>
                        {component.status}
                      </strong>
                      <p>{component.nextAction}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
            <div className="runtime-component-grid">
              {runtimeSummary.components.map((component) => (
                <article className="runtime-component-card" key={component.id}>
                  <span className="model-category">{component.label}</span>
                  <strong className={component.ready ? 'model-state downloaded' : 'model-state'}>
                    {component.status}
                  </strong>
                  {component.modelPath && <small>{component.modelPath}</small>}
                  {component.binaryPath && <small>{component.binaryPath}</small>}
                  <p>{component.nextAction}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    )
  }

  const navDueReviewCount = getDueReviewItems(progress, new Date().toISOString()).length

  return (
    <main className="desktop-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark">ಕ</span>
            <div>
              <strong>KannadaOS</strong>
              <p>ಕನ್ನಡ ಕಲಿಯಿರಿ</p>
              <small>Learn Kannada</small>
            </div>
          </div>
          <nav className="nav-stack">
            {[
              ['home', 'Dashboard'],
              ['learn', 'Learn'],
              ['chat', 'Chat'],
              ['practice', 'Practice'],
              ['stories', 'Stories'],
              ['blr', 'BLR'],
              ['me', 'Me'],
            ].map(([id, label]) => {
              const showStreakBadge = id === 'home' && progress.streakDays > 0
              const showReviewBadge = id === 'practice' && navDueReviewCount > 0
              const navLabel = [
                label,
                showStreakBadge ? 'streak active' : '',
                showReviewBadge ? `${navDueReviewCount} due ${navDueReviewCount === 1 ? 'review' : 'reviews'}` : '',
              ].filter(Boolean).join(', ')

              return (
                <button
                  aria-label={navLabel}
                  className={tab === id ? 'nav-button active' : 'nav-button'}
                  key={id}
                  onClick={() => setTab(id as Tab)}
                  type="button"
                >
                  <span className="nav-label">{label}</span>
                  {showStreakBadge && <span aria-hidden="true" className="nav-flame">🔥</span>}
                  {showReviewBadge && <span aria-hidden="true" className="nav-badge">{navDueReviewCount}</span>}
                </button>
              )
            })}
          </nav>
        </div>
        <section className="model-status">
          <span>AI model</span>
          <strong>{formatCurrentAiModelStatus(aiProviderSettings, ollamaStatus)}</strong>
          <button className="secondary-action" onClick={generateAiExercise} type="button">
            Generate AI Exercise
          </button>
          <button className="secondary-action" onClick={() => setScreen('models')} type="button">
            Manage Models
          </button>
          {generatedExercise && <p><ReadableStatusText text={generatedExercise} /></p>}
          {aiExpansionDeck.length > 0 && (
            <div className="ai-expansion-queue" aria-label="AI curriculum expansion">
              <strong>AI Expansion Queue</strong>
              <span>
                {aiExpansionDeck.length} saved {aiExpansionDeck.length === 1 ? 'drill' : 'drills'} for curriculum review
              </span>
              <ul>
                {aiExpansionDeck.slice(0, 3).map((exercise, index) => (
                  <li key={`${exercise.prompt}-${index}`}>
                    <span>{exercise.prompt}</span>
                    <ChoiceText text={exercise.kannada} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </aside>
      <section className="workspace">{renderTab()}</section>
    </main>
  )

  function renderTab() {
    if (tab === 'learn') {
      const unlockedUnitIds = new Set(getUnlockedCurriculumUnits(allCurriculumUnits, progress).map((unit) => unit.id))
      const activeTipsUnit = allCurriculumUnits.find((unit) => unit.id === tipsUnitId) ?? null

      return (
        <section className="panel learn-panel" aria-labelledby="learn-title">
          <header className="section-header">
            <div>
              <p className="eyebrow">Curriculum tree</p>
              <h2 id="learn-title">Learn Kannada</h2>
            </div>
            <span className="metric-pill">{progress.xp} XP</span>
          </header>
          <section className="level-map expanded" aria-label="Learn curriculum tree">
            {allCurriculumUnits.map((unit, mapUnitIndex) => {
              const unlockedUnit = unlockedUnitIds.has(unit.id)
              const unitNumber = unit.optional ? 0 : coreCurriculumUnits.findIndex((coreUnit) => coreUnit.id === unit.id) + 1
              return (
                <article
                  className={unlockedUnit ? 'map-node unit-node current' : 'map-node unit-node locked'}
                  key={unit.id}
                >
                  <span>{unit.optional ? 'ಅ' : unlockedUnit ? '★' : 'lock'}</span>
                  <strong>Unit {unitNumber}: {unit.title}</strong>
                  <small>{unit.description}</small>
                  <button className="secondary-action compact-action" onClick={() => setTipsUnitId(unit.id)} type="button">
                    Tips
                  </button>
                  <div className="lesson-dot-row">
                    {unit.lessons.map((lesson, unitLessonIndex) => {
                      const lessonProgress = getLessonProgressSummary(progress, lesson.id)
                      const unlocked = unit.optional || isLessonUnlocked(lesson.id, progress)
                      return (
                        <button
                          aria-label={`Learn unit ${mapUnitIndex + 1} lesson ${unitLessonIndex + 1}: ${lesson.title}, ${lessonProgress.masteryLevel} crowns`}
                          className={lessonProgress.completed ? 'lesson-dot done' : unlocked ? 'lesson-dot current' : 'lesson-dot locked'}
                          disabled={!unlocked}
                          key={lesson.id}
                          onClick={() => openLesson(lesson.id)}
                          type="button"
                        >
                          {lessonProgress.masteryLevel || (unlocked ? '•' : 'x')}
                        </button>
                      )
                    })}
                  </div>
                </article>
              )
            })}
          </section>
          {activeTipsUnit && (
            <section className="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-modal-title">
              <div className="tips-modal-body">
                <header className="section-header compact-header">
                  <div>
                    <p className="eyebrow">grammar tips</p>
                    <h3 id="tips-modal-title">Tips: {activeTipsUnit.title}</h3>
                  </div>
                  <button className="icon-button" onClick={() => setTipsUnitId(null)} type="button" aria-label="Close tips">
                    x
                  </button>
                </header>
                {activeTipsUnit.tips.map((tip) => (
                  <article className="tip-row" key={tip.title}>
                    <strong>{tip.title}</strong>
                    <p>{tip.body}</p>
                    <small>{tip.examples.map(formatReadableExample).join(' / ')}</small>
                  </article>
                ))}
                <button className="primary-action" onClick={() => openLesson(activeTipsUnit.lessons[0].id)} type="button">
                  Start lesson
                </button>
              </div>
            </section>
          )}
        </section>
      )
    }

    if (tab === 'chat') {
      return (
        <section className="panel chat-panel" aria-labelledby="chat-title">
          <header className="section-header">
            <div>
              <p className="eyebrow">{selectedTutorPersona.name} - {selectedScenario.difficulty}</p>
              <h2 id="chat-title">{selectedScenario.title}</h2>
            </div>
            <button className="secondary-action" onClick={recordVoiceInput} type="button">
              {recordingTarget === 'chat' ? 'Stop Recording' : 'Record Voice'}
            </button>
          </header>
          <div className="scenario-picker" aria-label="Chat scenarios">
            {bangaloreScenarios.map((scenario) => (
              <button
                className={selectedScenario.id === scenario.id ? 'selector-chip active' : 'selector-chip'}
                key={scenario.id}
                onClick={() => selectChatScenario(scenario.id)}
                type="button"
              >
                <strong>{scenario.title}</strong>
                <small>{scenario.difficulty}</small>
              </button>
            ))}
          </div>
          <div className="persona-picker" aria-label="Tutor personalities">
            {tutorPersonas.map((persona) => (
              <button
                className={selectedTutorPersona.id === persona.id ? 'selector-chip active' : 'selector-chip'}
                key={persona.id}
                onClick={() => setSelectedTutorPersonaId(persona.id)}
                type="button"
              >
                <strong>{persona.name}</strong>
                <small>{persona.correctionStyle}</small>
              </button>
            ))}
          </div>
          <div className="chat-stream" aria-live="polite">
            {chatMessages.map((message) => (
              <article className={`message ${message.speaker}`} key={message.id}>
                <p>{message.text}</p>
                <SubtitleLines text={message.text} />
                {message.subtext && (
                  <small className="message-subtext">
                    <span>{message.subtext}</span>
                    <SubtitleLines text={message.subtext} />
                  </small>
                )}
              </article>
            ))}
          </div>
          {voiceStatus && (
            <p className="voice-status" role="status">
              <ReadableStatusText text={voiceStatus} />
            </p>
          )}
          <div className="suggestion-row">
            {selectedScenario.usefulPhrases.map((phrase) => (
              <button key={phrase.id} onClick={() => setChatInput(phrase.kannada)} type="button">
                <strong lang="kn">{phrase.kannada}</strong>
                <span className="kannada-subtitles">
                  <small className="romanization">{phrase.transliteration}</small>
                  <small className="english-subtitle">{phrase.english}</small>
                </span>
              </button>
            ))}
          </div>
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault()
              void sendChatMessage()
            }}
          >
            <input
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Type in Kannada or English..."
              value={chatInput}
            />
            <button className="primary-action" type="submit">
              Send
            </button>
          </form>
        </section>
      )
    }

    if (tab === 'practice') {
      const now = new Date().toISOString()
      const dueReviewIds = getDueReviewItems(progress, now)
      const weakSkillSummaries = getWeakSkillSummaries(progress)
      const adaptiveDifficulty = getAdaptiveDifficulty(progress, now)
      const dueReviewPhrases = dueReviewIds
        .map((vocabularyId) => getPhraseByVocabularyId(vocabularyId))
        .filter((phrase): phrase is Phrase => Boolean(phrase))
      const card = dueReviewPhrases[0] ?? survivalPhrases.find((phrase) => phrase.id === 'hogbeku')!
      const cardReview = progress.reviewQueue[card.id]
      const activeReviewPhrase = getPhraseByVocabularyId(reviewSessionIds[reviewIndex] ?? '')
      const reviewComplete = reviewSessionIds.length > 0 && reviewIndex >= reviewSessionIds.length
      const reviewOptions = activeReviewPhrase ? buildReviewOptions(activeReviewPhrase) : []
      return (
        <section className="panel" aria-labelledby="practice-title">
          <header className="section-header">
            <div>
              <p className="eyebrow">{weakSkillSummaries.length} weak areas</p>
              <h2 id="practice-title">Practice</h2>
            </div>
            <span className="metric-pill">
              {dueReviewIds.length} {dueReviewIds.length === 1 ? 'word' : 'words'} due today
            </span>
          </header>
          {reviewSessionIds.length > 0 && (
            <section className="review-session" aria-labelledby="review-session-title">
              {reviewComplete ? (
                <article className="review-complete-card">
                  <p className="eyebrow">review complete</p>
                  <h2 id="review-session-title">Review Complete</h2>
                  <strong>+{reviewCorrectCount} XP</strong>
                  <p>{reviewCorrectCount} of {reviewSessionIds.length} due {reviewSessionIds.length === 1 ? 'word' : 'words'} answered correctly.</p>
                  <button className="secondary-action" onClick={resetReviewSession} type="button">
                    Back to Practice
                  </button>
                </article>
              ) : activeReviewPhrase ? (
                <>
                  <header className="runtime-header compact-header">
                    <div>
                      <p className="eyebrow">due reviews</p>
                      <h2 id="review-session-title">Review Session</h2>
                    </div>
                    <span className="metric-pill">{reviewIndex + 1} of {reviewSessionIds.length}</span>
                  </header>
                  <div
                    className="lesson-progress review-session-progress"
                    aria-label={`Review progress: ${reviewIndex + 1} of ${reviewSessionIds.length} due words`}
                  >
                    <span style={{ width: `${Math.max(12, ((reviewIndex + 1) / reviewSessionIds.length) * 100)}%` }} />
                  </div>
                  <div className="phrase-card review-card">
                    <small>Choose the meaning</small>
                    <strong lang="kn">{activeReviewPhrase.kannada}</strong>
                    <span className="kannada-subtitles">
                      <small className="romanization">{activeReviewPhrase.transliteration}</small>
                      <small className="english-subtitle">{activeReviewPhrase.english}</small>
                      <small>{activeReviewPhrase.context}</small>
                    </span>
                  </div>
                  <div className="option-stack review-session-options" aria-label="Review answers">
                    {reviewOptions.map((option) => (
                      <button
                        className={reviewSelectedAnswer === option ? 'answer-option selected' : 'answer-option'}
                        disabled={reviewFeedback !== null}
                        key={option}
                        onClick={() => setReviewSelectedAnswer(option)}
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary-action"
                    disabled={!reviewSelectedAnswer || reviewFeedback !== null}
                    onClick={() => checkReviewAnswer(activeReviewPhrase)}
                    type="button"
                  >
                    Check Review
                  </button>
                  {reviewFeedback && (
                    <div className={reviewFeedback === 'correct' ? 'feedback correct' : 'feedback wrong'} role="status">
                      <strong>{reviewFeedback === 'correct' ? 'Correct' : 'Try again'}</strong>
                      <span>{reviewFeedback === 'correct' ? '+1 XP' : 'No hearts lost. This word will return soon.'}</span>
                    </div>
                  )}
                  {reviewFeedback && (
                    <button className="secondary-action" onClick={goToNextReview} type="button">
                      {reviewIndex + 1 >= reviewSessionIds.length ? 'Finish Review' : 'Next Review'}
                    </button>
                  )}
                </>
              ) : (
                <article className="review-complete-card">
                  <h2 id="review-session-title">Review unavailable</h2>
                  <p>This due word is no longer in the local curriculum.</p>
                  <button className="secondary-action" onClick={resetReviewSession} type="button">
                    Back to Practice
                  </button>
                </article>
              )}
            </section>
          )}
          <div className="review-layout">
            <div className="flashcard-stack">
              <button className="flashcard" onClick={() => setFlashcardBack((value) => !value)} type="button">
                <span lang="kn">{card.kannada}</span>
                <small className="romanization">{card.transliteration}</small>
                {!flashcardBack && <small className="english-subtitle">{card.english}</small>}
                <strong>{flashcardBack ? card.english : card.transliteration}</strong>
                {flashcardBack ? (
                  <>
                    <small>{card.context}</small>
                    <small>Skill: {formatSkillTagLabel(card.skillTag)}</small>
                    <small>Leitner Box: {cardReview?.leitnerBox ?? 1}</small>
                    <small>Next review: {formatFlashcardNextReview(cardReview, now)}</small>
                  </>
                ) : (
                  <>
                    <small>Context: {card.context}</small>
                    <small>Tap to flip</small>
                  </>
                )}
              </button>
              <button className="mini-button" onClick={() => void playFlashcardAudio(card)} type="button">
                Play Audio
              </button>
              {isFlashcardAudioStatus(audioStatus) && <p role="status"><ReadableStatusText text={audioStatus} /></p>}
              <div className="review-rating-row" aria-label="Flashcard rating">
                {[
                  ['hard', 'Hard'],
                  ['okay', 'Okay'],
                  ['easy', 'Easy'],
                ].map(([rating, label]) => (
                  <button className="secondary-action compact-action" key={rating} onClick={() => rateFlashcard(card.id, rating as ReviewRating)} type="button">
                    {label}
                  </button>
                ))}
              </div>
              <small className="review-strength">
                Strength {Math.round((cardReview?.strength ?? 0.2) * 100)}%
              </small>
            </div>
            <div className="practice-stack">
              <article className="accent-card saffron">
                <strong>Adaptive difficulty: {titleCase(adaptiveDifficulty.level)}</strong>
                <p>{adaptiveDifficulty.reason}</p>
              </article>
              <article className="accent-card rose">
                <strong>Due Review Queue</strong>
                <p>{formatDueReviewSummary(dueReviewIds, progress)}</p>
                <button
                  className="secondary-action compact-action"
                  disabled={!dueReviewPhrases.length}
                  onClick={() => startReviewSession(dueReviewIds)}
                  type="button"
                >
                  Start Review
                </button>
              </article>
              {weakSkillSummaries.length > 0 ? (
                weakSkillSummaries.map((skill) => (
                  <article className="accent-card purple" key={skill.skillTag}>
                    <strong>{skill.label} needs review</strong>
                    <p>{skill.mistakes} recent {skill.mistakes === 1 ? 'miss' : 'misses'} - {skill.priority} priority</p>
                  </article>
                ))
              ) : (
                <article className="accent-card purple">
                  <strong>Pronunciation Practice</strong>
                  <p>5 phrases with waveform scoring</p>
                </article>
              )}
              <article className="accent-card saffron">
                <strong>AI Exercises</strong>
                <p>Targets your weakest skill with Ollama or local fallback.</p>
              </article>
            </div>
          </div>
          <section className="pronunciation-lab" aria-labelledby="pronunciation-lab-title">
            <header className="runtime-header">
              <div>
                <p className="eyebrow">speech practice</p>
                <h2 id="pronunciation-lab-title">Pronunciation Lab</h2>
              </div>
              <span className="metric-pill">
                {latestPronunciationAttempt ? `Last score ${latestPronunciationAttempt.score}` : 'No attempts yet'}
              </span>
            </header>
            <div className="pronunciation-phrase-grid" aria-label="Pronunciation phrases">
              {pronunciationPhrases.map((phrase) => (
                <button
                  className={activePronunciationPhrase.id === phrase.id ? 'selector-chip active' : 'selector-chip'}
                  key={phrase.id}
                  onClick={() => selectPronunciationPhrase(phrase.id)}
                  type="button"
                >
                  <strong lang="kn">{phrase.kannada}</strong>
                  <span className="kannada-subtitles">
                    <small className="romanization">{phrase.transliteration}</small>
                    <small className="english-subtitle">{phrase.english}</small>
                  </span>
                </button>
              ))}
            </div>
            <article className="pronunciation-target">
              <div>
                <span className="model-category">target phrase</span>
                <strong lang="kn">{activePronunciationPhrase.kannada}</strong>
                <span className="kannada-subtitles">
                  <small className="romanization">{activePronunciationPhrase.transliteration}</small>
                  <small className="english-subtitle">{activePronunciationPhrase.english}</small>
                </span>
              </div>
              <div className="waveform compact" aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => (
                  <span key={index} style={{ height: `${18 + ((index * 11) % 42)}px` }} />
                ))}
              </div>
            </article>
            <div className="pronunciation-controls">
              <button className="secondary-action" onClick={() => void playPronunciationReference()} type="button">
                Play Reference
              </button>
              <button className="secondary-action" onClick={() => void playPronunciationReference(0.7)} type="button">
                Play Slow
              </button>
              <button className="secondary-action" onClick={recordPronunciationAudio} type="button">
                {recordingTarget === 'pronunciation' ? 'Stop Recording' : 'Record Pronunciation'}
              </button>
              <label className="transcript-field">
                <span>Audio file path</span>
                <input
                  onChange={(event) => setPronunciationAudioPath(event.target.value)}
                  placeholder="/recordings/namaskara.wav"
                  value={pronunciationAudioPath}
                />
              </label>
              <button className="secondary-action" onClick={transcribePronunciationAudio} type="button">
                Transcribe with Whisper
              </button>
              <label className="transcript-field">
                <span>Transcribed speech</span>
                <input
                  onChange={(event) => setPronunciationTranscript(event.target.value)}
                  value={pronunciationTranscript}
                />
              </label>
              <button className="primary-action" onClick={scorePronunciationPractice} type="button">
                Score Pronunciation
              </button>
            </div>
            {pronunciationAudioStatus && (
              <p className="voice-status" role="status">
                <ReadableStatusText text={pronunciationAudioStatus} />
              </p>
            )}
            {pronunciationResult && (
              <article className="pronunciation-result" aria-label="Pronunciation result">
                <strong>Score {pronunciationResult.score}</strong>
                <p>{pronunciationResult.feedback}</p>
                <span>
                  {pronunciationResult.problemParts.length
                    ? `Problem syllables: ${pronunciationResult.problemParts.join(', ')}`
                    : 'No problem syllables'}
                </span>
                {pronunciationResult.problemParts.length > 0 && (
                  <SubtitleLines text={pronunciationResult.problemParts.join(' ')} />
                )}
                <small>{pronunciationResult.tip}</small>
              </article>
            )}
            {latestPronunciationAttempt && (
              <p className="pronunciation-history">
                <ReadableStatusText text={`Latest attempt: ${latestPronunciationAttempt.transcript}`} />
              </p>
            )}
          </section>
        </section>
      )
    }

    if (tab === 'stories') {
      if (storyMode === 'reader') {
        return (
          <section className="panel story-reader-panel" aria-labelledby="story-reader-title">
            <header className="section-header">
              <div>
                <p className="eyebrow">{activeStory.subtitle}</p>
                <h2 id="story-reader-title">{activeStory.title}</h2>
              </div>
              <button className="secondary-action" onClick={() => setStoryMode('list')} type="button">
                Back to Stories
              </button>
            </header>
            <div className="story-sentence-stack">
              {activeStory.sentences.map((sentence, index) => (
                <article className="story-sentence-card" key={sentence.id}>
                  <span className="metric-pill">Sentence {index + 1}</span>
                  <strong lang="kn">{sentence.kannada}</strong>
                  <em>{sentence.transliteration}</em>
                  <p>{sentence.english}</p>
                  <div className="story-word-row">
                    {sentence.words.map((word) => (
                      <button
                        className="word-token"
                        key={`${sentence.id}-${word.text}`}
                        onClick={() => setSelectedStoryWord(word)}
                        type="button"
                      >
                        <span lang="kn">{word.text}</span>
                        <small>{word.transliteration}</small>
                        <small className="english-subtitle">{word.english}</small>
                      </button>
                    ))}
                  </div>
                  <button className="mini-button" type="button">
                    Play sentence audio
                  </button>
                </article>
              ))}
            </div>
            {selectedStoryWord && (
              <aside className="word-popover" role="dialog" aria-label={selectedStoryWord.text}>
                <div>
                  <strong lang="kn">{selectedStoryWord.text}</strong>
                  <span className="kannada-subtitles">
                    <small className="romanization">{selectedStoryWord.transliteration}</small>
                    <small className="english-subtitle">{selectedStoryWord.english}</small>
                  </span>
                </div>
                <p>{selectedStoryWord.english}</p>
                <small>{selectedStoryWord.note}</small>
                <button className="secondary-action" type="button">
                  Add to Vocabulary
                </button>
              </aside>
            )}
            <button className="primary-action" onClick={() => setStoryMode('quiz')} type="button">
              Take Quiz
            </button>
          </section>
        )
      }

      if (storyMode === 'quiz') {
        return (
          <section className="panel story-reader-panel" aria-labelledby="story-quiz-title">
            <header className="section-header">
              <div>
                <p className="eyebrow">story quiz</p>
                <h2 id="story-quiz-title">{activeStory.title}</h2>
              </div>
              <span className="metric-pill">+20 XP</span>
            </header>
            <article className="story-quiz-card">
              <h3>{activeStory.quiz.prompt}</h3>
              <div className="option-stack">
                {activeStory.quiz.options.map((option) => (
                  <button
                    className={selectedStoryAnswer === option ? 'answer-option selected' : 'answer-option'}
                    key={option}
                    onClick={() => setSelectedStoryAnswer(option)}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                className="primary-action"
                disabled={!selectedStoryAnswer}
                onClick={checkStoryAnswer}
                type="button"
              >
                Check Story Answer
              </button>
              {storyFeedback === 'wrong' && (
                <div className="feedback wrong" role="status">
                  <strong>Try again</strong>
                  <span>{activeStory.quiz.explanation}</span>
                </div>
              )}
            </article>
          </section>
        )
      }

      if (storyMode === 'complete') {
        return (
          <section className="panel story-reader-panel" aria-labelledby="story-complete-title">
            <article className="lesson-card lesson-complete">
              <p className="eyebrow">story complete</p>
              <h2 id="story-complete-title">Story Complete</h2>
              <div className="star-row" aria-label="Three stars earned">
                <span>★</span>
                <span>★</span>
                <span>★</span>
              </div>
              <article className="xp-card">
                <strong>+20 XP</strong>
                <span>Total: {progress.xp} XP</span>
              </article>
              <button className="primary-action" onClick={() => setStoryMode('list')} type="button">
                Continue Stories
              </button>
            </article>
          </section>
        )
      }

      return (
        <section className="panel" aria-labelledby="stories-title">
          <header className="section-header">
            <div>
              <p className="eyebrow">Story Mode</p>
              <h2 id="stories-title">Stories</h2>
            </div>
            <span className="metric-pill">
              {stories.filter((story) => !getStoryLockState(story, progress).locked).length} unlocked
            </span>
          </header>
          <div className="story-grid">
            {stories.map((story) => {
              const lockState = getStoryLockState(story, progress)
              return (
                <article className={lockState.locked ? 'story-card locked' : 'story-card'} key={story.id}>
                  <img src={story.imagePath} alt="" />
                  <div className="story-card-body">
                    <span className={`difficulty-badge ${story.difficulty.toLowerCase()}`}>{story.difficulty}</span>
                    <h3>{story.title}</h3>
                    <p>{story.subtitle}</p>
                    <div className="story-meta">
                      <span>{story.readTimeMinutes} min read</span>
                      <span>{story.newWordCount} new words</span>
                    </div>
                    {lockState.locked ? (
                      <span className="locked-label">{lockState.reason}</span>
                    ) : (
                      <button
                        className="secondary-action"
                        onClick={() => openStory(story.id)}
                        type="button"
                      >
                        Read {story.title}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )
    }

    if (tab === 'blr') {
      if (activeBangaloreScenario) {
        const scenario = activeBangaloreScenario
        const checkedItems = progress.scenarioChecklist[scenario.id] ?? []
        const correctReply = scenario.usefulPhrases[0]
        const dialogueOptions = [
          correctReply,
          {
            id: `${scenario.id}-name-distractor`,
            kannada: 'ನನ್ನ ಹೆಸರು ರಾಹುಲ್',
            transliteration: 'nanna hesaru Rahul',
            english: 'My name is Rahul',
            context: 'A polite introduction, but not the answer to this scenario.',
            skillTag: 'introductions',
          },
          {
            id: `${scenario.id}-lunch-distractor`,
            kannada: 'ಊಟ ಆಯ್ತಾ?',
            transliteration: 'oota aayta?',
            english: 'Did you eat?',
            context: 'Useful small talk, but not the answer to this scenario.',
            skillTag: 'culture',
          },
        ]

        return (
          <section className="panel scenario-detail-panel" aria-labelledby="blr-title">
            <header className="section-header">
              <div>
                <p className="eyebrow">Bangalore Mode</p>
                <h2 id="blr-title">{scenario.icon} {scenario.title}</h2>
              </div>
              <button className="secondary-action compact-action" onClick={() => setActiveBangaloreScenarioId(null)} type="button">
                Back
              </button>
            </header>
            <article className="scenario-detail-card">
              <p>{`Situation: ${scenario.situation}`}</p>
            </article>
            <section className="scenario-detail-grid">
              <article className="scenario-detail-card">
                <h3>Checklist</h3>
                <ul className="scenario-checklist" aria-label={`${scenario.title} checklist`}>
                  {scenario.checklist.map((item) => {
                    const checked = checkedItems.includes(item)
                    return (
                      <li key={item}>
                        <label>
                          <input
                            checked={checked}
                            onChange={() => toggleScenarioChecklist(scenario.id, item)}
                            type="checkbox"
                          />
                          <span>{item}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </article>
              <article className="scenario-detail-card">
                <h3>Useful Phrases</h3>
                <div className="scenario-phrase-list" aria-label={`${scenario.title} useful phrases`}>
                  {scenario.usefulPhrases.map((phrase) => (
                    <div className="scenario-phrase-row" key={phrase.id}>
                      <strong lang="kn">{phrase.kannada}</strong>
                      <span className="kannada-subtitles">
                        <small className="romanization">{phrase.transliteration}</small>
                        <small className="english-subtitle">{phrase.english}</small>
                      </span>
                      <div className="scenario-action-row">
                        <button className="mini-button" onClick={() => void playScenarioPhraseAudio(phrase)} type="button">
                          Play {phrase.transliteration}
                        </button>
                        <button className="mini-button" onClick={() => practiceScenarioPhrase(phrase)} type="button">
                          Practice {phrase.transliteration}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} /></p>}
              </article>
              <article className="scenario-detail-card dialogue-practice-card">
                <h3>Dialogue Practice</h3>
                <p>{`Driver: ${scenario.openingLine.kannada}`}</p>
                <span className="kannada-subtitles">
                  <small className="romanization">{scenario.openingLine.transliteration}</small>
                  <small className="english-subtitle">{scenario.openingLine.english}</small>
                </span>
                <fieldset>
                  <legend>Your reply</legend>
                  {dialogueOptions.map((option) => (
                    <label className="dialogue-option" key={option.id}>
                      <input
                        checked={scenarioDialogueAnswer === option.kannada}
                        name={`${scenario.id}-dialogue-reply`}
                        onChange={() => {
                          setScenarioDialogueAnswer(option.kannada)
                          setScenarioDialogueFeedback('')
                        }}
                        type="radio"
                      />
                      <span lang="kn">{option.kannada}</span>
                      <small className="romanization">{option.transliteration}</small>
                      <small className="english-subtitle">{option.english}</small>
                    </label>
                  ))}
                </fieldset>
                <button
                  className="secondary-action"
                  disabled={!scenarioDialogueAnswer}
                  onClick={() => checkScenarioDialogue(scenario)}
                  type="button"
                >
                  Check Dialogue
                </button>
                {scenarioDialogueFeedback && <p role="status">{scenarioDialogueFeedback}</p>}
              </article>
            </section>
            <button
              className="primary-action"
              onClick={() => {
                selectChatScenario(scenario.id)
                setTab('chat')
              }}
              type="button"
            >
              Open in Chat
            </button>
          </section>
        )
      }

      return (
        <section className="panel" aria-labelledby="blr-title">
          <header className="section-header">
            <div>
              <p className="eyebrow">Bangalore Mode</p>
              <h2 id="blr-title">Slang of the Day</h2>
            </div>
            <span className="metric-pill">swalpa adjust maadi</span>
          </header>
          <article className="blr-hero">
            <h3>Swalpa adjust maadi</h3>
            <p>Please adjust a little. Use it in crowds, shared autos, queues, and PG life.</p>
          </article>
          <div className="scenario-grid">
            {bangaloreScenarios.map((scenario) => {
              const checkedCount = (progress.scenarioChecklist[scenario.id] ?? []).length
              return (
                <article className="scenario-card" key={scenario.id}>
                  <span>{scenario.icon}</span>
                  <strong>{scenario.title}</strong>
                  <small>{scenario.difficulty}</small>
                  <p>{scenario.situation}</p>
                  <small>Checklist: {checkedCount}/{scenario.checklist.length}</small>
                  <button className="secondary-action" onClick={() => openBangaloreScenario(scenario.id)} type="button">
                    Start {scenario.title}
                  </button>
                  <button
                    className="secondary-action compact-action"
                    onClick={() => {
                      selectChatScenario(scenario.id)
                      setTab('chat')
                    }}
                    type="button"
                  >
                    Open {scenario.title} in chat
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      )
    }

    if (tab === 'me') {
      const achievementSummaries = getAchievementSummaries(progress)
      const learnedWordCount = Object.keys(progress.reviewQueue).length
      const completedLessonCount = Object.keys(progress.lessonProgress).length
      const completedStoryCount = getCompletedStoryCount(progress)
      const totalPracticeTime = formatProfilePracticeTime(progress.totalPracticeTimeMs)
      const learnerLevel = Math.max(4, Math.floor(progress.xp / 80) + 1)
      return (
        <section className="panel" aria-labelledby="profile-title">
          <header className="profile-header">
            <div className="avatar">R</div>
            <div>
              <h2 id="profile-title">Rahul</h2>
              <p>Level {learnerLevel} Learner</p>
              <strong>{progress.streakDays} day streak</strong>
            </div>
          </header>
          <div className="stats-grid" data-testid="profile-stats">
            <Stat value={progress.xp} label="XP" />
            <Stat value={learnedWordCount} label="Words" />
            <Stat value={progress.streakDays} label="Streak" />
            <Stat value={completedLessonCount} label="Lessons" />
            <Stat value={completedStoryCount} label="Stories" />
            <Stat value={totalPracticeTime} label="Time" />
          </div>
          <section className="chart-card" aria-label="Progress chart">
            <span style={{ height: '32%' }} />
            <span style={{ height: '56%' }} />
            <span style={{ height: '44%' }} />
            <span style={{ height: '72%' }} />
            <span style={{ height: '64%' }} />
            <span style={{ height: '86%' }} />
          </section>
          <div className="achievement-grid" aria-label="Achievements">
            {achievementSummaries.map((achievement) => (
              <article
                className={achievement.unlocked ? 'achievement-card unlocked' : 'achievement-card'}
                key={achievement.code}
              >
                <strong>{achievement.name}</strong>
                <span>{achievement.unlocked ? 'Unlocked' : 'Locked'}</span>
                <small>{achievement.description}</small>
                <p>{achievement.progressLabel}</p>
              </article>
            ))}
          </div>
          <section className="reminder-card" aria-labelledby="daily-reminder-title">
            <div>
              <span className="model-category">notifications</span>
              <h3 id="daily-reminder-title">Daily Reminder</h3>
              <p>
                {reminder.enabled ? `Reminder On - ${reminder.time}` : 'Reminder Off'}
              </p>
              <small>
                {reminder.permission === 'granted'
                  ? 'Alerts allowed'
                  : reminder.permission === 'denied'
                    ? 'Alerts blocked'
                    : 'Alerts waiting for permission'}
              </small>
            </div>
            <div className="reminder-actions">
              <button className="secondary-action" onClick={toggleDailyReminder} type="button">
                {reminder.enabled ? 'Disable Daily Reminder' : 'Enable Daily Reminder'}
              </button>
              {['7:30 PM', '8:30 PM', '9:30 PM'].map((time) => (
                <button
                  className={reminder.time === time ? 'selector-chip compact active' : 'selector-chip compact'}
                  key={time}
                  onClick={() => setReminderTime(time)}
                  type="button"
                >
                  {time}
                </button>
              ))}
              <button className="secondary-action" onClick={allowReminderAlerts} type="button">
                Allow Reminder Alerts
              </button>
            </div>
          </section>
          <section className="reminder-card" aria-labelledby="daily-goal-title">
            <div>
              <span className="model-category">daily goal</span>
              <h3 id="daily-goal-title">Daily XP Goal</h3>
              <p>{learnerProfile.dailyGoalXp} XP per day</p>
              <small>Dashboard quests and the XP ring use this target.</small>
            </div>
            <div className="reminder-actions">
              {dailyGoalOptions.map((goal) => (
                <button
                  className={learnerProfile.dailyGoalXp === goal ? 'selector-chip compact active' : 'selector-chip compact'}
                  key={goal}
                  onClick={() => setDailyGoal(goal)}
                  type="button"
                >
                  {goal} XP
                </button>
              ))}
            </div>
          </section>
          <section className="reminder-card" aria-labelledby="sound-settings-title">
            <div>
              <span className="model-category">sound</span>
              <h3 id="sound-settings-title">Sound Preferences</h3>
              <p>{soundPreferences.autoPlayAudio ? 'Auto-play On' : 'Auto-play Off'}</p>
              <small>{soundPreferences.soundEffects ? 'Sound effects on' : 'Sound effects off'}</small>
            </div>
            <div className="reminder-actions">
              <button className="secondary-action" onClick={() => toggleSoundPreference('autoPlayAudio')} type="button">
                {soundPreferences.autoPlayAudio ? 'Disable Auto-play' : 'Enable Auto-play'}
              </button>
              <button className="secondary-action" onClick={() => toggleSoundPreference('soundEffects')} type="button">
                {soundPreferences.soundEffects ? 'Disable Sound Effects' : 'Enable Sound Effects'}
              </button>
            </div>
          </section>
          <section className="reminder-card" aria-labelledby="learner-store-title">
            <div>
              <span className="model-category">storage</span>
              <h3 id="learner-store-title">Offline Data Store</h3>
              <p>{formatLearnerStoreStatus(learnerStoreStatus)}</p>
              <small>
                {window.kannadaOS?.saveLearnerData ? 'Electron repository' : 'Browser storage fallback'}
              </small>
            </div>
          </section>
          <div className="settings-list">
            <button className="secondary-action" onClick={() => setScreen('models')} type="button">
              Manage AI Models
            </button>
            <button className="secondary-action" onClick={exportLearnerData} type="button">
              Export Data
            </button>
            <button className="secondary-action" disabled={progress.hearts >= 5 || progress.gems < 50} onClick={refillHearts} type="button">
              Refill Hearts - 50 gems
            </button>
            <button className="secondary-action" disabled={progress.gems < 100} onClick={purchaseStreakFreeze} type="button">
              Buy Streak Freeze - 100 gems
            </button>
            <button className="secondary-action danger-action" onClick={resetAllProgress} type="button">
              Reset All Progress
            </button>
          </div>
          <section className="reset-card" aria-label="Gem economy">
            <strong>{progress.streakFreezes} streak {progress.streakFreezes === 1 ? 'freeze' : 'freezes'} banked</strong>
            <small>Practice restores memory; gems can refill hearts or protect a missed day.</small>
          </section>
          {resetStatus && (
            <section className="reset-card" aria-label="Reset status">
              <strong>{resetStatus}</strong>
              <small>Use this when you want a fresh start. Provider keys, model paths, and reminders stay saved.</small>
            </section>
          )}
          {exportStatus && (
            <section className="export-card" aria-label="Data export">
              <div>
                <strong>{exportStatus.statusText}</strong>
                <small>{exportStatus.runtimeText}</small>
              </div>
              <a
                className="secondary-action export-download"
                download="kannadaos-export.json"
                href={`data:application/json;charset=utf-8,${encodeURIComponent(exportPayload)}`}
              >
                Download JSON
              </a>
              <pre data-testid="export-preview">{exportPayload}</pre>
            </section>
          )}
        </section>
      )
    }

    const nextLesson = getNextAvailableLesson(coreCurriculumUnits, progress) ?? coreCurriculumUnits[0].lessons[0]
    const unlockedUnitIds = new Set(getUnlockedCurriculumUnits(allCurriculumUnits, progress).map((unit) => unit.id))
    const nextUnit =
      coreCurriculumUnits.find((unit) => unit.lessons.some((lesson) => lesson.id === nextLesson.id)) ??
      coreCurriculumUnits[0]
    const dailyGoalXp = learnerProfile.dailyGoalXp
    const dailyQuests = getDailyQuests(progress, new Date().toISOString(), dailyGoalXp)

    return (
      <section className="panel home-panel" aria-labelledby="home-title">
        <header className="section-header">
          <div>
            <p className="eyebrow">Today in Bangalore Kannada</p>
            <h2 id="home-title">KannadaOS</h2>
          </div>
          <div className="top-counters" aria-label="resources">
            <span>Heart {progress.hearts}</span>
            <span>Gem {progress.gems}</span>
          </div>
        </header>
        <section className="streak-banner">
          <div>
            <strong>{progress.streakDays} Day Streak!</strong>
            <p>Keep it up. {Math.max(0, dailyGoalXp - progress.dailyXp)} XP to hit today&apos;s goal.</p>
          </div>
          <div className="ring" aria-label={`${progress.dailyXp} of ${dailyGoalXp} XP`}>
            {Math.min(dailyGoalXp, progress.dailyXp)}/{dailyGoalXp}
          </div>
        </section>
        {progress.hearts <= 0 && (
          <section className="out-of-hearts-card" aria-labelledby="out-of-hearts-title">
            <div>
              <p className="eyebrow">heart recovery</p>
              <h3 id="out-of-hearts-title">Out of Hearts!</h3>
              <p>Practice to earn hearts, refill with gems, or wait for recovery.</p>
            </div>
            <ul>
              <li>Practice to earn hearts</li>
              <li>Refill with 50 gems</li>
              <li>Wait 4 hours for 1 heart</li>
            </ul>
            <div className="heart-recovery-actions">
              <button className="secondary-action" onClick={() => setTab('practice')} type="button">
                Practice Now
              </button>
              <button
                className="primary-action"
                disabled={progress.gems < 50}
                onClick={refillHearts}
                type="button"
              >
                Refill 50 gems
              </button>
            </div>
          </section>
        )}
        <button
          aria-label={`Continue: ${nextLesson.title}`}
          className="continue-card"
          onClick={() => openLesson(nextLesson.id)}
          type="button"
        >
          <span>Continue: {nextLesson.title}</span>
          <small>
            {nextUnit.title} - {nextLesson.objective} - {curriculum.phrases.length} survival phrases loaded
          </small>
          <i>
            <b style={{ width: `${Math.max(12, getLessonProgressSummary(progress, nextLesson.id).masteryLevel * 20)}%` }} />
          </i>
        </button>
        <section className="tips-card" aria-labelledby="unit-tips-title">
          <p className="eyebrow">unit tips</p>
          <h3 id="unit-tips-title">{nextUnit.title}</h3>
          {nextUnit.tips.map((tip) => (
            <article key={tip.title}>
              <strong>{tip.title}</strong>
              <p>{tip.body}</p>
              <small>{tip.examples.map(formatReadableExample).join(' / ')}</small>
            </article>
          ))}
        </section>
        <section className="daily-quest-grid" aria-label="Daily quests">
          {dailyQuests.map((quest) => (
            <article className={quest.completed ? 'quest-card complete' : 'quest-card'} key={quest.id}>
              <strong>{quest.title}</strong>
              <p>{quest.description}</p>
              <span>{quest.current}/{quest.target} - +{quest.rewardGems} gems</span>
              <button
                className="secondary-action"
                disabled={!quest.completed || quest.claimed}
                onClick={() => claimQuestReward(quest)}
                type="button"
              >
                {quest.claimed ? 'Claimed' : 'Claim Reward'}
              </button>
            </article>
          ))}
        </section>
        <section className="level-map expanded" aria-label="Curriculum map">
          {allCurriculumUnits.map((unit, mapUnitIndex) => (
            <article
              className={unlockedUnitIds.has(unit.id) ? 'map-node unit-node current' : 'map-node unit-node locked'}
              key={unit.id}
            >
              <span>{unit.optional ? 'ಅ' : unlockedUnitIds.has(unit.id) ? '★' : 'lock'}</span>
              <strong>{unit.optional ? `Optional: ${unit.title}` : unit.title}</strong>
              <small>{unit.description}</small>
              <div className="lesson-dot-row">
                {unit.lessons.map((lesson, unitLessonIndex) => {
                  const lessonProgress = getLessonProgressSummary(progress, lesson.id)
                  const unlocked = unit.optional || isLessonUnlocked(lesson.id, progress)
                  return (
                    <button
                      aria-label={`Curriculum ${mapUnitIndex + 1} lesson ${unitLessonIndex + 1} ${lessonProgress.masteryLevel} crowns`}
                      className={lessonProgress.completed ? 'lesson-dot done' : unlocked ? 'lesson-dot current' : 'lesson-dot locked'}
                      disabled={!unlocked}
                      key={lesson.id}
                      onClick={() => openLesson(lesson.id)}
                      type="button"
                    >
                      {lessonProgress.masteryLevel || (unlocked ? '•' : 'x')}
                    </button>
                  )
                })}
              </div>
            </article>
          ))}
        </section>
      </section>
    )
  }

  function renderExerciseContent(exercise: LessonExercise) {
    if (exercise.type === 'arrange') {
      return (
        <>
          <div className="phrase-card">
            <small>{exercise.english}</small>
            {placedWords.length ? (
              <>
                <strong lang="kn">{placedWords.join(' ')}</strong>
                <SubtitleLines text={placedWords.join(' ')} context={exercise} />
              </>
            ) : (
              <>
                <strong>Tap words below</strong>
                <SubtitleLines text={exercise.answer} context={exercise} />
              </>
            )}
          </div>
          <div className="word-bank" aria-label="Word bank">
            {exercise.options.map((word) => (
              <button
                className={placedWords.includes(word) ? 'answer-option selected' : 'answer-option'}
                disabled={placedWords.includes(word)}
                key={word}
                onClick={() => selectArrangeWord(word)}
                type="button"
              >
                <ChoiceText text={word} context={exercise} />
              </button>
            ))}
          </div>
          {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
        </>
      )
    }

    if (exercise.type === 'listening') {
      return (
        <>
          <div className="listening-card">
            <button
              className="speaker-button"
              onClick={() => void playExerciseReference(exercise)}
              type="button"
            >
              Play reference audio
            </button>
            <button
              className="mini-button"
              onClick={() => void playExerciseReference(exercise, 0.7)}
              type="button"
            >
              Play slow audio
            </button>
            {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
          </div>
          <div className="option-stack" aria-label="Listening choices">
            {exercise.options.map((option) => (
              <button
                className={selectedAnswer === option ? 'answer-option selected' : 'answer-option'}
                key={option}
                onClick={() => setSelectedAnswer(option)}
                type="button"
              >
                <ListeningChoiceText text={option} context={exercise} revealed={feedback !== null} />
              </button>
            ))}
          </div>
        </>
      )
    }

    if (exercise.type === 'speaking') {
      return (
        <>
          <div className="phrase-card">
            <strong lang="kn">{exercise.kannada}</strong>
            <SubtitleLines text={exercise.kannada} context={exercise} />
          </div>
          <div className="speaking-card">
            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} style={{ height: `${20 + ((index * 13) % 48)}px` }} />
              ))}
            </div>
            <button
              className="mini-button"
              onClick={() => void playExerciseReference(exercise)}
              type="button"
            >
              Play reference audio
            </button>
            <button
              className="mini-button"
              onClick={() => void playExerciseReference(exercise, 0.7)}
              type="button"
            >
              Play slow audio
            </button>
            <button className="speaker-button" onClick={() => recordPhrase(exercise)} type="button">
              {recordingTarget === 'lesson' ? 'Stop Recording' : 'Record phrase'}
            </button>
            {speakingScore !== null && (
              <div className="score-card" role="status">
                <strong>Score: {speakingScore}%</strong>
                <span>Tip: {speakingTip || 'Extend the aa sound in saar.'}</span>
              </div>
            )}
            {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
          </div>
        </>
      )
    }

    if (exercise.type === 'typeKannada') {
      const convertedAnswer = transliterateLatinToKannada(typedAnswer)
      return (
        <>
          <div className="phrase-card">
            <small>{exercise.english}</small>
            <strong lang="kn">{exercise.answer}</strong>
            <SubtitleLines text={exercise.answer} context={exercise} />
            <button className="mini-button" onClick={() => void playExerciseReference(exercise)} type="button">
              Listen
            </button>
          </div>
          <label className="transcript-field typing-helper">
            <span>Kannada typing answer</span>
            <input
              aria-label="Kannada typing answer"
              onChange={(event) => {
                setTypedAnswer(event.target.value)
                setSelectedAnswer(transliterateLatinToKannada(event.target.value))
                if (feedback === 'almost') {
                  setFeedback(null)
                  setAlmostTypingDistance(null)
                }
              }}
              placeholder="Type namaskara saar"
              value={typedAnswer}
            />
          </label>
          <article className="keyboard-helper" aria-label="Kannada keyboard helper">
            <strong>Keyboard helper</strong>
            <ReadableStatusText text={typedAnswer ? convertedAnswer : 'namaskara saar -> ನಮಸ್ಕಾರ ಸಾರ್'} context={exercise} />
            <div className="suggestion-row compact">
              {exercise.options.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setTypedAnswer(option)
                    setSelectedAnswer(transliterateLatinToKannada(option))
                    if (feedback === 'almost') {
                      setFeedback(null)
                      setAlmostTypingDistance(null)
                    }
                  }}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </article>
          {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
        </>
      )
    }

    if (exercise.type === 'dialogue') {
      return (
        <>
          <div className="phrase-card dialogue-card">
            <small>Reply to the line</small>
            <strong lang="kn">{exercise.kannada}</strong>
            <SubtitleLines text={exercise.kannada} context={exercise} />
            <button className="mini-button" onClick={() => void playExerciseReference(exercise)} type="button">
              Listen
            </button>
          </div>
          {renderOptions(exercise)}
          {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
        </>
      )
    }

    if (exercise.type === 'matchPairs') {
      const pairs = parseMatchPairs(exercise.answer)
      return (
        <div className="match-grid" aria-label="Match pairs">
          <div>
            {pairs.map((pair) => (
              <button
                className={selectedMatch.left === pair.left ? 'answer-option selected' : 'answer-option'}
                key={pair.left}
                onClick={() => handleMatchSelection(pair.left, 'left', exercise)}
                type="button"
              >
                <ChoiceText text={pair.left} context={exercise} />
              </button>
            ))}
          </div>
          <div>
            {pairs.map((pair) => (
              <button
                className={selectedMatch.right === pair.right ? 'answer-option selected' : 'answer-option'}
                key={pair.right}
                onClick={() => handleMatchSelection(pair.right, 'right', exercise)}
                type="button"
              >
                <ChoiceText text={pair.right} context={exercise} />
              </button>
            ))}
          </div>
          <p>{matchedPairs.length} of {pairs.length} matched</p>
        </div>
      )
    }

    return (
      <>
        <div className="phrase-card">
          <strong lang="kn">{exercise.kannada}</strong>
          <SubtitleLines text={exercise.kannada} context={exercise} />
          {exercise.english && <small>{exercise.english}</small>}
          <button type="button" className="mini-button" onClick={() => void playExerciseReference(exercise)}>
            Listen
          </button>
        </div>
        {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
        {renderOptions(exercise)}
      </>
    )
  }

  function renderOptions(exercise: LessonExercise) {
    return (
      <div className="option-stack">
        {exercise.options.map((option) => (
          <button
            className={selectedAnswer === option ? 'answer-option selected' : 'answer-option'}
            key={option}
            onClick={() => setSelectedAnswer(option)}
            type="button"
          >
            <ChoiceText text={option} context={exercise} />
          </button>
        ))}
      </div>
    )
  }
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <article className="stat-card" aria-label={`${value} ${label}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

function formatLessonDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes <= 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function getCompletedStoryCount(progress: ProgressState): number {
  const storyIds = new Set(progress.completedStoryIds)

  for (const exerciseId of progress.completedExerciseIds) {
    if (exerciseId.startsWith('story-')) {
      storyIds.add(exerciseId.slice('story-'.length))
    }
  }

  return storyIds.size
}

function formatProfilePracticeTime(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

function createOpeningMessage(scenario: Scenario): ChatMessage {
  return {
    id: `opening-${scenario.id}`,
    speaker: 'tutor',
    text: scenario.openingLine.kannada,
    subtext: `${scenario.openingLine.transliteration} = ${scenario.openingLine.english}`,
  }
}

function buildTutorReply(input: string, scenario: Scenario, persona: TutorPersona): Pick<ChatMessage, 'text' | 'subtext'> {
  const normalized = input.toLowerCase()

  if (scenario.id === 'auto-ride' && normalized.includes('majestic') && normalized.includes('hogbeku')) {
    return {
      text: 'Majestic-ge hogbeku is better.',
      subtext: `${persona.name}: Add -ge for "to": ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು.`,
    }
  }

  if (scenario.id === 'bmtc-bus') {
    return {
      text: `${persona.name}: Good fare question for BMTC.`,
      subtext: 'fare question: add the destination first - Koramangala-ge ticket eshtu?',
    }
  }

  if (normalized.includes('beda') || input.includes('ಬೇಡ')) {
    return {
      text: `${persona.name}: Good. ಬೇಡ is a clear way to say you do not want it.`,
      subtext: persona.correctionStyle,
    }
  }

  return {
    text: `${persona.name}: Try it in the ${scenario.title} roleplay.`,
    subtext: scenario.usefulPhrases.map((phrase) => phrase.transliteration).join(' / '),
  }
}

function hydrateLearnerProfile(serialized: string | null): LearnerProfile {
  if (!serialized) {
    return defaultLearnerProfile
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<LearnerProfile>
    const dailyGoalXp = dailyGoalOptions.includes(parsed.dailyGoalXp as (typeof dailyGoalOptions)[number])
      ? Number(parsed.dailyGoalXp)
      : defaultLearnerProfile.dailyGoalXp

    return {
      motivation: typeof parsed.motivation === 'string' && parsed.motivation ? parsed.motivation : defaultLearnerProfile.motivation,
      startingLevel: typeof parsed.startingLevel === 'string' && parsed.startingLevel ? parsed.startingLevel : defaultLearnerProfile.startingLevel,
      dailyGoalXp,
      onboardedAt: typeof parsed.onboardedAt === 'string' ? parsed.onboardedAt : defaultLearnerProfile.onboardedAt,
    }
  } catch {
    return defaultLearnerProfile
  }
}

function hydrateSoundPreferences(serialized: string | null): SoundPreferences {
  if (!serialized) {
    return defaultSoundPreferences
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<SoundPreferences>
    return {
      soundEffects: typeof parsed.soundEffects === 'boolean' ? parsed.soundEffects : defaultSoundPreferences.soundEffects,
      autoPlayAudio: typeof parsed.autoPlayAudio === 'boolean' ? parsed.autoPlayAudio : defaultSoundPreferences.autoPlayAudio,
    }
  } catch {
    return defaultSoundPreferences
  }
}

function hydrateReminder(serialized: string | null): ReminderPreference {
  if (!serialized) {
    return defaultReminderPreference
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<ReminderPreference>
    return {
      ...defaultReminderPreference,
      ...parsed,
      permission:
        parsed.permission === 'granted' || parsed.permission === 'denied' || parsed.permission === 'default'
          ? parsed.permission
          : defaultReminderPreference.permission,
      time: typeof parsed.time === 'string' && parsed.time ? parsed.time : defaultReminderPreference.time,
    }
  } catch {
    return defaultReminderPreference
  }
}

function hydrateLocalRuntimeConfig(serialized: string | null): LocalRuntimeConfig {
  if (!serialized) {
    return emptyLocalRuntimeConfig
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<LocalRuntimeConfig>
    return {
      llmModelPath: typeof parsed.llmModelPath === 'string' ? parsed.llmModelPath : '',
      whisperModelPath: typeof parsed.whisperModelPath === 'string' ? parsed.whisperModelPath : '',
      piperVoicePath: typeof parsed.piperVoicePath === 'string' ? parsed.piperVoicePath : '',
      llamaBinaryPath: typeof parsed.llamaBinaryPath === 'string' ? parsed.llamaBinaryPath : '',
      whisperBinaryPath: typeof parsed.whisperBinaryPath === 'string' ? parsed.whisperBinaryPath : '',
      piperBinaryPath: typeof parsed.piperBinaryPath === 'string' ? parsed.piperBinaryPath : '',
    }
  } catch {
    return emptyLocalRuntimeConfig
  }
}

function hydratePronunciationHistory(serialized: string | null): PronunciationAttempt[] {
  if (!serialized) {
    return []
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<PronunciationAttempt>[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((attempt): attempt is PronunciationAttempt =>
        typeof attempt.id === 'string' &&
        typeof attempt.phraseId === 'string' &&
        typeof attempt.phrase === 'string' &&
        typeof attempt.transcript === 'string' &&
        typeof attempt.score === 'number' &&
        typeof attempt.feedback === 'string' &&
        typeof attempt.tip === 'string' &&
        Array.isArray(attempt.problemParts) &&
        typeof attempt.createdAt === 'string' &&
        (attempt.level === 'clear' || attempt.level === 'steady' || attempt.level === 'needs-practice'),
      )
      .slice(0, 5)
  } catch {
    return []
  }
}

function hydrateAiExpansionDeck(serialized: string | null): GeneratedExercise[] {
  if (!serialized) {
    return []
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<GeneratedExercise>[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isGeneratedExercise).slice(0, 8)
  } catch {
    return []
  }
}

function isGeneratedExercise(exercise: Partial<GeneratedExercise>): exercise is GeneratedExercise {
  return (
    typeof exercise.type === 'string' &&
    typeof exercise.prompt === 'string' &&
    typeof exercise.kannada === 'string' &&
    typeof exercise.answer === 'string' &&
    Array.isArray(exercise.options) &&
    exercise.options.every((option) => typeof option === 'string') &&
    (exercise.explanation === undefined || typeof exercise.explanation === 'string')
  )
}

function getPronunciationParts(kannada: string): string[] {
  return kannada
    .replace(/[?]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function formatVoiceTranscriptStatus(transcript: string) {
  return `Voice transcript ready: ${transcript} (${getTranscriptCompanion(transcript)})`
}

function getTranscriptCompanion(transcript: string) {
  const normalizedTranscript = transcript.trim().normalize('NFC')
  const phrase = survivalPhrases.find((item) => item.kannada.normalize('NFC') === normalizedTranscript)

  if (phrase) {
    return `${phrase.transliteration} = ${phrase.english}`
  }

  return 'Kannada transcript'
}

function getSimulatedPronunciationTranscript(phrase: Phrase): string {
  if (phrase.id === 'namaskara-saar') {
    return 'ನಮಸ್ಕಾರ'
  }

  return phrase.kannada.replace(/[?]/g, '')
}

function createE2EVoiceCaptureSession(): VoiceCaptureSession {
  const sampleRate = 16_000
  const samples = new Float32Array(sampleRate)

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 0.25
  }

  return {
    async stop() {
      return {
        audioBytes: encodePcmWav(samples, sampleRate),
        durationMs: 1000,
        sampleRate,
      }
    },
  }
}

function parseMatchPairs(answer: string) {
  return answer.split(';').map((pair) => {
    const [left, right] = pair.split('=')
    return { left, right }
  })
}

function formatDueReviewSummary(dueReviewIds: string[], progress: ProgressState) {
  if (!dueReviewIds.length) {
    return 'No due words. Keep building streak confidence.'
  }

  return dueReviewIds
    .map((vocabularyId) => {
      const label = formatReadableReviewLabel(vocabularyId)
      const strength = Math.round((progress.reviewQueue[vocabularyId]?.strength ?? 0) * 100)
      return `${label} - Strength ${strength}%`
    })
    .join(', ')
}

function formatReadableReviewLabel(vocabularyId: string) {
  const phrase = survivalPhrases.find((item) => item.id === vocabularyId)

  if (phrase) {
    return `${phrase.kannada} - ${phrase.transliteration} - ${phrase.english}`
  }

  const fallbackLabel = vocabularyId.split(':').at(-1) ?? vocabularyId
  const subtitle = getKannadaSubtitle(fallbackLabel)

  if (subtitle) {
    const english = hasDistinctEnglishSubtitle(subtitle) ? ` - ${subtitle.english}` : ''
    return `${fallbackLabel} - ${subtitle.romanization}${english}`
  }

  return fallbackLabel
}

function formatFlashcardNextReview(
  review: ProgressState['reviewQueue'][string] | undefined,
  now: string,
): string {
  if (!review?.dueAt) {
    return 'Not scheduled'
  }

  const dueTime = new Date(review.dueAt).getTime()
  const nowTime = new Date(now).getTime()

  if (!Number.isFinite(dueTime) || !Number.isFinite(nowTime)) {
    return 'Not scheduled'
  }

  const daysUntilDue = Math.ceil((dueTime - nowTime) / (24 * 60 * 60 * 1000))

  if (daysUntilDue <= 0) {
    return 'Due now'
  }

  return `${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`
}

function formatSkillTagLabel(skillTag: string): string {
  return skillTag
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatLearnerStoreStatus(status: LearnerStoreStatus) {
  if (status === 'loading') {
    return 'Desktop data loading'
  }

  if (status === 'saving') {
    return 'Desktop data saving'
  }

  if (status === 'synced') {
    return 'Desktop data synced'
  }

  if (status === 'error') {
    return 'Desktop data needs attention'
  }

  return 'Browser data store'
}

function formatProviderStatus(settings: AiProviderSettings) {
  if (settings.activeProvider === 'openrouter') {
    return isHostedProviderConfigured(settings) ? 'OpenRouter ready' : 'OpenRouter needs key'
  }

  if (settings.activeProvider === 'nvidia') {
    return isHostedProviderConfigured(settings) ? 'NVIDIA hosted ready' : 'NVIDIA needs key'
  }

  if (settings.activeProvider === 'ollama') {
    return 'Ollama selected'
  }

  return 'Local first selected'
}

function formatCurrentAiModelStatus(
  settings: AiProviderSettings,
  ollamaStatus: 'checking' | 'online' | 'offline',
) {
  if (settings.activeProvider === 'openrouter' || settings.activeProvider === 'nvidia') {
    return formatProviderStatus(settings)
  }

  if (settings.activeProvider === 'ollama') {
    return ollamaStatus === 'online' ? 'Ollama online' : ollamaStatus === 'offline' ? 'Ollama offline' : 'Checking'
  }

  return ollamaStatus === 'online' ? 'Local + Ollama' : ollamaStatus === 'offline' ? 'Local fallback' : 'Checking'
}

function getActiveHostedModel(settings: AiProviderSettings) {
  if (settings.activeProvider === 'openrouter') {
    return settings.openRouterModel
  }

  if (settings.activeProvider === 'nvidia') {
    return settings.nvidiaModel
  }

  return ''
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatGeneratedExerciseSource(source: 'native' | 'ollama' | 'openrouter' | 'nvidia' | 'fallback') {
  if (source === 'native') {
    return 'Native'
  }

  if (source === 'openrouter') {
    return 'OpenRouter'
  }

  if (source === 'nvidia') {
    return 'NVIDIA'
  }

  if (source === 'ollama') {
    return 'Ollama'
  }

  return 'Offline'
}

export default App
