import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  bangaloreScenarios,
  coreCurriculumUnits,
  getExercisesForMastery,
  getNextAvailableLesson,
  getPhraseByVocabularyId,
  getScriptCurriculumUnit,
  getStoryLockState,
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
  bonusStoryUnlockCost,
  buyStreakFreeze,
  claimDailyQuestReward,
  completeLessonProgress,
  createInitialProgress,
  getAdaptiveDifficulty,
  getAchievementSummaries,
  getDailyQuests,
  getLessonProgressSummary,
  getDueReviewItems,
  getScenarioChecklistActivityId,
  getWeakSkillSummaries,
  heartRegenerationIntervalMs,
  hydrateProgress,
  maxHearts,
  rateReviewItem,
  recordPracticeActivity,
  recordChatMessageSent,
  refillHeartsWithGems,
  serializeProgress,
  toggleScenarioChecklistItem,
  unlockCurriculumUnits,
  unlockStoryWithGems,
  type AdaptiveDifficultyLevel,
  type DailyQuest,
  type ProgressState,
  type ReviewRating,
} from './domain/progress'
import {
  checkOllamaStatus,
  generateExerciseWithOllama,
  generateTutorReplyWithOllama,
  type ExercisePromptContext,
} from './services/ollama'
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
import { playSoundEffect, type SoundEffectName } from './services/soundEffects'
import {
  formatReminderSchedule,
  getCurrentReminderNotificationPermission,
  getNextReminderDate,
  requestReminderNotificationPermission,
  showDailyReminderNotification,
  type ReminderPermission,
} from './services/reminders'
import { encodePcmWav, startVoiceCapture, type RecordedAudio, type VoiceCaptureSession } from './services/voiceCapture'
import { buildExportSnapshot, serializeExportSnapshot } from './services/exportSnapshot'
import {
  appendScenarioMessages,
  getScenarioMessages,
  hydrateConversationStore,
  serializeConversationStore,
  trimConversationMessages,
  type ConversationStore,
  type PersistedConversationCorrection,
} from './services/conversationLog'
import { applyLearnerStorage, collectLearnerStorage } from './services/learnerStore'
import type { CurriculumUnit, GeneratedExercise, LessonExercise, Phrase, Scenario, Story, StorySentence, StoryWord, TutorPersona } from './types'
import './styles.css'

type Tab = 'home' | 'learn' | 'chat' | 'practice' | 'stories' | 'blr' | 'me'
type Screen = 'onboarding' | 'app' | 'lesson' | 'models'
type OnboardingStep = 'welcome' | 'profile' | 'goal'
type StoryMode = 'list' | 'reader' | 'quiz' | 'complete'
type VoiceRecordingTarget = 'chat' | 'pronunciation' | 'lesson'
type GeneratedExerciseSource = 'native' | 'ollama' | 'openrouter' | 'nvidia' | 'fallback'

interface ChatMessage {
  id: string
  speaker: 'tutor' | 'learner'
  text: string
  subtext?: string
  correction?: PersistedConversationCorrection
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
  permission: ReminderPermission
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
type WebSpeechResult = 'played' | 'unavailable'
type ReviewExerciseKind = 'translate' | 'fillBlank' | 'typeKannada'

interface ReviewMiniExercise {
  vocabularyId: string
  kind: ReviewExerciseKind
  phrase: Phrase
  prompt: string
  displayText: string
  answer: string
  options: string[]
}

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
const seenUnitTipsKey = 'kannadaos:seen-unit-tips'
const defaultChatScenario = bangaloreScenarios.find((scenario) => scenario.id === 'auto-ride') ?? bangaloreScenarios[0]
const defaultTutorPersona = tutorPersonas[0]
const storyQuizXp = 5
const questClaimAnimationMs = 2200
const weakSkillPracticeLimit = 6
const pronunciationPhrases = survivalPhrases.filter((phrase) =>
  ['namaskara-saar', 'ticket-eshtu', 'swalpa-adjust-maadi', 'majestic-ge-hogbeku', 'illi-nillisi'].includes(phrase.id),
)
const defaultReminderPreference: ReminderPreference = {
  enabled: false,
  time: '7:30 PM',
  permission: 'default',
}
const reminderTimeOptions = ['7:30 PM', '8:30 PM', '9:30 PM'] as const
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
  { id: 'moved-to-bangalore', label: 'I just moved to Bangalore', detail: 'Autos, buses, PGs, darshinis, and daily Kannada.' },
  { id: 'family', label: 'I want to talk to family/friends', detail: 'Everyday conversation with people close to you.' },
  { id: 'curious', label: "I'm curious about the language", detail: 'Read signs, greetings, and understand Kannada culture.' },
  { id: 'work', label: 'Work requires some Kannada', detail: 'Office, cafeteria, meeting, and coworker Kannada.' },
] as const
const startingLevelOptions = [
  { id: 'zero', label: 'Zero - Teach me everything', detail: 'Start with script, greetings, and survival phrases.' },
  { id: 'few-words', label: 'I know a few words (namaskara, eshtu, beku)', detail: 'Start at the beginning but move faster through familiar phrases.' },
  { id: 'basic-conversations', label: 'I can have basic conversations', detail: 'Unlock the first three core units immediately.' },
  { id: 'can-read', label: 'I can read Kannada script', detail: 'Mark the Script Academy as complete and focus on speaking.' },
] as const
const dailyGoalOptions = [5, 10, 20, 30] as const
type DailyGoalXp = (typeof dailyGoalOptions)[number]
interface DailyGoalDetails {
  name: string
  minutesPerDay: number
  description: string
}
const dailyGoalDetailsByXp = {
  5: { name: 'Casual', minutesPerDay: 5, description: 'Short daily practice.' },
  10: { name: 'Regular', minutesPerDay: 10, description: 'Steady daily practice.' },
  20: { name: 'Serious', minutesPerDay: 15, description: 'Focused beginner pace.' },
  30: { name: 'Intense', minutesPerDay: 20, description: 'Deep daily practice.' },
} satisfies Record<DailyGoalXp, DailyGoalDetails>
const tabShortcutByKey: Record<string, Tab> = {
  '1': 'home',
  '2': 'learn',
  '3': 'practice',
  '4': 'stories',
  '5': 'chat',
  '6': 'blr',
  '7': 'me',
}
const checkAnswerShortcuts = 'Enter Meta+Enter Control+Enter'
const replayAudioShortcuts = 'Meta+R Control+R'
const lessonReplayAudioShortcuts = `Space ${replayAudioShortcuts}`
const microphoneShortcuts = 'Meta+M Control+M'
const navigationItems: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'learn', icon: '📚', label: 'Learn' },
  { id: 'practice', icon: '🔄', label: 'Practice' },
  { id: 'stories', icon: '📖', label: 'Stories' },
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'blr', icon: '🏙️', label: 'BLR' },
  { id: 'me', icon: '👤', label: 'Profile' },
]

interface ReadableSubtitle {
  romanization: string
  english: string
}

interface ReadablePhraseParts {
  kannada: string
  transliteration: string
  english: string
  context?: string
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
  'ಇದು': { romanization: 'idu', english: 'this' },
  'ಅದು': { romanization: 'adu', english: 'that' },
  'ಇದನ್ನು': { romanization: 'idannu', english: 'this item' },
  'ತೋರಿಸಿ': { romanization: 'torisi', english: 'show me' },
  'ಸ್ವಲ್ಪ': { romanization: 'swalpa', english: 'a little' },
  'ಕನ್ನಡ': { romanization: 'kannada', english: 'Kannada' },
  'ನೀವ್': { romanization: 'niiv', english: 'respectful you' },
  'ನೀವು': { romanization: 'niivu', english: 'respectful you' },
  'ಮೇಡಂ': { romanization: 'maedam', english: 'madam' },
  'ಬರುತ್ತದೆ': { romanization: 'baruttade', english: 'will come' },
  'ಬರುತ್ತೆ': { romanization: 'barutte', english: 'will come' },
  'ಊಟ': { romanization: 'oota', english: 'meal' },
  'ಆಯ್ತಾ': { romanization: 'aayta', english: 'done?' },
  'ಇಲ್ಲಿ': { romanization: 'illi', english: 'here' },
  'ನಿಲ್ಲಿಸಿ': { romanization: 'nillisi', english: 'stop' },
  'ಒಂದು': { romanization: 'ondu', english: 'one' },
  'ಎರಡು': { romanization: 'eradu', english: 'two' },
  'ಮೂರು': { romanization: 'mooru', english: 'three' },
  'ನಾಲ್ಕು': { romanization: 'naalku', english: 'four' },
  'ಐದು': { romanization: 'aidu', english: 'five' },
  'ಆರು': { romanization: 'aaru', english: 'six' },
  'ಏಳು': { romanization: 'elu', english: 'seven' },
  'ಎಂಟು': { romanization: 'entu', english: 'eight' },
  'ಒಂಬತ್ತು': { romanization: 'ombattu', english: 'nine' },
  'ಹತ್ತು': { romanization: 'hattu', english: 'ten' },
  'ರೂಪಾಯಿ': { romanization: 'rupayi', english: 'rupees' },
  'ಬೆಲೆ': { romanization: 'bele', english: 'price' },
  'ಜಾಸ್ತಿ': { romanization: 'jaasti', english: 'too much' },
  'ಕಡಿಮೆ': { romanization: 'kadime', english: 'less' },
  'ಮಾಡಿ': { romanization: 'maadi', english: 'please do' },
  'ಎಡ': { romanization: 'eda', english: 'left' },
  'ಎಡಕ್ಕೆ': { romanization: 'edakke', english: 'to the left' },
  'ಬಲ': { romanization: 'bala', english: 'right' },
  'ಬಲಕ್ಕೆ': { romanization: 'balakke', english: 'to the right' },
  'ನೇರ': { romanization: 'nera', english: 'straight' },
  'ನೇರವಾಗಿ': { romanization: 'neravagi', english: 'straight' },
  'ಇಂದಿರಾನಗರದಿಂದ': { romanization: 'indiranagaradinda', english: 'from Indiranagar' },
  'ಕೊಡಿ': { romanization: 'kodi', english: 'give me' },
  'ಸಮಸ್ಯೆ': { romanization: 'samasye', english: 'problem' },
  'ಇದೆ': { romanization: 'ide', english: 'there is' },
  'ನೀರಿನ': { romanization: 'neerina', english: 'water' },
  'ಇಲ್ಲ': { romanization: 'illa', english: 'no' },
  'ಬರಲ್ಲ': { romanization: 'baralla', english: 'not coming' },
  'ಯಾವಾಗ': { romanization: 'yaavaaga', english: 'when' },
  'ಮೀಟಿಂಗ್': { romanization: 'miiting', english: 'meeting' },
  'ಇವತ್ತು': { romanization: 'ivattu', english: 'today' },
  'ನಾಳೆ': { romanization: 'naale', english: 'tomorrow' },
  'ಸ್ಕ್ರೀನ್': { romanization: 'screen', english: 'screen' },
  'ಶೇರ್': { romanization: 'share', english: 'share' },
  'ಮತ್ತೆ': { romanization: 'matte', english: 'again' },
  'ಎಕ್ಸ್‌ಪ್ಲೇನ್': { romanization: 'explain', english: 'explain' },
  'ಮುಗಿಸ್ತೀನಿ': { romanization: 'mugisthini', english: 'I will finish' },
  'ಕಳುಸ್ತೀನಿ': { romanization: 'kalustini', english: 'I will send' },
  'ಸಹಾಯ': { romanization: 'sahaaya', english: 'help' },
  'ತಕ್ಷಣ': { romanization: 'takshana', english: 'immediately' },
  'ಆಸ್ಪತ್ರೆ': { romanization: 'aaspatre', english: 'hospital' },
  'ಎಲ್ಲಿ': { romanization: 'elli', english: 'where' },
  'ಡಾಕ್ಟರ್': { romanization: 'doctor', english: 'doctor' },
  'ಪೋಲೀಸ್': { romanization: 'poliis', english: 'police' },
  'ಪೋಲೀಸ್‌ಗೆ': { romanization: 'poliis-ge', english: 'to police' },
  'ಕಾಲ್': { romanization: 'call', english: 'call' },
  'ಇಡ್ಲಿ': { romanization: 'idli', english: 'idli' },
  'ದೋಸೆ': { romanization: 'dose', english: 'dosa' },
  'ಕಾಫಿ': { romanization: 'kaafi', english: 'coffee' },
  'ಚಹಾ': { romanization: 'chahaa', english: 'tea' },
  'ಅನ್ನ': { romanization: 'anna', english: 'rice' },
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

  const hasEnglishSubtitle = hasEnglishSubtitleText(subtitle)

  return (
    <span className="kannada-subtitles">
      {hasEnglishSubtitle && (
        <small className="english-subtitle">{formatEnglishSubtitle(subtitle.english)}</small>
      )}
      <small className="romanization">{formatRomanizationSubtitle(subtitle.romanization)}</small>
    </span>
  )
}

interface KannadaTextProps {
  text: string
  context?: LessonExercise
  className?: string
  ariaLabel?: string
  subtitle?: ReadableSubtitle | null
}

function getReadableKannadaAriaLabel(text: string, context?: LessonExercise, subtitle?: ReadableSubtitle | null): string {
  const readableSubtitle = subtitle === undefined ? getKannadaSubtitle(text, context) : subtitle
  return readableSubtitle ? formatReadableKannadaChoice(text, readableSubtitle) : text
}

function KannadaText({ text, context, className, ariaLabel, subtitle }: KannadaTextProps) {
  return (
    <span className={className} lang="kn" aria-label={ariaLabel ?? getReadableKannadaAriaLabel(text, context, subtitle)}>
      {text}
    </span>
  )
}

function KannadaStrong({ text, context, className, ariaLabel, subtitle }: KannadaTextProps) {
  return (
    <strong className={className} lang="kn" aria-label={ariaLabel ?? getReadableKannadaAriaLabel(text, context, subtitle)}>
      {text}
    </strong>
  )
}

function EnglishFirstKannadaText({
  phrase,
  showContext = false,
}: {
  phrase: ReadablePhraseParts
  showContext?: boolean
}) {
  return (
    <span className="readable-phrase" aria-label={formatReadablePhrase(phrase)}>
      <strong className="readable-phrase-english">{formatEnglishSubtitle(phrase.english)}</strong>
      <KannadaText
        ariaLabel={formatReadablePhrase(phrase)}
        text={phrase.kannada}
        subtitle={{ english: phrase.english, romanization: phrase.transliteration }}
      />
      <small className="romanization">{formatRomanizationSubtitle(phrase.transliteration)}</small>
      {showContext && phrase.context && <small className="readable-phrase-context">{phrase.context}</small>}
    </span>
  )
}

function ReadableKannadaMark({
  text,
  english,
  transliteration,
  className,
}: {
  text: string
  english: string
  transliteration: string
  className: string
}) {
  const subtitle = { english, romanization: transliteration }

  return (
    <span className="readable-mark-lockup">
      <KannadaText className={className} text={text} subtitle={subtitle} />
      <span className="mark-subtitles">
        <small className="english-subtitle">{formatEnglishSubtitle(english)}</small>
        <small className="romanization">{formatRomanizationSubtitle(transliteration)}</small>
      </span>
    </span>
  )
}

function ChoiceText({ text, context }: { text: string; context?: LessonExercise }) {
  if (!containsKannada(text)) {
    return text
  }

  const subtitle = getKannadaSubtitle(text, context)
  if (!subtitle) {
    return <KannadaText text={text} context={context} subtitle={subtitle} />
  }

  const hasEnglishSubtitle = hasEnglishSubtitleText(subtitle)

  return (
    <span className="choice-text" aria-label={formatReadableKannadaChoice(text, subtitle)}>
      {hasEnglishSubtitle && (
        <span className="english-subtitle choice-primary-english">{formatEnglishSubtitle(subtitle.english)}</span>
      )}
      <KannadaText text={text} context={context} subtitle={subtitle} />
      <small className="romanization">{formatRomanizationSubtitle(subtitle.romanization)}</small>
    </span>
  )
}

function ListeningChoiceText({ text, context, revealed }: { text: string; context?: LessonExercise; revealed: boolean }) {
  if (!containsKannada(text) || revealed || context?.skillTag === 'script') {
    return <ChoiceText text={text} context={context} />
  }

  const subtitle = getKannadaSubtitle(text, context)

  return (
    <span className="choice-text">
      <span>Audio choice</span>
      {subtitle && (
        <span className="kannada-subtitles">
          <small className="romanization">{formatRomanizationSubtitle(subtitle.romanization)}</small>
          {subtitle.english && <small className="english-subtitle">{formatEnglishSubtitle(subtitle.english)}</small>}
        </span>
      )}
    </span>
  )
}

function EnglishWordGuide({ words, context }: { words: string[]; context?: LessonExercise }) {
  const guideEntries = words
    .map((word) => ({ word, subtitle: getKannadaSubtitle(word, context) }))
    .filter((entry): entry is { word: string; subtitle: ReadableSubtitle } => entry.subtitle !== null)

  if (!guideEntries.length) {
    return null
  }

  return (
    <section className="word-guide" aria-label="English word guide">
      {guideEntries.map(({ word, subtitle }, index) => (
        <article className="word-guide-item" key={`${word}-${index}`} aria-label={formatReadableKannadaChoice(word, subtitle)}>
          <strong className="word-guide-english">{subtitle.english || 'Kannada word'}</strong>
          <KannadaText text={word} context={context} subtitle={subtitle} />
          <small className="romanization">{formatRomanizationSubtitle(subtitle.romanization)}</small>
        </article>
      ))}
    </section>
  )
}

function ReadableStatusText({ text, context }: { text: string; context?: LessonExercise }) {
  const alreadyReadable = isStructuredReadableLine(text)
  const ariaLabel = containsKannada(text) && !alreadyReadable ? getReadableKannadaAriaLabel(text, context) : undefined

  return (
    <>
      <span aria-label={ariaLabel}>{text}</span>
      {!alreadyReadable && <SubtitleLines text={text} context={context} />}
    </>
  )
}

function ReadableExampleList({ examples }: { examples: string[] }) {
  return (
    <span className="readable-example-list">
      {examples.map((example) => (
        <ReadableExampleText example={example} key={example} />
      ))}
    </span>
  )
}

function ReadableExampleText({ example }: { example: string }) {
  const subtitle = getKannadaSubtitle(example)

  if (!subtitle) {
    return <span className="readable-example">{example}</span>
  }

  return (
    <span className="readable-example">
      {hasEnglishSubtitleText(subtitle) && (
        <span className="english-subtitle">{formatEnglishSubtitle(subtitle.english)}</span>
      )}
      <KannadaText text={example} subtitle={subtitle} />
      <small className="romanization">{formatRomanizationSubtitle(subtitle.romanization)}</small>
    </span>
  )
}

function GeneratedExerciseSummary({
  exercise,
  source,
}: {
  exercise: GeneratedExercise
  source?: GeneratedExerciseSource | null
}) {
  const context = getGeneratedExerciseReadableContext(exercise)
  const answerHasReadableKannada =
    containsKannada(exercise.answer) &&
    normalizeKannadaText(exercise.answer) !== normalizeKannadaText(exercise.kannada)

  return (
    <span className="generated-exercise-summary">
      <strong>{source ? `${formatGeneratedExerciseSource(source)}: ${exercise.prompt}` : exercise.prompt}</strong>
      <ChoiceText text={exercise.kannada} context={context} />
      <GeneratedExerciseMetadata exercise={exercise} />
      {answerHasReadableKannada && (
        <span className="generated-answer">
          <span>Answer</span>
          <ChoiceText text={exercise.answer} context={context} />
        </span>
      )}
    </span>
  )
}

function GeneratedExerciseMetadata({ exercise }: { exercise: GeneratedExercise }) {
  const metadata = [
    exercise.skillTag ? `Skill: ${exercise.skillTag}` : null,
    typeof exercise.xp === 'number' ? `${exercise.xp} XP` : null,
    exercise.vocabularyIds?.length ? `Vocab: ${exercise.vocabularyIds.slice(0, 3).join(', ')}` : null,
  ].filter((item): item is string => Boolean(item))

  if (!metadata.length) {
    return null
  }

  return <small className="generated-exercise-meta">{metadata.join(' · ')}</small>
}

function getGeneratedExerciseReadableContext(exercise: GeneratedExercise): LessonExercise {
  return {
    id: 'generated-readable-context',
    type: exercise.type,
    prompt: exercise.prompt,
    kannada: exercise.kannada,
    transliteration: getGeneratedExerciseTransliteration(exercise),
    english: getGeneratedExerciseEnglish(exercise),
    answer: exercise.answer,
    options: exercise.options,
    explanation: exercise.explanation ?? 'Generated Kannada practice exercise.',
    skillTag: exercise.skillTag ?? 'generated',
    xp: exercise.xp ?? 0,
    vocabularyIds: exercise.vocabularyIds ?? [],
  }
}

function getGeneratedExerciseEnglish(exercise: GeneratedExercise): string | undefined {
  const explicitEnglish = exercise.english?.trim()
  if (explicitEnglish) {
    return explicitEnglish
  }

  if (exercise.answer && !containsKannada(exercise.answer)) {
    return exercise.answer
  }

  const explanationEnglish = inferEnglishFromExplanation(exercise.explanation)
  if (explanationEnglish) {
    return explanationEnglish
  }

  return getKannadaSubtitle(exercise.kannada)?.english || undefined
}

function getGeneratedExerciseTransliteration(exercise: GeneratedExercise): string | undefined {
  const explicitTransliteration = exercise.transliteration?.trim()
  if (explicitTransliteration) {
    return explicitTransliteration
  }

  return getKannadaSubtitle(exercise.kannada)?.romanization || undefined
}

function inferEnglishFromExplanation(explanation?: string): string | undefined {
  const match = explanation?.match(/\bmeans\s+(?:"([^"]+)"|([^.!]+))/i)
  const english = (match?.[1] ?? match?.[2] ?? '').trim()

  return english && !containsKannada(english) ? english : undefined
}

function hasEnglishSubtitleText(subtitle: ReadableSubtitle): boolean {
  return Boolean(subtitle.english)
}

function formatEnglishSubtitle(english: string): string {
  return `English: ${english}`
}

function formatRomanizationSubtitle(romanization: string): string {
  return `Say: ${romanization}`
}

function formatReadableKannadaChoice(text: string, subtitle: ReadableSubtitle): string {
  return [
    hasEnglishSubtitleText(subtitle) ? formatEnglishSubtitle(subtitle.english) : '',
    text,
    formatRomanizationSubtitle(subtitle.romanization),
  ]
    .filter(Boolean)
    .join(' ')
}

function formatReadablePhrase(phrase: ReadablePhraseParts): string {
  return `${formatEnglishSubtitle(phrase.english)} ${phrase.kannada} ${formatRomanizationSubtitle(phrase.transliteration)}`
}

function formatEnglishFirstPhraseLine(phrase: ReadablePhraseParts): string {
  return `${formatEnglishSubtitle(phrase.english)} | ${formatRomanizationSubtitle(phrase.transliteration)} | Kannada: ${phrase.kannada}`
}

function formatEnglishFirstSubtitleLine(kannada: string, subtitle: ReadableSubtitle): string {
  const english = hasEnglishSubtitleText(subtitle) ? `${formatEnglishSubtitle(subtitle.english)} | ` : ''
  return `${english}${formatRomanizationSubtitle(subtitle.romanization)} | Kannada: ${kannada}`
}

function isStructuredReadableLine(text: string): boolean {
  return /\bEnglish:/i.test(text) && /\bSay:/i.test(text) && /\bKannada:/i.test(text)
}

function formatReadableStoryWord(word: StoryWord): string {
  return formatReadableKannadaChoice(word.text, {
    romanization: word.transliteration,
    english: word.english,
  })
}

function getStoryImageAlt(story: Story): string {
  return `Illustration for ${story.title}: ${story.subtitle.replace(/^Scene:\s*/i, '')}`
}

function getScenarioIconLabel(scenario: Scenario): string {
  return `${scenario.title} ${scenario.difficulty.toLowerCase()} scenario icon`
}

function getTutorPersonaIcon(persona: TutorPersona): string {
  if (persona.id === 'grammar-teacher') {
    return '✏️'
  }

  if (persona.id === 'conversation-coach') {
    return '🎭'
  }

  return '👩‍🏫'
}

function isFlashcardAudioStatus(status: string): boolean {
  return /^Playing (?:Web Speech )?flashcard audio:|^Flashcard Piper/i.test(status)
}

function isStoryAudioStatus(status: string): boolean {
  return /^Playing (?:Web Speech )?story audio:|^Story Piper/i.test(status)
}

function isScriptTransliterationExercise(exercise: LessonExercise): boolean {
  return exercise.type === 'typeKannada' && exercise.skillTag === 'script' && !containsKannada(exercise.answer)
}

function isReverseTranslateExercise(exercise: LessonExercise): boolean {
  return exercise.type === 'translate' && exercise.direction === 'enToKn'
}

function getKannadaSubtitle(text: string, context?: LessonExercise): ReadableSubtitle | null {
  if (!containsKannada(text)) {
    return null
  }

  if (context && (text === context.kannada || shouldUseExerciseAnswerSubtitle(text, context))) {
    return getKannadaOnlySubtitle(text, context)
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

  if (context && (text === context.kannada || shouldUseExerciseAnswerSubtitle(text, context))) {
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

function shouldUseExerciseAnswerSubtitle(text: string, context: LessonExercise): boolean {
  return text === context.answer && (context.type !== 'dialogue' || normalizeKannadaText(context.answer) === normalizeKannadaText(context.kannada))
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

        if (exercise.type === 'matchPairs') {
          for (const pair of exercise.answer.split(';')) {
            const [kannada, english] = pair.split('=').map((part) => part.trim())
            if (kannada && english && containsKannada(kannada) && !containsKannada(english)) {
              addKnownKannadaSubtitle(subtitleMap, kannada, {
                romanization: romanizeKannadaWords(kannada),
                english: exercise.skillTag === 'script' ? `Sounds like ${english}` : english,
              })
            }
          }
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

function buildReviewOptions(phrase: Phrase): string[] {
  const distractors = survivalPhrases
    .map((item) => item.english)
    .filter((english) => english !== phrase.english)

  return [phrase.english, ...distractors].slice(0, 4)
}

function buildReviewMiniExercise(phrase: Phrase, index: number): ReviewMiniExercise {
  const kind = getReviewExerciseKind(index)

  if (kind === 'fillBlank') {
    const blank = getReviewFillBlank(phrase)
    return {
      vocabularyId: phrase.id,
      kind,
      phrase,
      prompt: `Complete the Kannada phrase for "${phrase.english}"`,
      displayText: blank.displayText,
      answer: blank.answer,
      options: buildReviewKannadaOptions(blank.answer),
    }
  }

  if (kind === 'typeKannada') {
    return {
      vocabularyId: phrase.id,
      kind,
      phrase,
      prompt: `Type the Kannada for "${phrase.english}"`,
      displayText: phrase.english,
      answer: phrase.kannada,
      options: [],
    }
  }

  return {
    vocabularyId: phrase.id,
    kind,
    phrase,
    prompt: 'Choose the meaning',
    displayText: phrase.kannada,
    answer: phrase.english,
    options: buildReviewOptions(phrase),
  }
}

function getReviewExerciseKind(index: number): ReviewExerciseKind {
  return ['translate', 'fillBlank', 'typeKannada'][index % 3] as ReviewExerciseKind
}

function getReviewFillBlank(phrase: Phrase): { displayText: string; answer: string } {
  const words = phrase.kannada.split(/\s+/).filter(Boolean)

  if (words.length <= 1) {
    return { displayText: '___', answer: phrase.kannada }
  }

  const answer = words[words.length - 1]
  return {
    displayText: `${words.slice(0, -1).join(' ')} ___`,
    answer,
  }
}

function buildReviewKannadaOptions(answer: string): string[] {
  const distractors = survivalPhrases
    .map((phrase) => getReviewFillBlank(phrase).answer)
    .filter((option, index, options) => option !== answer && options.indexOf(option) === index)

  return [answer, ...distractors].slice(0, 4)
}

function formatLessonExerciseType(type: LessonExercise['type']): string {
  const labels: Record<LessonExercise['type'], string> = {
    translate: 'Translate',
    arrange: 'Arrange words',
    fillBlank: 'Fill in the blank',
    listening: 'Listening',
    speaking: 'Speaking',
    matchPairs: 'Match pairs',
    typeKannada: 'Type Kannada',
    dialogue: 'Dialogue',
  }

  return labels[type]
}

function applyStartingLevelPlacement(
  progress: ProgressState,
  startingLevel: string,
  completedAt: string,
): ProgressState {
  let nextProgress = progress

  if (startingLevel === 'can-read' || startingLevel === 'can-read-script') {
    nextProgress = markPlacementLessonsCompleted(nextProgress, getScriptCurriculumUnit().lessons, completedAt)
  }

  if (startingLevel === 'basic-conversations') {
    nextProgress = unlockCurriculumUnits(
      nextProgress,
      coreCurriculumUnits.slice(0, 3).map((unit) => unit.id),
    )
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

function reinsertWrongExercise(exercises: LessonExercise[], currentIndex: number): LessonExercise[] {
  const wrongExercise = exercises[currentIndex]
  if (!wrongExercise || exercises.slice(currentIndex + 1).some((exercise) => exercise.id === wrongExercise.id)) {
    return exercises
  }

  const updatedExercises = [...exercises]
  updatedExercises.splice(Math.min(currentIndex + 3, exercises.length), 0, wrongExercise)
  return updatedExercises
}

function getLessonProgressSegmentState(
  segmentIndex: number,
  currentIndex: number,
  feedback: 'correct' | 'wrong' | 'almost' | null,
): 'completed' | 'current' | 'wrong' | 'upcoming' {
  if (segmentIndex < currentIndex || (segmentIndex === currentIndex && feedback === 'correct')) {
    return 'completed'
  }

  if (segmentIndex === currentIndex && feedback === 'wrong') {
    return 'wrong'
  }

  if (segmentIndex === currentIndex) {
    return 'current'
  }

  return 'upcoming'
}

function getFeedbackAnswerSummary(exercise: LessonExercise): string {
  if (exercise.kannada && exercise.answer && !containsKannada(exercise.answer)) {
    return formatEnglishFirstSubtitleLine(exercise.kannada, {
      english: exercise.answer,
      romanization: exercise.transliteration ?? romanizeKannadaWords(exercise.kannada),
    })
  }

  if (exercise.answer && exercise.english) {
    if (containsKannada(exercise.answer)) {
      return formatEnglishFirstSubtitleLine(exercise.answer, {
        english: exercise.english,
        romanization: exercise.transliteration ?? romanizeKannadaWords(exercise.answer),
      })
    }

    return `${formatEnglishSubtitle(exercise.english)} | Answer: ${exercise.answer}`
  }

  if (containsKannada(exercise.answer)) {
    return formatEnglishFirstSubtitleLine(exercise.answer, getKannadaSubtitle(exercise.answer, exercise) ?? {
      english: glossKannadaWords(exercise.answer),
      romanization: romanizeKannadaWords(exercise.answer),
    })
  }

  return `Correct answer: ${exercise.answer}`
}

function getWrongFeedbackAnswerSummary(exercise: LessonExercise): string {
  return `Correct answer: ${getFeedbackAnswerSummary(exercise)}`
}

function getReviewFeedbackAnswerSummary(reviewExercise: ReviewMiniExercise): string {
  if (!containsKannada(reviewExercise.answer)) {
    return `Correct answer: ${reviewExercise.answer}`
  }

  if (normalizeKannadaText(reviewExercise.answer) === normalizeKannadaText(reviewExercise.phrase.kannada)) {
    return `Correct answer: ${formatEnglishFirstPhraseLine(reviewExercise.phrase)}`
  }

  return `Correct answer: ${formatEnglishFirstSubtitleLine(reviewExercise.answer, getKannadaSubtitle(reviewExercise.answer) ?? {
    english: glossKannadaWords(reviewExercise.answer),
    romanization: romanizeKannadaWords(reviewExercise.answer),
  })}`
}

function getFeedbackAriaLabel(feedback: 'correct' | 'wrong' | 'almost'): string {
  if (feedback === 'correct') {
    return 'Correct feedback'
  }

  if (feedback === 'wrong') {
    return 'Wrong answer feedback'
  }

  return 'Almost correct feedback'
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

function evaluateTypedTextAnswer(typedAnswer: string, expectedAnswer: string) {
  const typed = normalizeTextAnswer(typedAnswer)
  const expected = normalizeTextAnswer(expectedAnswer)
  const correct = typed === expected
  const distance = levenshteinDistance(typed, expected)

  return {
    correct,
    distance,
    almost: !correct && typed.length > 0 && distance <= 1,
  }
}

function normalizeKannadaAnswer(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[?!.,:;]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTextAnswer(value: string): string {
  return normalizeKannadaAnswer(value).toLocaleLowerCase()
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

function formatNextHeartRecovery(lastHeartLostAt: string | null, nowMs = getNowMs()): string | null {
  if (!lastHeartLostAt) {
    return null
  }

  const lostAtMs = new Date(lastHeartLostAt).getTime()
  if (!Number.isFinite(lostAtMs)) {
    return null
  }

  const remainingMs = lostAtMs + heartRegenerationIntervalMs - nowMs
  if (remainingMs <= 0) {
    return 'Next heart ready now.'
  }

  return `Next heart in ${formatHeartRecoveryDuration(remainingMs)}.`
}

function formatHeartRecoveryDuration(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h`
  }

  return `${minutes}m`
}

function getReminderStatusText(reminder: ReminderPreference): string {
  if (!reminder.enabled) {
    return ''
  }

  if (reminder.permission === 'denied') {
    return 'Reminder alerts are blocked. Enable notifications in system settings to schedule alerts.'
  }

  if (reminder.permission !== 'granted') {
    return 'Allow reminder alerts to schedule desktop notifications.'
  }

  return `Next reminder scheduled for ${formatReminderSchedule(getNextReminderDate(reminder.time))}.`
}

function getWeakSkillPracticeVocabularyIds(
  weakSkills: Array<{ skillTag: string }>,
  units: CurriculumUnit[],
): string[] {
  const weakTags = new Set(weakSkills.map((skill) => skill.skillTag))
  const practiceIds: string[] = []
  const seenIds = new Set<string>()

  const addPracticeId = (vocabularyId: string) => {
    if (seenIds.has(vocabularyId) || practiceIds.length >= weakSkillPracticeLimit) {
      return
    }

    seenIds.add(vocabularyId)
    practiceIds.push(vocabularyId)
  }

  for (const phrase of survivalPhrases) {
    if (weakTags.has(phrase.skillTag)) {
      addPracticeId(phrase.id)
    }
  }

  for (const unit of units) {
    for (const lesson of unit.lessons) {
      for (const exercise of lesson.exercises) {
        if (weakTags.has(exercise.skillTag)) {
          exercise.vocabularyIds.forEach(addPracticeId)
        }
      }
    }
  }

  return practiceIds
}

function App() {
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
  const previousStreakDaysRef = useRef(progress.streakDays)
  const [reminder, setReminder] = useState<ReminderPreference>(() =>
    hydrateReminder(localStorage.getItem(reminderKey)),
  )
  const [reminderDeliveryStatus, setReminderDeliveryStatus] = useState('')
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
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null)
  const [timedOut, setTimedOut] = useState(false)
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
  const [reviewTypedAnswer, setReviewTypedAnswer] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [reviewCorrectCount, setReviewCorrectCount] = useState(0)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [generatedExercise, setGeneratedExercise] = useState('')
  const [latestGeneratedExercise, setLatestGeneratedExercise] = useState<GeneratedExercise | null>(null)
  const [latestGeneratedExerciseSource, setLatestGeneratedExerciseSource] = useState<GeneratedExerciseSource | null>(null)
  const [aiExpansionDeck, setAiExpansionDeck] = useState<GeneratedExercise[]>(() =>
    hydrateAiExpansionDeck(localStorage.getItem(aiExpansionKey)),
  )
  const [modelSetupStarted, setModelSetupStarted] = useState(false)
  const [storyMode, setStoryMode] = useState<StoryMode>('list')
  const [selectedStoryId, setSelectedStoryId] = useState(stories[0].id)
  const [storySentenceIndex, setStorySentenceIndex] = useState(0)
  const [selectedStoryWord, setSelectedStoryWord] = useState<StoryWord | null>(null)
  const [storyVocabularyStatus, setStoryVocabularyStatus] = useState('')
  const [selectedStoryAnswer, setSelectedStoryAnswer] = useState('')
  const [storyFeedback, setStoryFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [tipsUnitId, setTipsUnitId] = useState<string | null>(null)
  const [pendingTipsLessonId, setPendingTipsLessonId] = useState<string | null>(null)
  const [seenTipsUnitIds, setSeenTipsUnitIds] = useState<string[]>(() =>
    hydrateStringList(localStorage.getItem(seenUnitTipsKey)),
  )
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
  const [speakingResult, setSpeakingResult] = useState<PronunciationScoreResult | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<{ left?: string; right?: string }>({})
  const [matchedPairs, setMatchedPairs] = useState<string[]>([])
  const [mismatchedPair, setMismatchedPair] = useState<{ left: string; right: string } | null>(null)
  const [voiceCaptureSession, setVoiceCaptureSession] = useState<VoiceCaptureSession | null>(null)
  const [recordingTarget, setRecordingTarget] = useState<VoiceRecordingTarget | null>(null)
  const [claimedQuestId, setClaimedQuestId] = useState<string | null>(null)
  const [gemPulseKey, setGemPulseKey] = useState(0)

  const activeLesson =
    getLessonById(activeLessonId) ?? getNextAvailableLesson(coreCurriculumUnits, progress) ?? coreCurriculumUnits[0].lessons[0]
  const activeExercise = lessonRunExercises[Math.min(lessonIndex, lessonRunExercises.length - 1)]
  const activeStory = stories.find((story) => story.id === selectedStoryId) ?? stories[0]
  const activeStorySentenceCount = activeStory.sentences.length
  const activeStorySentenceIndex = Math.min(storySentenceIndex, Math.max(0, activeStorySentenceCount - 1))
  const activeStorySentence = activeStory.sentences[activeStorySentenceIndex]
  const isLastStorySentence = activeStorySentenceIndex >= activeStorySentenceCount - 1
  const selectedScenario =
    bangaloreScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? defaultChatScenario
  const activeBangaloreScenario = activeBangaloreScenarioId
    ? bangaloreScenarios.find((scenario) => scenario.id === activeBangaloreScenarioId) ?? null
    : null
  const selectedTutorPersona =
    tutorPersonas.find((persona) => persona.id === selectedTutorPersonaId) ?? defaultTutorPersona
  const activePronunciationPhrase =
    pronunciationPhrases.find((phrase) => phrase.id === pronunciationPhraseId) ?? pronunciationPhrases[0]
  const activeReviewPhrase = getPhraseByVocabularyId(reviewSessionIds[reviewIndex] ?? '')
  const activeReviewExercise = activeReviewPhrase ? buildReviewMiniExercise(activeReviewPhrase, reviewIndex) : null
  const activeReviewTypingPreview =
    activeReviewExercise?.kind === 'typeKannada' ? transliterateLatinToKannada(reviewTypedAnswer) : ''
  const latestPronunciationAttempt = pronunciationHistory[0]
  const reminderStatus = reminderDeliveryStatus || getReminderStatusText(reminder)
  const completedInCurrentLesson = Math.min(
    lessonIndex + (feedback === 'correct' ? 1 : 0),
    lessonRunExercises.length,
  )

  useEffect(() => {
    localStorage.setItem(progressKey, serializeProgress(progress))
  }, [progress])

  useEffect(() => {
    if (progress.streakDays > previousStreakDaysRef.current) {
      playSoundEffect('streak', soundPreferences.soundEffects)
    }

    previousStreakDaysRef.current = progress.streakDays
  }, [progress.streakDays, soundPreferences.soundEffects])

  useEffect(() => {
    if (!claimedQuestId) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setClaimedQuestId(null)
    }, questClaimAnimationMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [claimedQuestId])

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
    if (!reminder.enabled || reminder.permission !== 'granted') {
      return undefined
    }

    let timeoutId: number | undefined
    let active = true

    const scheduleNextReminder = (from = new Date()) => {
      const scheduledFor = getNextReminderDate(reminder.time, from)
      const delayMs = Math.max(0, scheduledFor.getTime() - Date.now())

      timeoutId = window.setTimeout(() => {
        if (!active) {
          return
        }

        const sent = showDailyReminderNotification(reminder.time)
        if (!sent) {
          setReminderDeliveryStatus('Reminder was due, but desktop notifications are unavailable.')
          return
        }

        setReminderDeliveryStatus('Reminder sent. The next reminder has been scheduled.')
        scheduleNextReminder(new Date(Date.now() + 60_000))
      }, delayMs)
    }

    scheduleNextReminder()

    return () => {
      active = false
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [reminder.enabled, reminder.permission, reminder.time])

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
    localStorage.setItem(seenUnitTipsKey, JSON.stringify(seenTipsUnitIds))
  }, [seenTipsUnitIds])

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
          const nextSeenTipsUnitIds = hydrateStringList(localStorage.getItem(seenUnitTipsKey))

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
          setSeenTipsUnitIds(nextSeenTipsUnitIds)
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
  }, [aiExpansionDeck, aiProviderSettings, conversationStore, learnerProfile, learnerStoreReady, progress, pronunciationHistory, reminder, runtimeConfig, seenTipsUnitIds, soundPreferences])

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
    const canUseNativePiper = Boolean(
      synthesizeNativeSpeech &&
      runtimeConfig.piperVoicePath.trim() &&
      runtimeConfig.piperBinaryPath.trim(),
    )

    if (!canUseNativePiper || !synthesizeNativeSpeech) {
      queueMicrotask(() => {
        if (!cancelled) {
          if (playKannadaWithWebSpeech(activeExercise.kannada) === 'played') {
            setAudioStatus(`Auto Web Speech reference: ${getExerciseAudioLabel(activeExercise)}`)
            return
          }

          setAudioStatus(`Auto reference audio: ${getExerciseAudioLabel(activeExercise)}`)
        }
      })
      return () => {
        cancelled = true
      }
    }

    synthesizeNativeSpeech({
      runtimeConfig,
      text: activeExercise.kannada,
    }).then(async (result) => {
      if (!cancelled) {
        if (result.ok && result.audioUrl) {
          const played = await playAudioUrl(result.audioUrl)
          if (cancelled) {
            return
          }

          setAudioStatus(
            played
              ? `Auto Piper audio playing: ${result.audioPath}`
              : `Auto Piper audio ready: ${result.audioPath} (playback unavailable)`,
          )
          return
        }

        setAudioStatus(
          result.ok
            ? `Auto Piper audio ready: ${result.audioPath}`
            : result.error ?? 'Auto reference audio unavailable.',
        )
      }
    }).catch(() => {
      if (!cancelled) {
        setAudioStatus('Auto reference audio unavailable.')
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
    setTimeRemainingSeconds(null)
    setTimedOut(false)
    setPlacedWords([])
    setAudioStatus('')
    setSpeakingResult(null)
    setSelectedMatch({})
    setMatchedPairs([])
    setMismatchedPair(null)
  }

  function openLesson(lessonId?: string) {
    const nextLesson =
      (lessonId ? getLessonById(lessonId) : getNextAvailableLesson(coreCurriculumUnits, progress)) ??
      coreCurriculumUnits[0].lessons[0]
    const masteryLevel = getLessonProgressSummary(progress, nextLesson.id).masteryLevel
    setActiveLessonId(nextLesson.id)
    setLessonRunExercises(getExercisesForMastery(nextLesson, masteryLevel))
    setLessonIndex(0)
    setTotalLessonXp(0)
    setLessonStartedAtMs(getNowMs())
    setCompletedLessonDurationMs(0)
    setLessonCorrectCount(0)
    setLessonWrongCount(0)
    resetExerciseInteraction()
    setScreen('lesson')
  }

  function closeUnitTips() {
    setTipsUnitId(null)
    setPendingTipsLessonId(null)
  }

  function openUnitTips(unit: CurriculumUnit, lessonId?: string) {
    setTipsUnitId(unit.id)
    setPendingTipsLessonId(lessonId ?? unit.lessons[0]?.id ?? null)
  }

  function markUnitTipsSeen(unitId: string) {
    setSeenTipsUnitIds((currentUnitIds) =>
      currentUnitIds.includes(unitId) ? currentUnitIds : [...currentUnitIds, unitId],
    )
  }

  function shouldShowUnitTipsBeforeLesson(unit: CurriculumUnit, lesson: { id: string }, lessonIndex: number) {
    if (!unit.tips.length || lessonIndex !== 0 || seenTipsUnitIds.includes(unit.id)) {
      return false
    }

    return getLessonProgressSummary(progress, lesson.id).masteryLevel === 0
  }

  function openUnitLesson(unit: CurriculumUnit, lesson: { id: string }, lessonIndex: number) {
    if (shouldShowUnitTipsBeforeLesson(unit, lesson, lessonIndex)) {
      openUnitTips(unit, lesson.id)
      return
    }

    openLesson(lesson.id)
  }

  function startTipsLesson(unit: CurriculumUnit) {
    const lessonId = pendingTipsLessonId ?? unit.lessons[0]?.id
    if (!lessonId || (!unit.optional && !isLessonUnlocked(lessonId, progress))) {
      return
    }

    markUnitTipsSeen(unit.id)
    closeUnitTips()
    openLesson(lessonId)
  }

  function checkAnswer(exercise: LessonExercise, submittedAnswer = selectedAnswer, options: { timedOut?: boolean } = {}) {
    if (feedback) {
      return
    }

    setTimedOut(false)
    const typingEvaluation = exercise.type === 'typeKannada'
      ? isScriptTransliterationExercise(exercise)
        ? evaluateTypedTextAnswer(submittedAnswer, exercise.answer)
        : evaluateTypedKannadaAnswer(submittedAnswer, exercise.answer)
      : null
    if (typingEvaluation?.almost) {
      setFeedback('almost')
      setAlmostTypingDistance(typingEvaluation.distance)
      return
    }

    const correct = options.timedOut ? false : typingEvaluation ? typingEvaluation.correct : submittedAnswer === exercise.answer
    const now = new Date().toISOString()
    const completesLesson = correct && lessonIndex === lessonRunExercises.length - 1
    const nextCorrectCount = lessonCorrectCount + (correct ? 1 : 0)
    const nextWrongCount = lessonWrongCount + (correct ? 0 : 1)
    const completesPerfectLesson = completesLesson && nextWrongCount === 0
    const lessonDurationMs = completesLesson ? getNowMs() - lessonStartedAtMs : 0
    setTimedOut(Boolean(options.timedOut && !correct))
    setFeedback(correct ? 'correct' : 'wrong')
    playAppSound(correct ? 'correct' : 'wrong')

    if (correct) {
      setTotalLessonXp((current) => current + exercise.xp)
      setLessonCorrectCount(nextCorrectCount)
    } else {
      setLessonWrongCount(nextWrongCount)
      setLessonRunExercises((current) => reinsertWrongExercise(current, lessonIndex))
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
      playAppSound('lessonComplete')
      setCompletedLessonDurationMs(lessonDurationMs)
      setLessonIndex(lessonRunExercises.length)
      setSelectedAnswer('')
      setFeedback(null)
    }
  }

  useEffect(() => {
    if (
      screen !== 'lesson' ||
      lessonIndex >= lessonRunExercises.length ||
      !activeExercise?.timeLimitSeconds ||
      feedback
    ) {
      return
    }

    const timeLimitSeconds = activeExercise.timeLimitSeconds
    const intervalId = window.setInterval(() => {
      setTimeRemainingSeconds((current) => {
        return Math.max(0, (current ?? timeLimitSeconds) - 1)
      })
    }, 1000)
    const timeoutId = window.setTimeout(() => {
      setTimeRemainingSeconds(0)
      checkAnswer(activeExercise, '', { timedOut: true })
    }, timeLimitSeconds * 1000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  // The timeout must submit the currently visible exercise once when its replay clock expires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExercise?.id, activeExercise?.timeLimitSeconds, feedback, lessonIndex, lessonRunExercises.length, screen])

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

        if (event.key.toLowerCase() === 'r' && replayActiveAudioShortcut()) {
          event.preventDefault()
          return
        }

        if (event.key === 'Enter' && checkActiveShortcut()) {
          event.preventDefault()
          return
        }
      }

      if (event.key === 'Escape') {
        if (tipsUnitId) {
          event.preventDefault()
          closeUnitTips()
          return
        }

        if (selectedStoryWord) {
          event.preventDefault()
          setSelectedStoryWord(null)
          return
        }

        if (screen === 'models') {
          event.preventDefault()
          setScreen('app')
          return
        }

        if (screen === 'app' && tab === 'blr' && activeBangaloreScenarioId) {
          event.preventDefault()
          setActiveBangaloreScenarioId(null)
          return
        }

        if (screen === 'lesson') {
          event.preventDefault()
          setScreen('app')
          return
        }
      }

      if (isEditableShortcutTarget(event.target)) {
        if (event.key === 'Enter' && shouldHandleEditableEnterShortcut()) {
          event.preventDefault()
          checkActiveShortcut()
        }

        return
      }

      if (screen !== 'lesson' || !activeExercise) {
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
        checkActiveShortcut()
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  // The shortcut handler intentionally uses the latest render's lesson actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeBangaloreScenarioId,
    activeBangaloreScenario,
    activeExercise,
    activeReviewExercise,
    activeStorySentence,
    feedback,
    pronunciationPhraseId,
    pronunciationTranscript,
    recordingTarget,
    reviewFeedback,
    reviewIndex,
    reviewSelectedAnswer,
    reviewSessionIds,
    scenarioDialogueAnswer,
    screen,
    selectedAnswer,
    selectedStoryAnswer,
    selectedStoryWord,
    speakingResult,
    storyMode,
    tab,
    tipsUnitId,
    voiceCaptureSession,
  ])

  function shouldHandleEditableEnterShortcut(): boolean {
    return screen === 'lesson' || (screen === 'app' && tab === 'practice')
  }

  function replayActiveAudioShortcut(): boolean {
    if (screen === 'lesson' && activeExercise) {
      void playExerciseReference(activeExercise)
      return true
    }

    if (screen !== 'app') {
      return false
    }

    if (tab === 'practice') {
      void playPronunciationReference()
      return true
    }

    if (tab === 'stories' && storyMode === 'reader' && activeStorySentence) {
      void playStorySentenceAudio(activeStorySentence)
      return true
    }

    if (tab === 'blr' && activeBangaloreScenario) {
      const firstPhrase = activeBangaloreScenario.usefulPhrases[0]
      if (firstPhrase) {
        void playScenarioPhraseAudio(firstPhrase)
        return true
      }
    }

    return false
  }

  function checkActiveShortcut(): boolean {
    if (screen === 'lesson' && activeExercise) {
      if (feedback === 'correct' || feedback === 'wrong') {
        goToNextExercise()
        return true
      }

      if (!feedback && activeExercise.type === 'speaking') {
        if (speakingResult?.score && speakingResult.score >= 70) {
          continueSpeakingExercise(activeExercise)
        }
        return true
      }

      if (!feedback && selectedAnswer) {
        checkAnswer(activeExercise)
      }
      return true
    }

    if (screen !== 'app') {
      return false
    }

    if (tab === 'practice') {
      if (reviewSessionIds.length > 0) {
        if (reviewFeedback) {
          goToNextReview()
          return true
        }

        if (activeReviewExercise && reviewSelectedAnswer) {
          checkReviewAnswer(activeReviewExercise)
        }
        return true
      }

      scorePronunciationPractice()
      return true
    }

    if (tab === 'stories' && storyMode === 'quiz') {
      if (selectedStoryAnswer) {
        checkStoryAnswer()
      }
      return true
    }

    if (tab === 'blr' && activeBangaloreScenario) {
      if (scenarioDialogueAnswer) {
        checkScenarioDialogue(activeBangaloreScenario)
      }
      return true
    }

    return false
  }

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
      playAppSound('tap')
      setTypedAnswer(option)
      setSelectedAnswer(transliterateLatinToKannada(option))
      return
    }

    playAppSound('tap')
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

    playAppSound('tap')
    const nextWords = [...placedWords, word]
    setPlacedWords(nextWords)
    setSelectedAnswer(nextWords.join(' '))
  }

  function removeArrangeWord(wordIndex: number) {
    playAppSound('tap')
    const nextWords = placedWords.filter((_word, index) => index !== wordIndex)
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
        setSpeakingResult(result)

        if (result.score >= 70) {
          setSelectedAnswer(exercise.answer)
        }
      },
      setAudioStatus,
    )
  }

  function retrySpeakingExercise() {
    setSpeakingResult(null)
    setSelectedAnswer('')
  }

  function continueSpeakingExercise(exercise: LessonExercise) {
    if (!speakingResult || speakingResult.score < 70) {
      return
    }

    setSelectedAnswer(exercise.answer)
    checkAnswer(exercise, exercise.answer)
  }

  function handleMatchSelection(value: string, side: 'left' | 'right', exercise: LessonExercise) {
    playAppSound('tap')
    const nextSelection = { ...selectedMatch, [side]: value }
    const pairs = parseMatchPairs(exercise.answer)

    if (nextSelection.left && nextSelection.right) {
      const pairId = getMatchPairId(nextSelection.left, nextSelection.right)
      const isCorrect = pairs.some(
        (pair) => pair.left === nextSelection.left && pair.right === nextSelection.right,
      )

      if (isCorrect && !matchedPairs.includes(pairId)) {
        const nextMatches = [...matchedPairs, pairId]
        setMatchedPairs(nextMatches)
        if (nextMatches.length === pairs.length) {
          checkAnswer(exercise, exercise.answer)
        }
      }

      if (!isCorrect) {
        const nextMismatch = { left: nextSelection.left, right: nextSelection.right }
        setMismatchedPair(nextMismatch)
        window.setTimeout(() => {
          setMismatchedPair((current) =>
            current?.left === nextMismatch.left && current.right === nextMismatch.right ? null : current,
          )
        }, 500)
      }

      setSelectedMatch({})
      return
    }

    setSelectedMatch(nextSelection)
  }

  async function generateAiExercise() {
    const weakArea = Object.keys(progress.weakAreas)[0] ?? 'verbs'
    const promptContext = getAiExercisePromptContext(weakArea)
    const result = await generateExerciseWithPreferredProvider(weakArea, promptContext)

    setGeneratedExercise(formatGeneratedExerciseStatus(result.source, result.exercise))
    setLatestGeneratedExercise(result.exercise)
    setLatestGeneratedExerciseSource(result.source)
    setAiExpansionDeck((current) => [result.exercise, ...current].slice(0, 8))
  }

  function getAiExercisePromptContext(weakArea: string): ExercisePromptContext {
    return {
      difficultyLevel: formatAdaptiveDifficultyForAiPrompt(getAdaptiveDifficulty(progress, new Date().toISOString()).level),
      weakAreas: progress.weakAreas,
      targetSkillTag: weakArea,
      vocabularyList: getAiExerciseVocabularyList(weakArea, allCurriculumUnits),
    }
  }

  async function generateExerciseWithPreferredProvider(weakArea: string, promptContext: ExercisePromptContext) {
    if (aiProviderSettings.activeProvider === 'openrouter' || aiProviderSettings.activeProvider === 'nvidia') {
      return generateExerciseWithHostedProvider({
        hostedChatCompletion: window.kannadaOS?.generateHostedChat,
        providerSettings: aiProviderSettings,
        weakArea,
        promptContext,
      })
    }

    if (aiProviderSettings.activeProvider === 'ollama') {
      const ollamaResult = await generateExerciseWithOllama({ weakArea, promptContext })
      return ollamaResult.source === 'ollama'
        ? ollamaResult
        : generateExerciseWithHostedFallback(weakArea, promptContext, ollamaResult)
    }

    return generateExerciseWithLocalPreference(weakArea, promptContext)
  }

  async function generateExerciseWithLocalPreference(weakArea: string, promptContext: ExercisePromptContext) {
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
        promptContext,
        generateNativeExercise: nativeGenerator,
      })
      : null

    if (nativeResult?.source === 'native') {
      return nativeResult
    }

    const ollamaResult = await generateExerciseWithOllama({ weakArea, promptContext })
    return ollamaResult.source === 'ollama'
      ? ollamaResult
      : generateExerciseWithHostedFallback(weakArea, promptContext, ollamaResult)
  }

  async function generateExerciseWithHostedFallback(
    weakArea: string,
    promptContext: ExercisePromptContext,
    fallbackResult: Awaited<ReturnType<typeof generateExerciseWithOllama>>,
  ) {
    const hostedFallbackSettings = getConfiguredHostedExerciseFallbackSettings(aiProviderSettings)

    if (!hostedFallbackSettings) {
      return fallbackResult
    }

    return generateExerciseWithHostedProvider({
      hostedChatCompletion: window.kannadaOS?.generateHostedChat,
      providerSettings: hostedFallbackSettings,
      weakArea,
      promptContext,
    })
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
    const offlineTutorReply = buildTutorReply(text, selectedScenario, selectedTutorPersona)
    let tutorReply = offlineTutorReply
    const preserveVoiceTranscriptStatus = Boolean(subtext)
    const setProviderStatus = (status: string) => {
      if (!preserveVoiceTranscriptStatus) {
        setVoiceStatus(status)
      }
    }

    if (aiProviderSettings.activeProvider === 'openrouter' || aiProviderSettings.activeProvider === 'nvidia') {
      const providerLabel = getAiProviderLabel(aiProviderSettings.activeProvider)
      setProviderStatus(`Asking ${providerLabel}...`)
      const hostedReply = await generateTutorReplyWithHostedProvider({
        hostedChatCompletion: window.kannadaOS?.generateHostedChat,
        providerSettings: aiProviderSettings,
        learnerText: text,
        scenarioTitle: selectedScenario.title,
        scenarioSituation: selectedScenario.situation,
        personaName: selectedTutorPersona.name,
        personaStyle: selectedTutorPersona.style,
        correctionStyle: selectedTutorPersona.correctionStyle,
        usefulPhrases: selectedScenario.usefulPhrases.map((phrase) => `${phrase.kannada} = ${phrase.transliteration} = ${phrase.english}`),
      })

      if (hostedReply.source === aiProviderSettings.activeProvider) {
        tutorReply = {
          text: hostedReply.text,
          subtext: formatTutorPhraseSupport(
            selectedTutorPersona,
            selectedScenario.usefulPhrases[0],
            `${providerLabel}: ${getActiveHostedModel(aiProviderSettings)}.`,
          ),
          correction: offlineTutorReply.correction,
        }
        setProviderStatus(`${providerLabel} tutor reply ready.`)
      } else {
        const ollamaReply = await generateOllamaTutorReply(text)
        if (ollamaReply.source === 'ollama') {
          tutorReply = {
            text: ollamaReply.text,
            subtext: formatTutorPhraseSupport(
              selectedTutorPersona,
              selectedScenario.usefulPhrases[0],
              'Ollama local tutor reply.',
            ),
            correction: offlineTutorReply.correction,
          }
          setProviderStatus(`${providerLabel} unavailable; Ollama tutor reply ready.`)
        } else {
          const fallbackReason = [hostedReply.error, ollamaReply.error].filter(Boolean).join(' ')
          setProviderStatus(`${providerLabel} unavailable; Ollama unavailable; using offline tutor. ${fallbackReason}`.trim())
        }
      }
    } else if (aiProviderSettings.activeProvider === 'local' || aiProviderSettings.activeProvider === 'ollama') {
      setProviderStatus('Asking Ollama...')
      const ollamaReply = await generateOllamaTutorReply(text)

      if (ollamaReply.source === 'ollama') {
        tutorReply = {
          text: ollamaReply.text,
          subtext: formatTutorPhraseSupport(
            selectedTutorPersona,
            selectedScenario.usefulPhrases[0],
            'Ollama local tutor reply.',
          ),
          correction: offlineTutorReply.correction,
        }
        setProviderStatus('Ollama tutor reply ready.')
      } else {
        setProviderStatus(`Ollama unavailable; using offline tutor. ${ollamaReply.error ?? ''}`.trim())
      }
    }

    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { id: `learner-${getNowMs()}`, speaker: 'learner', text, subtext },
      { id: `tutor-${getNowMs()}`, speaker: 'tutor', ...tutorReply },
    ]
    const trimmedMessages = trimConversationMessages(nextMessages)
    setChatMessages(trimmedMessages)
    setProgress((current) => recordChatMessageSent(current))
    setConversationStore((current) => appendScenarioMessages(current, selectedScenario.id, trimmedMessages))
  }

  function generateOllamaTutorReply(text: string) {
    return generateTutorReplyWithOllama({
      learnerText: text,
      scenarioTitle: selectedScenario.title,
      scenarioSituation: selectedScenario.situation,
      personaName: selectedTutorPersona.name,
      personaStyle: selectedTutorPersona.style,
      correctionStyle: selectedTutorPersona.correctionStyle,
      usefulPhrases: selectedScenario.usefulPhrases.map((phrase) => `${phrase.kannada} = ${phrase.transliteration} = ${phrase.english}`),
    })
  }

  function selectChatScenario(scenarioId: string) {
    const scenario = bangaloreScenarios.find((item) => item.id === scenarioId) ?? defaultChatScenario
    setSelectedScenarioId(scenario.id)
    setChatMessages(getScenarioMessages(conversationStore, scenario.id, [createOpeningMessage(scenario)]))
    setChatInput('')
    setVoiceStatus('')
  }

  function toggleScenarioChecklist(scenario: Scenario, item: string) {
    setProgress((current) => toggleScenarioChecklistItem(current, scenario.id, item, scenario.checklist, new Date().toISOString()))
  }

  function openBangaloreScenario(scenarioId: string) {
    setActiveBangaloreScenarioId(scenarioId)
    setScenarioDialogueAnswer('')
    setScenarioDialogueFeedback('')
    setAudioStatus('')
  }

  async function playScenarioPhraseAudio(phrase: ReadablePhraseParts) {
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      if (playKannadaWithWebSpeech(phrase.kannada) === 'played') {
        setAudioStatus(`Playing Web Speech scenario audio: ${phrase.transliteration}`)
        return
      }

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
    setReminderDeliveryStatus('')
    setReminder((current) => {
      const notificationPermission = getCurrentReminderNotificationPermission()

      return {
        ...current,
        enabled: !current.enabled,
        permission: notificationPermission === 'default' ? current.permission : notificationPermission,
      }
    })
  }

  function setReminderTime(time: string) {
    setReminderDeliveryStatus('')
    setReminder((current) => ({ ...current, time }))
  }

  function setDailyGoal(goal: number) {
    setLearnerProfile((current) => ({ ...current, dailyGoalXp: goal }))
  }

  function toggleSoundPreference(key: keyof SoundPreferences) {
    setSoundPreferences((current) => ({ ...current, [key]: !current[key] }))
  }

  async function allowReminderAlerts() {
    const permission = await requestReminderNotificationPermission()

    setReminder((current) => ({
      ...current,
      permission,
    }))
    setReminderDeliveryStatus(
      permission === 'granted'
        ? ''
        : permission === 'denied'
          ? 'Reminder alerts are blocked. Enable notifications in system settings to schedule alerts.'
          : 'Reminder alerts are still waiting for permission.',
    )
  }

  function claimQuestReward(quest: DailyQuest) {
    if (!quest.completed || quest.claimed) {
      return
    }

    playAppSound('gemEarn')
    setClaimedQuestId(quest.id)
    setGemPulseKey((current) => current + 1)
    setProgress((current) => claimDailyQuestReward(current, quest, new Date().toISOString()))
  }

  function playAppSound(name: SoundEffectName) {
    playSoundEffect(name, soundPreferences.soundEffects)
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
    setReviewTypedAnswer('')
    setReviewFeedback(null)
    setReviewCorrectCount(0)
  }

  function checkReviewAnswer(reviewExercise: ReviewMiniExercise) {
    if (reviewFeedback || !reviewSelectedAnswer) {
      return
    }

    const correct =
      reviewExercise.kind === 'translate'
        ? reviewSelectedAnswer === reviewExercise.answer
        : normalizeKannadaAnswer(reviewSelectedAnswer) === normalizeKannadaAnswer(reviewExercise.answer)
    const now = new Date().toISOString()
    const reviewExerciseId = `review-${reviewExercise.vocabularyId}`
    setReviewFeedback(correct ? 'correct' : 'wrong')
    playAppSound(correct ? 'correct' : 'wrong')

    if (correct) {
      setReviewCorrectCount((current) => current + 1)
    }

    setProgress((current) => {
      const ratedProgress = rateReviewItem(current, reviewExercise.vocabularyId, correct ? 'easy' : 'hard', now)

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
    setReviewTypedAnswer('')
    setReviewFeedback(null)
  }

  function resetReviewSession() {
    setReviewSessionIds([])
    setReviewIndex(0)
    setReviewSelectedAnswer('')
    setReviewTypedAnswer('')
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
      if (playKannadaWithWebSpeech(exercise.kannada, playbackRate) === 'played') {
        const audioLabel = getExerciseAudioLabel(exercise)
        setAudioStatus(
          slow
            ? `Playing slow Web Speech reference at 0.7x: ${audioLabel}`
            : `Playing Web Speech reference: ${audioLabel}`,
        )
        return
      }

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

  function playKannadaWithWebSpeech(text: string, playbackRate = 1): WebSpeechResult {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      return 'unavailable'
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'kn-IN'
    utterance.rate = playbackRate
    const kannadaVoice = speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase() === 'kn-in')
    if (kannadaVoice) {
      utterance.voice = kannadaVoice
    }

    speechSynthesis.speak(utterance)
    return 'played'
  }

  async function playAudioUrl(audioUrl: string, playbackRate = 1): Promise<boolean> {
    try {
      const audio = new Audio(audioUrl)
      audio.playbackRate = playbackRate
      await audio.play()
      return true
    } catch {
      return false
    }
  }

  function getExerciseAudioLabel(exercise: LessonExercise): string {
    return exercise.transliteration ?? getKannadaSubtitle(exercise.kannada, exercise)?.romanization ?? exercise.kannada
  }

  async function playFlashcardAudio(phrase: Phrase) {
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      if (playKannadaWithWebSpeech(phrase.kannada) === 'played') {
        setAudioStatus(`Playing Web Speech flashcard audio: ${phrase.transliteration}`)
        return
      }

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

  async function playStorySentenceAudio(sentence: StorySentence) {
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      if (playKannadaWithWebSpeech(sentence.kannada) === 'played') {
        setAudioStatus(`Playing Web Speech story audio: ${sentence.transliteration}`)
        return
      }

      setAudioStatus(`Playing story audio: ${sentence.transliteration}`)
      return
    }

    setAudioStatus('Story Piper synthesis running...')
    const result = await synthesizeNativeSpeech({
      runtimeConfig,
      text: sentence.kannada,
    })

    if (result.ok) {
      if (result.audioUrl) {
        try {
          const audio = new Audio(result.audioUrl)
          await audio.play()
        } catch {
          setAudioStatus(`Story Piper audio ready: ${result.audioPath} (playback unavailable)`)
          return
        }
      }

      setAudioStatus(`Story Piper audio ready: ${result.audioPath}`)
      return
    }

    setAudioStatus(result.error ?? 'Story Piper synthesis failed.')
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

  function openPronunciationLab() {
    const heading = document.getElementById('pronunciation-lab-title')
    heading?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    heading?.focus()
  }

  async function playPronunciationReference(playbackRate = 1) {
    const slow = playbackRate < 1
    const synthesizeNativeSpeech = window.kannadaOS?.synthesizeNativeSpeech
    if (!synthesizeNativeSpeech || !runtimeConfig.piperVoicePath.trim() || !runtimeConfig.piperBinaryPath.trim()) {
      if (playKannadaWithWebSpeech(activePronunciationPhrase.kannada, playbackRate) === 'played') {
        setPronunciationAudioStatus(
          slow
            ? `Playing slow Web Speech reference at 0.7x: ${activePronunciationPhrase.transliteration}`
            : `Playing Web Speech reference: ${activePronunciationPhrase.transliteration}`,
        )
        return
      }

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

  function retryPronunciationPractice() {
    setPronunciationResult(null)
    setPronunciationTranscript('')
    setPronunciationAudioStatus('')
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
    setStorySentenceIndex(0)
    setSelectedStoryWord(null)
    setStoryVocabularyStatus('')
    setSelectedStoryAnswer('')
    setStoryFeedback(null)
    setStoryMode('reader')
  }

  function unlockStoryEarly(storyId: string) {
    setProgress((current) => unlockStoryWithGems(current, storyId))
  }

  function returnToStoryList() {
    setSelectedStoryWord(null)
    setStoryVocabularyStatus('')
    setStorySentenceIndex(0)
    setStoryMode('list')
  }

  function goToNextStorySentence() {
    setSelectedStoryWord(null)
    setStoryVocabularyStatus('')
    setStorySentenceIndex((current) => Math.min(current + 1, Math.max(0, activeStory.sentences.length - 1)))
  }

  function openStoryQuiz() {
    setSelectedStoryWord(null)
    setStoryVocabularyStatus('')
    setSelectedStoryAnswer('')
    setStoryFeedback(null)
    setStoryMode('quiz')
  }

  function addSelectedStoryWordToVocabulary() {
    if (!selectedStoryWord) {
      return
    }

    const { vocabularyId, english } = selectedStoryWord
    const alreadySaved = Boolean(progress.reviewQueue[vocabularyId])

    if (!alreadySaved) {
      const now = new Date().toISOString()

      setProgress((current) => ({
        ...current,
        reviewQueue: {
          ...current.reviewQueue,
          [vocabularyId]: {
            vocabularyId,
            dueAt: now,
            strength: 0.2,
            attempts: 0,
            leitnerBox: 1,
          },
        },
      }))
    }

    setStoryVocabularyStatus(
      alreadySaved ? `${english} is already in vocabulary review.` : `${english} added to vocabulary review.`,
    )
  }

  function checkStoryAnswer() {
    if (selectedStoryAnswer === activeStory.quiz.answer) {
      setStoryFeedback('correct')
      setStoryMode('complete')
      playAppSound('lessonComplete')
      setProgress((current) =>
        applyExerciseResult(current, {
          exerciseId: `story-${activeStory.id}`,
          correct: true,
          skillTag: 'story',
          xp: storyQuizXp,
          vocabularyIds: activeStory.sentences.flatMap((sentence) =>
            sentence.words.map((word) => `${activeStory.id}:${word.text}`),
          ),
          now: new Date().toISOString(),
        }),
      )
      return
    }

    setStoryFeedback('wrong')
    playAppSound('wrong')
  }

  if (screen === 'onboarding') {
    const selectedStartingLevelOption = startingLevelOptions.find((option) => option.id === selectedStartingLevel) ?? startingLevelOptions[0]

    return (
      <main className="app-shell onboarding-shell">
        <section className="splash-panel" aria-labelledby="onboarding-title">
          <ReadableKannadaMark className="logo-mark" english="Kannada letter ka" text="ಕ" transliteration="ka" />
          {onboardingStep === 'welcome' && (
            <>
              <p className="eyebrow">Offline Kannada AI teacher</p>
              <div className="welcome-phrase">
                <span aria-hidden="true">🇮🇳</span>
                <EnglishFirstKannadaText
                  phrase={{
                    english: 'Hello',
                    kannada: 'ನಮಸ್ಕಾರ!',
                    transliteration: 'namaskara',
                    context: 'Learn Kannada the Bangalore way.',
                  }}
                  showContext
                />
              </div>
              <h1 id="onboarding-title">KannadaOS</h1>
              <p className="lead">
                Real Bangalore Kannada for buses, autos, darshinis, offices, and daily life.
              </p>
              <button className="primary-action" onClick={() => setOnboardingStep('profile')} type="button">
                Get Started →
              </button>
            </>
          )}

          {onboardingStep === 'profile' && (
            <>
              <p className="eyebrow">Step 2 of 3</p>
              <h1 id="onboarding-title">Choose your Kannada path</h1>
              <section className="onboarding-choice-section" aria-labelledby="motivation-title">
                <h2 id="motivation-title">Why are you learning Kannada?</h2>
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
              </section>
              <section className="onboarding-choice-section" aria-labelledby="starting-level-title">
                <h2 id="starting-level-title">What is your current Kannada level?</h2>
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
              </section>
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
                {dailyGoalOptions.map((goal) => {
                  const details = getDailyGoalDetails(goal)
                  return (
                    <button
                      className={selectedDailyGoalXp === goal ? 'choice-card selected' : 'choice-card'}
                      key={goal}
                      onClick={() => setSelectedDailyGoalXp(goal)}
                      type="button"
                    >
                      <span>{details.name}</span>
                      <small>{details.minutesPerDay} min / day - {goal} XP</small>
                      <small>{details.description}</small>
                    </button>
                  )
                })}
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
      const earnedCrownLevel = getLessonProgressSummary(progress, activeLesson.id).masteryLevel
      const crownRating = formatCrownRating(earnedCrownLevel)

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
            <div className="crown-earned-burst" aria-label={`${crownRating} crown level earned`}>
              <span className="crown-icon" aria-hidden="true">👑</span>
              <div className="crown-fill-row" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <span className={index < earnedCrownLevel ? 'filled' : ''} key={index} />
                ))}
              </div>
              <small>{crownRating} Crown earned</small>
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
              <Stat value={crownRating} label="Crown" />
            </div>
            <div className="completion-actions">
              <button className="primary-action" onClick={() => openLesson()} type="button">
                Continue Learning
              </button>
              <button className="secondary-action" onClick={() => setScreen('app')} type="button">
                Back to Home
              </button>
            </div>
          </section>
        </main>
      )
    }

    return (
      <main className="app-shell lesson-shell">
        <header className="lesson-topbar">
          <button
            aria-keyshortcuts="Escape"
            className="icon-button"
            onClick={() => setScreen('app')}
            type="button"
            aria-label="Close lesson"
          >
            x
          </button>
          <div
            className="lesson-progress"
            aria-label={`Lesson progress: ${completedInCurrentLesson} of ${lessonRunExercises.length} exercises complete`}
          >
            {lessonRunExercises.map((exercise, index) => {
              const segmentState = getLessonProgressSegmentState(index, lessonIndex, feedback)
              return (
                <span
                  aria-label={`Exercise ${index + 1} of ${lessonRunExercises.length}: ${segmentState}`}
                  className={`lesson-progress-segment ${segmentState}`}
                  key={`${exercise.id}-${index}`}
                />
              )
            })}
          </div>
          <strong aria-label="Lesson hearts">❤️ {progress.hearts}</strong>
          {activeExercise.timeLimitSeconds && !feedback && (
            <strong
              aria-label={`${timeRemainingSeconds ?? activeExercise.timeLimitSeconds} seconds remaining`}
              className="lesson-timer"
              role="timer"
            >
              ⏱ {timeRemainingSeconds ?? activeExercise.timeLimitSeconds}s
            </strong>
          )}
        </header>
        <section className="lesson-card" aria-labelledby="lesson-title">
          <p className="eyebrow">
            <span>{formatLessonExerciseType(activeExercise.type)}</span>
            <small>{activeLesson.title}</small>
            {activeExercise.timeLimitSeconds && <small>{activeExercise.timeLimitSeconds}s timed</small>}
          </p>
          <h1 id="lesson-title">{activeExercise.prompt}</h1>
          {renderExerciseContent(activeExercise)}
          {activeExercise.type !== 'speaking' && activeExercise.type !== 'matchPairs' && (
            <button
              aria-keyshortcuts={checkAnswerShortcuts}
              className="primary-action"
              disabled={!selectedAnswer}
              onClick={() => checkAnswer(activeExercise)}
              type="button"
            >
              Check
            </button>
          )}
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
              aria-label={getFeedbackAriaLabel(feedback)}
            >
              {feedback === 'correct' && (
                <>
                  <div className="feedback-header">
                    <strong>Correct!</strong>
                    <span>+{activeExercise.xp} XP</span>
                  </div>
                  <p><ReadableStatusText text={getFeedbackAnswerSummary(activeExercise)} context={activeExercise} /></p>
                  <p><ReadableStatusText text={activeExercise.explanation} context={activeExercise} /></p>
                </>
              )}
              {feedback === 'wrong' && (
                <>
                  <div className="feedback-header">
                    <strong>{timedOut ? "Time's up." : 'Not quite.'}</strong>
                    <span className="heart-loss-indicator">❤️ -1</span>
                  </div>
                  <p><ReadableStatusText text={getWrongFeedbackAnswerSummary(activeExercise)} context={activeExercise} /></p>
                  <p><ReadableStatusText text={activeExercise.explanation} context={activeExercise} /></p>
                </>
              )}
              {feedback === 'almost' && (
                <>
                  <div className="feedback-header">
                    <strong>Almost! Check: {almostTypingDistance}</strong>
                  </div>
                  <p>Fix the Kannada spelling and try again.</p>
                </>
              )}
            </div>
          )}
          {feedback === 'correct' && (
            <button aria-keyshortcuts={checkAnswerShortcuts} className="secondary-action" onClick={goToNextExercise} type="button">
              Continue → Next Exercise
            </button>
          )}
          {feedback === 'wrong' && (
            <button aria-keyshortcuts={checkAnswerShortcuts} className="secondary-action" onClick={goToNextExercise} type="button">
              Got it → This question will return.
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
      <header className="app-titlebar" aria-label="App title bar">
        <div className="titlebar-copy">
          <strong>KannadaOS</strong>
          <span>Desktop Kannada learning</span>
        </div>
        <div className="titlebar-status" aria-label="Current app state">
          <span>{navigationItems.find((item) => item.id === tab)?.label ?? 'Home'}</span>
          <span>{formatStreakCounter(progress.streakDays)}</span>
          <span>❤️ {progress.hearts}</span>
        </div>
      </header>
      <div className="desktop-body">
        <aside className="sidebar" aria-label="Primary navigation">
          <div>
            <div className="brand-lockup">
              <ReadableKannadaMark className="brand-mark" english="Kannada letter ka" text="ಕ" transliteration="ka" />
              <div>
                <strong>KannadaOS</strong>
                <p>
                  <EnglishFirstKannadaText
                    phrase={{
                      english: 'Learn Kannada',
                      kannada: 'ಕನ್ನಡ ಕಲಿಯಿರಿ',
                      transliteration: 'kannada kaliyiri',
                    }}
                  />
                </p>
              </div>
            </div>
            <nav className="nav-stack">
              {navigationItems.map(({ id, icon, label }, index) => {
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
                    aria-keyshortcuts={`Meta+${index + 1} Control+${index + 1}`}
                    className={tab === id ? 'nav-button active' : 'nav-button'}
                    key={id}
                    onClick={() => setTab(id)}
                    type="button"
                  >
                    <span className="nav-icon" aria-hidden="true">{icon}</span>
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
            {latestGeneratedExercise && (
              <GeneratedExerciseSummary exercise={latestGeneratedExercise} source={latestGeneratedExerciseSource} />
            )}
            {aiExpansionDeck.length > 0 && (
              <div className="ai-expansion-queue" aria-label="AI curriculum expansion">
                <strong>AI Expansion Queue</strong>
                <span>
                  {aiExpansionDeck.length} saved {aiExpansionDeck.length === 1 ? 'drill' : 'drills'} for curriculum review
                </span>
                <ul>
                  {aiExpansionDeck.slice(0, 3).map((exercise, index) => (
                    <li key={`${exercise.prompt}-${index}`}>
                      <GeneratedExerciseSummary exercise={exercise} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </aside>
        <section className="workspace">{renderTab()}</section>
      </div>
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
            {allCurriculumUnits.map((unit) => {
              const unlockedUnit = unlockedUnitIds.has(unit.id)
              const unitNumber = unit.optional ? 0 : coreCurriculumUnits.findIndex((coreUnit) => coreUnit.id === unit.id) + 1
              const unitProgress = getUnitCompletionSummary(unit, progress)
              return (
                <article
                  className={unlockedUnit ? 'map-node unit-node current' : 'map-node unit-node locked'}
                  key={unit.id}
                >
                  {unit.optional ? (
                    <ReadableKannadaMark className="script-unit-mark" english="Kannada letter a" text="ಅ" transliteration="a" />
                  ) : (
                    <span>{unlockedUnit ? '★' : 'lock'}</span>
                  )}
                  <strong>Unit {unitNumber}: {unit.title}</strong>
                  <small>{unit.description}</small>
                  <div className="unit-progress-summary">
                    <div
                      aria-label={`Unit ${unitNumber}: ${unit.title} progress`}
                      aria-valuemax={unitProgress.totalLessons}
                      aria-valuemin={0}
                      aria-valuenow={unitProgress.completedLessons}
                      className="unit-progress-track"
                      role="progressbar"
                    >
                      <span style={{ width: `${unitProgress.percent}%` }} />
                    </div>
                    <small>{unitProgress.completedLessons}/{unitProgress.totalLessons} lessons</small>
                  </div>
                  <button className="secondary-action compact-action" onClick={() => openUnitTips(unit)} type="button">
                    Tips
                  </button>
                  <div className="lesson-dot-row">
                    {unit.lessons.map((lesson, unitLessonIndex) => {
                      const lessonProgress = getLessonProgressSummary(progress, lesson.id)
                      const crownRating = formatCrownRating(lessonProgress.masteryLevel)
                      const unlocked = unit.optional || isLessonUnlocked(lesson.id, progress)
                      return (
                        <button
                          aria-label={`Learn unit ${unitNumber} lesson ${unitLessonIndex + 1}: ${lesson.title}, ${lessonProgress.masteryLevel} crowns, ${crownRating}`}
                          className={lessonProgress.completed ? 'lesson-dot done' : unlocked ? 'lesson-dot current' : 'lesson-dot locked'}
                          disabled={!unlocked}
                          key={lesson.id}
                          onClick={() => openUnitLesson(unit, lesson, unitLessonIndex)}
                          type="button"
                        >
                          <span className="lesson-state-icon" aria-hidden="true">
                            {unlocked ? (lessonProgress.masteryLevel || '•') : '🔒'}
                          </span>
                          <span className="lesson-row-copy">
                            <strong>Lesson {unitLessonIndex + 1}: {lesson.title}</strong>
                            <small>{lesson.subtitle}</small>
                          </span>
                          <span className="lesson-crown-rating" aria-hidden="true">
                            {unlocked ? crownRating : '🔒'}
                          </span>
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
                  <button className="icon-button" onClick={closeUnitTips} type="button" aria-label="Close tips">
                    x
                  </button>
                </header>
                {activeTipsUnit.tips.map((tip) => (
                  <article className="tip-row" key={tip.title}>
                    <strong><ReadableStatusText text={tip.title} /></strong>
                    <p><ReadableStatusText text={tip.body} /></p>
                    <ReadableExampleList examples={tip.examples} />
                  </article>
                ))}
                <button
                  className="primary-action"
                  disabled={Boolean(pendingTipsLessonId && !activeTipsUnit.optional && !isLessonUnlocked(pendingTipsLessonId, progress))}
                  onClick={() => startTipsLesson(activeTipsUnit)}
                  type="button"
                >
                  Got it -&gt; Start Lesson
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
              <h2 id="chat-title">Tutor Chat</h2>
            </div>
            <span className="metric-pill">Scenario: {selectedScenario.title}</span>
          </header>
          <div className="chat-selector-row">
            <label className="chat-select-field">
              <span id="chat-scenario-label">Scenario</span>
              <select
                aria-labelledby="chat-scenario-label"
                onChange={(event) => selectChatScenario(event.target.value)}
                value={selectedScenario.id}
              >
                {bangaloreScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.title} - {scenario.difficulty}
                  </option>
                ))}
              </select>
            </label>
            <label className="chat-select-field">
              <span id="chat-persona-label">Persona</span>
              <select
                aria-labelledby="chat-persona-label"
                onChange={(event) => setSelectedTutorPersonaId(event.target.value)}
                value={selectedTutorPersona.id}
              >
                {tutorPersonas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name} - {persona.correctionStyle}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <section
            className="persona-style-card"
            aria-label={`Tutor persona: ${selectedTutorPersona.name}`}
          >
            <span className="persona-avatar" aria-hidden="true">
              {getTutorPersonaIcon(selectedTutorPersona)}
            </span>
            <div>
              <strong>{selectedTutorPersona.name}</strong>
              <p>{selectedTutorPersona.style}</p>
              <small>Correction style: {selectedTutorPersona.correctionStyle}</small>
            </div>
          </section>
          <div className="chat-stream" aria-live="polite">
            {chatMessages.map((message) => (
              <article className={`message ${message.speaker}`} key={message.id}>
                <p>
                  <ReadableStatusText text={message.text} />
                </p>
                {message.subtext && (
                  <small className="message-subtext">
                    <ReadableStatusText text={message.subtext} />
                  </small>
                )}
                {message.correction && (
                  <section
                    aria-label={`Highlighted correction: ${message.correction.english}`}
                    className="correction-highlight"
                  >
                    <span>Correct phrase</span>
                    <EnglishFirstKannadaText phrase={message.correction} showContext />
                  </section>
                )}
              </article>
            ))}
          </div>
          {voiceStatus && (
            <p className="voice-status" role="status">
              <ReadableStatusText text={voiceStatus} />
            </p>
          )}
          <div className="suggestion-row" role="group" aria-label="Quick replies">
            {getChatQuickReplies(selectedScenario).map((phrase) => (
              <button key={phrase.id} onClick={() => setChatInput(phrase.kannada)} type="button">
                <EnglishFirstKannadaText phrase={phrase} />
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
            <button
              aria-keyshortcuts={microphoneShortcuts}
              aria-label={recordingTarget === 'chat' ? 'Stop recording' : 'Record voice'}
              aria-pressed={recordingTarget === 'chat'}
              className={recordingTarget === 'chat' ? 'voice-action recording' : 'voice-action'}
              onClick={recordVoiceInput}
              title={recordingTarget === 'chat' ? 'Stop recording' : 'Record voice'}
              type="button"
            >
              {recordingTarget === 'chat' ? '■' : '🎤'}
            </button>
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
      const weakSkillPracticeIds = getWeakSkillPracticeVocabularyIds(weakSkillSummaries, allCurriculumUnits)
      const adaptiveDifficulty = getAdaptiveDifficulty(progress, now)
      const dueReviewPhrases = dueReviewIds
        .map((vocabularyId) => getPhraseByVocabularyId(vocabularyId))
        .filter((phrase): phrase is Phrase => Boolean(phrase))
      const card = dueReviewPhrases[0] ?? survivalPhrases.find((phrase) => phrase.id === 'hogbeku')!
      const cardReview = progress.reviewQueue[card.id]
      const reviewComplete = reviewSessionIds.length > 0 && reviewIndex >= reviewSessionIds.length
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
              ) : activeReviewExercise ? (
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
                    {reviewSessionIds.map((reviewId, index) => {
                      const segmentState = index < reviewIndex
                        ? 'completed'
                        : index === reviewIndex
                          ? reviewFeedback === 'correct'
                            ? 'completed'
                            : reviewFeedback === 'wrong'
                              ? 'wrong'
                              : 'current'
                          : 'pending'
                      return (
                        <span
                          aria-label={`Review ${index + 1} of ${reviewSessionIds.length}: ${segmentState}`}
                          className={`lesson-progress-segment ${segmentState}`}
                          key={`${reviewId}-${index}`}
                        />
                      )
                    })}
                  </div>
                  <div className="phrase-card review-card">
                    <small>{activeReviewExercise.prompt}</small>
                    {activeReviewExercise.kind === 'translate' ? (
                      <KannadaStrong
                        ariaLabel={formatReadablePhrase({
                          kannada: activeReviewExercise.phrase.kannada,
                          transliteration: activeReviewExercise.phrase.transliteration,
                          english: activeReviewExercise.phrase.english,
                          context: activeReviewExercise.phrase.context,
                        })}
                        text={activeReviewExercise.phrase.kannada}
                        subtitle={{ english: activeReviewExercise.phrase.english, romanization: activeReviewExercise.phrase.transliteration }}
                      />
                    ) : activeReviewExercise.kind === 'fillBlank' ? (
                      <strong>
                        <ReadableStatusText text={activeReviewExercise.displayText} />
                      </strong>
                    ) : (
                      <strong className="review-english-prompt">{activeReviewExercise.displayText}</strong>
                    )}
                    <span className="kannada-subtitles">
                      <small className="english-subtitle">{formatEnglishSubtitle(activeReviewExercise.phrase.english)}</small>
                      <small className="romanization">{formatRomanizationSubtitle(activeReviewExercise.phrase.transliteration)}</small>
                      <small>{activeReviewExercise.phrase.context}</small>
                    </span>
                  </div>
                  {activeReviewExercise.kind === 'typeKannada' ? (
                    <>
                      <label className="transcript-field typing-helper">
                        <span>Review Kannada typing answer</span>
                        <input
                          aria-label="Review Kannada typing answer"
                          disabled={reviewFeedback !== null}
                          onChange={(event) => {
                            setReviewTypedAnswer(event.target.value)
                            setReviewSelectedAnswer(transliterateLatinToKannada(event.target.value))
                          }}
                          placeholder={`Type ${activeReviewExercise.phrase.transliteration}`}
                          value={reviewTypedAnswer}
                        />
                      </label>
                      <article className="typing-preview-card review-typing-preview" role="region" aria-label="Review Kannada live preview">
                        <span>{reviewTypedAnswer || 'Type Latin letters'}</span>
                        <strong>
                          {activeReviewTypingPreview ? (
                            <ReadableStatusText text={activeReviewTypingPreview} />
                          ) : (
                            'Live preview appears here'
                          )}
                        </strong>
                        <small>Live preview</small>
                      </article>
                    </>
                  ) : (
                    <div className="option-stack review-session-options" aria-label="Review answers">
                      {activeReviewExercise.options.map((option) => (
                        <button
                          className={reviewSelectedAnswer === option ? 'answer-option selected' : 'answer-option'}
                          disabled={reviewFeedback !== null}
                          key={option}
                          onClick={() => {
                            playAppSound('tap')
                            setReviewSelectedAnswer(option)
                          }}
                          type="button"
                        >
                          <ChoiceText text={option} />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    aria-keyshortcuts={checkAnswerShortcuts}
                    className="primary-action"
                    disabled={!reviewSelectedAnswer || reviewFeedback !== null}
                    onClick={() => checkReviewAnswer(activeReviewExercise)}
                    type="button"
                  >
                    Check Review
                  </button>
                  {reviewFeedback && (
                    <div className={reviewFeedback === 'correct' ? 'feedback correct' : 'feedback wrong'} role="status">
                      <strong>{reviewFeedback === 'correct' ? 'Correct' : 'Try again'}</strong>
                      <span>
                        {reviewFeedback === 'correct'
                          ? '+1 XP'
                          : (
                              <ReadableStatusText
                                text={`${getReviewFeedbackAnswerSummary(activeReviewExercise)}. No hearts lost. This word will return soon.`}
                              />
                            )}
                      </span>
                    </div>
                  )}
                  {reviewFeedback && (
                    <button aria-keyshortcuts={checkAnswerShortcuts} className="secondary-action" onClick={goToNextReview} type="button">
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
              <button
                aria-label={`${formatReadableKannadaChoice(card.kannada, {
                  romanization: card.transliteration,
                  english: card.english,
                })} ${flashcardBack ? 'Back of flashcard' : 'Tap to flip'}`}
                className={flashcardBack ? 'flashcard flipped' : 'flashcard'}
                onClick={() => {
                  playAppSound('flip')
                  setFlashcardBack((value) => !value)
                }}
                type="button"
              >
                <small className="english-subtitle flashcard-primary-english">{formatEnglishSubtitle(card.english)}</small>
                <KannadaText
                  text={card.kannada}
                  subtitle={{ english: card.english, romanization: card.transliteration }}
                />
                <small className="romanization">{formatRomanizationSubtitle(card.transliteration)}</small>
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
              {flashcardBack && (
                <>
                  <div className="review-rating-row" aria-label="Flashcard rating">
                    {[
                      ['hard', 'Hard', '❌'],
                      ['okay', 'Okay', '🤷'],
                      ['easy', 'Easy', '✅'],
                    ].map(([rating, label, icon]) => (
                      <button
                        aria-label={label}
                        className="secondary-action compact-action rating-action"
                        key={rating}
                        onClick={() => rateFlashcard(card.id, rating as ReviewRating)}
                        type="button"
                      >
                        <span aria-hidden="true">{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <small className="review-strength">
                    Strength {Math.round((cardReview?.strength ?? 0.2) * 100)}%
                  </small>
                </>
              )}
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
                <article className="accent-card purple" aria-label="Weak areas">
                  <strong>Weak Areas</strong>
                  {weakSkillSummaries.map((skill) => (
                    <p key={skill.skillTag}>
                      <strong>{skill.label} needs review</strong>
                      <span>{skill.mistakes} recent {skill.mistakes === 1 ? 'miss' : 'misses'} - {skill.priority} priority</span>
                    </p>
                  ))}
                  <button
                    className="secondary-action compact-action"
                    disabled={!weakSkillPracticeIds.length}
                    onClick={() => startReviewSession(weakSkillPracticeIds)}
                    type="button"
                  >
                    Practice Weak Skills
                  </button>
                </article>
              ) : (
                <article className="accent-card purple">
                  <strong>Pronunciation Practice</strong>
                  <p>5 phrases with waveform scoring</p>
                </article>
              )}
              <article className="accent-card teal" aria-label="Pronunciation Lab shortcut">
                <strong>Pronunciation Lab</strong>
                <p>Open microphone scoring, reference audio, and attempt history.</p>
                <button className="secondary-action compact-action" onClick={openPronunciationLab} type="button">
                  Open Pronunciation Lab →
                </button>
              </article>
              <article className="accent-card saffron" aria-label="AI practice exercise">
                <strong>AI Exercises</strong>
                <p>Targets your weakest skill with Ollama or local fallback.</p>
                <button className="secondary-action compact-action" onClick={generateAiExercise} type="button">
                  Generate Practice Exercise
                </button>
                {generatedExercise && (
                  <p role="status">
                    <ReadableStatusText text={generatedExercise} />
                  </p>
                )}
                {latestGeneratedExercise && (
                  <GeneratedExerciseSummary exercise={latestGeneratedExercise} source={latestGeneratedExerciseSource} />
                )}
                {aiExpansionDeck.length > 0 && (
                  <small>
                    {aiExpansionDeck.length} saved {aiExpansionDeck.length === 1 ? 'drill' : 'drills'} for curriculum review
                  </small>
                )}
              </article>
            </div>
          </div>
          <section className="pronunciation-lab" aria-labelledby="pronunciation-lab-title">
            <header className="runtime-header">
              <div>
                <p className="eyebrow">speech practice</p>
                <h2 id="pronunciation-lab-title" tabIndex={-1}>Pronunciation Lab</h2>
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
                  <EnglishFirstKannadaText phrase={phrase} />
                </button>
              ))}
            </div>
            <article className="pronunciation-target">
              <div>
                <span className="model-category">target phrase</span>
                <EnglishFirstKannadaText phrase={activePronunciationPhrase} />
              </div>
              <div className="waveform compact" aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => (
                  <span key={index} style={{ height: `${18 + ((index * 11) % 42)}px` }} />
                ))}
              </div>
            </article>
            <div className="pronunciation-controls">
              <button
                aria-keyshortcuts={replayAudioShortcuts}
                className="secondary-action"
                onClick={() => void playPronunciationReference()}
                type="button"
              >
                Play Reference
              </button>
              <button className="secondary-action" onClick={() => void playPronunciationReference(0.7)} type="button">
                Play Slow
              </button>
              <button
                aria-keyshortcuts={microphoneShortcuts}
                className="secondary-action"
                onClick={recordPronunciationAudio}
                type="button"
              >
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
              <button aria-keyshortcuts={checkAnswerShortcuts} className="primary-action" onClick={scorePronunciationPractice} type="button">
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
                <div className="pronunciation-score-line">
                  <strong>Score: {pronunciationResult.score} / 100</strong>
                  <span className={`pronunciation-level ${pronunciationResult.level}`}>
                    Level: {formatPronunciationLevel(pronunciationResult.level)}
                  </span>
                </div>
                <p className="pronunciation-result-row">
                  <span className="pronunciation-result-label">Transcript:</span>
                  <ReadableStatusText text={pronunciationTranscript || 'No transcript yet'} />
                </p>
                <p className="pronunciation-result-row">
                  <span className="pronunciation-result-label">Feedback:</span>
                  {pronunciationResult.feedback}
                </p>
                <p className="pronunciation-result-row">
                  <span className="pronunciation-result-label">Problem syllables:</span>
                  {pronunciationResult.problemParts.length ? pronunciationResult.problemParts.join(', ') : 'None'}
                </p>
                {pronunciationResult.problemParts.length > 0 && (
                  <SubtitleLines text={pronunciationResult.problemParts.join(' ')} />
                )}
                <small className="pronunciation-result-row">
                  <span className="pronunciation-result-label">Tip:</span>
                  {pronunciationResult.tip}
                </small>
                <button className="secondary-action compact-action" onClick={retryPronunciationPractice} type="button">
                  Try Again
                </button>
              </article>
            )}
            {latestPronunciationAttempt && (
              <section className="pronunciation-history" aria-label="Pronunciation history">
                <h3>History</h3>
                {pronunciationHistory.slice(0, 3).map((attempt, index) => (
                  <article key={attempt.id}>
                    <strong>{formatPronunciationHistoryLabel(index)}: {attempt.score} ({formatPronunciationLevel(attempt.level)})</strong>
                    <ReadableStatusText text={attempt.transcript} />
                    <small className="pronunciation-history-phrase">
                      <ReadableStatusText text={attempt.phrase} />
                      <span>{formatPronunciationAttemptDate(attempt.createdAt)}</span>
                    </small>
                  </article>
                ))}
              </section>
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
              <button className="secondary-action" onClick={returnToStoryList} type="button">
                Back to Stories
              </button>
            </header>
            {activeStorySentence && (
              <article className="story-sentence-card" key={activeStorySentence.id}>
                <span className="metric-pill">{activeStorySentenceIndex + 1}/{activeStorySentenceCount}</span>
                <strong className="story-sentence-english">{activeStorySentence.english}</strong>
                <KannadaText
                  className="story-sentence-kannada"
                  text={activeStorySentence.kannada}
                  subtitle={{ english: activeStorySentence.english, romanization: activeStorySentence.transliteration }}
                />
                <em>{formatRomanizationSubtitle(activeStorySentence.transliteration)}</em>
                <p className="story-word-instruction">Tap any word for meaning:</p>
                <div className="story-word-row">
                  {activeStorySentence.words.map((word) => (
                    <button
                      aria-label={formatReadableStoryWord(word)}
                      className="word-token"
                      key={word.vocabularyId}
                      onClick={() => {
                        setSelectedStoryWord(word)
                        setStoryVocabularyStatus('')
                      }}
                      type="button"
                    >
                      <strong className="word-token-english">{formatEnglishSubtitle(word.english)}</strong>
                      <KannadaText
                        text={word.text}
                        subtitle={{ english: word.english, romanization: word.transliteration }}
                      />
                      <small className="romanization">{formatRomanizationSubtitle(word.transliteration)}</small>
                    </button>
                  ))}
                </div>
                <button
                  aria-keyshortcuts={replayAudioShortcuts}
                  className="mini-button"
                  onClick={() => void playStorySentenceAudio(activeStorySentence)}
                  type="button"
                >
                  Play sentence audio
                </button>
              </article>
            )}
            {isStoryAudioStatus(audioStatus) && <p role="status"><ReadableStatusText text={audioStatus} /></p>}
            {selectedStoryWord && (
              <aside
                className="word-popover"
                role="dialog"
                aria-label={formatReadableStoryWord(selectedStoryWord)}
              >
                <div className="word-popover-header">
                  <span className="word-detail-title">Word Detail</span>
                  <button
                    aria-label="Close word details"
                    className="icon-button"
                    onClick={() => setSelectedStoryWord(null)}
                    type="button"
                  >
                    x
                  </button>
                  <strong>{formatEnglishSubtitle(selectedStoryWord.english)}</strong>
                  <span className="kannada-subtitles">
                    <KannadaText
                      text={selectedStoryWord.text}
                      subtitle={{ english: selectedStoryWord.english, romanization: selectedStoryWord.transliteration }}
                    />
                    <small className="romanization">{formatRomanizationSubtitle(selectedStoryWord.transliteration)}</small>
                  </span>
                </div>
                <p>{selectedStoryWord.english}</p>
                <small>{selectedStoryWord.note}</small>
                <button
                  className="secondary-action"
                  disabled={Boolean(progress.reviewQueue[selectedStoryWord.vocabularyId])}
                  onClick={addSelectedStoryWordToVocabulary}
                  type="button"
                >
                  {progress.reviewQueue[selectedStoryWord.vocabularyId] ? 'In Vocabulary' : 'Add to Vocabulary'}
                </button>
                {storyVocabularyStatus && (
                  <div className="voice-status" role="status">
                    <ReadableStatusText text={storyVocabularyStatus} />
                  </div>
                )}
              </aside>
            )}
            {isLastStorySentence ? (
              <button className="primary-action" onClick={openStoryQuiz} type="button">
                Take Quiz
              </button>
            ) : (
              <button className="primary-action" onClick={goToNextStorySentence} type="button">
                Next →
              </button>
            )}
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
              <span className="metric-pill">+{storyQuizXp} XP</span>
            </header>
            <article className="story-quiz-card">
              <h3>{activeStory.quiz.prompt}</h3>
              <div className="option-stack">
                {activeStory.quiz.options.map((option) => (
                  <button
                    className={selectedStoryAnswer === option ? 'answer-option selected' : 'answer-option'}
                    key={option}
                    onClick={() => {
                      playAppSound('tap')
                      setSelectedStoryAnswer(option)
                    }}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                aria-keyshortcuts={checkAnswerShortcuts}
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
                <strong>+{storyQuizXp} XP</strong>
                <span>Total: {progress.xp} XP</span>
              </article>
              <button className="primary-action" onClick={returnToStoryList} type="button">
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
                  <img src={story.imagePath} alt={getStoryImageAlt(story)} />
                  <div className="story-card-body">
                    <h3>{story.title}</h3>
                    <p>{story.subtitle}</p>
                    <div
                      aria-label={`${story.title}: ${formatStoryDifficultyLabel(story.difficulty)} - ${story.readTimeMinutes} min - ${story.newWordCount} words`}
                      className="story-meta"
                    >
                      <span className={`difficulty-badge ${story.difficulty.toLowerCase()}`}>
                        {formatStoryDifficultyLabel(story.difficulty)}
                      </span>
                      <span>{story.readTimeMinutes} min</span>
                      <span>{story.newWordCount} words</span>
                    </div>
                    {lockState.locked ? (
                      <>
                        <span className="locked-label">{lockState.reason}</span>
                        <button
                          className="secondary-action"
                          disabled={progress.gems < bonusStoryUnlockCost}
                          onClick={() => unlockStoryEarly(story.id)}
                          type="button"
                        >
                          {progress.gems >= bonusStoryUnlockCost
                            ? `Unlock ${story.title} early - ${bonusStoryUnlockCost} gems`
                            : `Need ${bonusStoryUnlockCost} gems to unlock early`}
                        </button>
                      </>
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
                <h2 id="blr-title">
                  <span role="img" aria-label={getScenarioIconLabel(scenario)}>{scenario.icon}</span> {scenario.title}
                </h2>
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
                            onChange={() => toggleScenarioChecklist(scenario, item)}
                            type="checkbox"
                          />
                          <span>{item}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {progress.completedExerciseIds.includes(getScenarioChecklistActivityId(scenario.id)) && (
                  <p className="scenario-complete-status" role="status">
                    Scenario checklist complete: +10 XP earned
                  </p>
                )}
              </article>
              <article className="scenario-detail-card">
                <h3>Useful Phrases</h3>
                <div className="scenario-phrase-list" aria-label={`${scenario.title} useful phrases`}>
                  {scenario.usefulPhrases.map((phrase) => (
                    <div className="scenario-phrase-row" key={phrase.id}>
                      <EnglishFirstKannadaText phrase={phrase} />
                      <div className="scenario-action-row">
                        <button
                          aria-keyshortcuts={phrase.id === scenario.usefulPhrases[0]?.id ? replayAudioShortcuts : undefined}
                          className="mini-button"
                          onClick={() => void playScenarioPhraseAudio(phrase)}
                          type="button"
                        >
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
                <p>Driver says</p>
                <EnglishFirstKannadaText phrase={scenario.openingLine} />
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
                      <EnglishFirstKannadaText phrase={option} />
                    </label>
                  ))}
                </fieldset>
                <button
                  aria-keyshortcuts={checkAnswerShortcuts}
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
              <h2 id="blr-title">Bangalore Mode</h2>
              <p>Practice real daily-life conversations.</p>
            </div>
            <span className="metric-pill">daily survival phrase</span>
          </header>
          <article className="blr-hero">
            <p className="eyebrow">Slang of the Day</p>
            <h3>
              <EnglishFirstKannadaText
                phrase={{
                  english: 'Please adjust a little',
                  kannada: 'ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ',
                  transliteration: 'swalpa adjust maadi',
                  context: 'Use it in crowds, shared autos, queues, and PG life.',
                }}
                showContext
              />
            </h3>
          </article>
          <div className="scenario-grid">
            {bangaloreScenarios.map((scenario) => {
              const checkedCount = (progress.scenarioChecklist[scenario.id] ?? []).length
              const hasScenarioProgress = checkedCount > 0
              return (
                <article className="scenario-card" key={scenario.id}>
                  <span role="img" aria-label={getScenarioIconLabel(scenario)}>{scenario.icon}</span>
                  <strong>{scenario.title}</strong>
                  <small aria-label={`${scenario.title} difficulty: ${scenario.difficulty}`}>
                    {formatScenarioDifficultyLabel(scenario.difficulty)}
                  </small>
                  <p>{scenario.situation}</p>
                  <small>Checklist: {checkedCount}/{scenario.checklist.length}</small>
                  <button
                    aria-label={`${hasScenarioProgress ? 'Continue' : 'Start'} ${scenario.title} scenario`}
                    className="secondary-action"
                    onClick={() => openBangaloreScenario(scenario.id)}
                    type="button"
                  >
                    {hasScenarioProgress ? 'Continue' : 'Start Scenario'}
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
              <h2 id="profile-title">Profile</h2>
              <p>Rahul - Level {learnerLevel} Learner</p>
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
                aria-label={`${achievement.name}: ${achievement.unlocked ? 'Unlocked' : 'Locked'} - ${achievement.progressLabel}`}
                className={achievement.unlocked ? 'achievement-card unlocked' : 'achievement-card'}
                key={achievement.code}
              >
                <div className="achievement-card-header">
                  <span className="achievement-trophy" aria-hidden="true">🏆</span>
                  <strong>{achievement.name}</strong>
                  <span className={achievement.unlocked ? 'achievement-state unlocked' : 'achievement-state'}>
                    {achievement.unlocked ? '✅ Unlocked' : '⬜ Locked'}
                  </span>
                </div>
                <small>{achievement.description}</small>
                <p>{achievement.progressLabel}</p>
              </article>
            ))}
          </div>
          <section className="profile-settings" aria-labelledby="profile-settings-title">
            <header className="profile-settings-header">
              <div>
                <p className="eyebrow">settings</p>
                <h3 id="profile-settings-title">Settings</h3>
              </div>
            </header>
            <section className="reminder-card" aria-labelledby="daily-reminder-title">
              <div>
                <span className="model-category">notifications</span>
                <h3 id="daily-reminder-title">Daily Reminders</h3>
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
              <div className="reminder-actions reminder-time-action">
                <SettingsSwitch
                  checked={reminder.enabled}
                  label="Daily Reminders"
                  onClick={toggleDailyReminder}
                />
                <label className="settings-select-field">
                  <span>Reminder Time</span>
                  <select
                    aria-label="Reminder Time"
                    onChange={(event) => setReminderTime(event.target.value)}
                    value={reminder.time}
                  >
                    {reminderTimeOptions.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </label>
                <button className="secondary-action" onClick={() => void allowReminderAlerts()} type="button">
                  Allow Reminder Alerts
                </button>
              </div>
              {reminderStatus && (
                <p className="voice-status" role="status">
                  {reminderStatus}
                </p>
              )}
            </section>
            <section className="reminder-card" aria-labelledby="daily-goal-title">
              <div>
                <span className="model-category">daily goal</span>
                <h3 id="daily-goal-title">Daily XP Goal</h3>
                <p>{formatDailyGoalLabel(learnerProfile.dailyGoalXp)}</p>
                <small>Dashboard quests and the XP ring use this target.</small>
              </div>
              <div className="reminder-actions goal-action">
                <label className="settings-select-field">
                  <span>Daily XP Goal</span>
                  <select
                    aria-label="Daily XP Goal"
                    onChange={(event) => setDailyGoal(Number(event.target.value))}
                    value={learnerProfile.dailyGoalXp}
                  >
                    {dailyGoalOptions.map((goal) => {
                      const details = getDailyGoalDetails(goal)
                      return (
                        <option key={goal} value={goal}>
                          {details.name} - {details.minutesPerDay} min/day - {goal} XP
                        </option>
                      )
                    })}
                  </select>
                </label>
              </div>
            </section>
            <section className="reminder-card" aria-labelledby="sound-effects-title">
              <div>
                <span className="model-category">sound</span>
                <h3 id="sound-effects-title">Sound Effects</h3>
                <p>{soundPreferences.soundEffects ? 'Sound Effects On' : 'Sound Effects Off'}</p>
                <small>Correct, wrong, gem, streak, tap, flip, and completion sounds.</small>
              </div>
              <div className="reminder-actions single-action">
                <SettingsSwitch
                  checked={soundPreferences.soundEffects}
                  label="Sound Effects"
                  onClick={() => toggleSoundPreference('soundEffects')}
                />
              </div>
            </section>
            <section className="reminder-card" aria-labelledby="auto-play-audio-title">
              <div>
                <span className="model-category">audio</span>
                <h3 id="auto-play-audio-title">Auto-play Audio</h3>
                <p>{soundPreferences.autoPlayAudio ? 'Auto-play Audio On' : 'Auto-play Audio Off'}</p>
                <small>Automatically plays Kannada exercise audio when a lesson item opens.</small>
              </div>
              <div className="reminder-actions single-action">
                <SettingsSwitch
                  checked={soundPreferences.autoPlayAudio}
                  label="Auto-play Audio"
                  onClick={() => toggleSoundPreference('autoPlayAudio')}
                />
              </div>
            </section>
            <section className="reminder-card" aria-labelledby="learner-store-title">
              <div>
                <span className="model-category">storage</span>
                <h3 id="learner-store-title">Desktop Storage</h3>
                <p>{formatDesktopStorageState(learnerStoreStatus, Boolean(window.kannadaOS?.saveLearnerData))}</p>
                <small>
                  {formatLearnerStoreStatus(learnerStoreStatus)} - {window.kannadaOS?.saveLearnerData ? 'Electron repository' : 'Browser storage fallback'}
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
          </section>
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
    const nextUnit =
      coreCurriculumUnits.find((unit) => unit.lessons.some((lesson) => lesson.id === nextLesson.id)) ??
      coreCurriculumUnits[0]
    const nextUnitIndex = coreCurriculumUnits.findIndex((unit) => unit.id === nextUnit.id)
    const nextLessonIndex = nextUnit.lessons.findIndex((lesson) => lesson.id === nextLesson.id)
    const nextLessonProgress = getLessonProgressSummary(progress, nextLesson.id)
    const nextLessonMastery = formatCrownRating(nextLessonProgress.masteryLevel)
    const nextUnitNumber = nextUnitIndex >= 0 ? nextUnitIndex + 1 : 1
    const nextLessonNumber = nextLessonIndex >= 0 ? nextLessonIndex + 1 : 1
    const dailyGoalXp = learnerProfile.dailyGoalXp
    const dailyQuests = getDailyQuests(progress, new Date().toISOString(), dailyGoalXp)
    const cappedDailyXp = Math.min(dailyGoalXp, progress.dailyXp)
    const dailyProgressPercent = Math.min(100, Math.round((cappedDailyXp / Math.max(1, dailyGoalXp)) * 100))
    const dailyProgressStyle = { '--daily-progress-percent': `${dailyProgressPercent}%` } as CSSProperties
    const heartCounterClass = progress.hearts <= 0 ? 'resource-counter heart-counter empty' : 'resource-counter heart-counter'
    const nextHeartRecoveryText = progress.hearts < maxHearts
      ? formatNextHeartRecovery(progress.lastHeartLostAt)
      : null

    return (
      <section className="panel home-panel" aria-labelledby="home-title">
        <header className="section-header">
          <div>
            <p className="eyebrow">Today in Bangalore Kannada</p>
            <h2 id="home-title">KannadaOS</h2>
          </div>
          <div className="top-counters" aria-label="resources">
            <span>{formatStreakCounter(progress.streakDays)}</span>
            <span
              aria-label={progress.hearts <= 0 ? 'Hearts: 0, empty' : `Hearts: ${progress.hearts}`}
              className={heartCounterClass}
            >
              ❤️ {progress.hearts}
            </span>
            <span
              aria-label="Gems"
              className={claimedQuestId ? 'resource-counter gem-counter rolling' : 'resource-counter gem-counter'}
              key={`gems-${gemPulseKey}`}
            >
              💎 {progress.gems}
            </span>
          </div>
        </header>
        <section className="daily-progress-card" aria-label="Daily Progress">
          <div className="daily-progress-copy">
            <p className="eyebrow">Daily Progress</p>
            <strong>{formatStreakCounter(progress.streakDays)}</strong>
            <p>Keep it up. {Math.max(0, dailyGoalXp - progress.dailyXp)} XP to hit today&apos;s goal.</p>
            <div
              aria-label={`Daily progress track: ${cappedDailyXp} of ${dailyGoalXp} XP`}
              aria-valuemax={dailyGoalXp}
              aria-valuemin={0}
              aria-valuenow={cappedDailyXp}
              className="daily-progress-track"
              role="progressbar"
            >
              <span style={{ width: `${dailyProgressPercent}%` }} />
            </div>
          </div>
          <div
            aria-label={`XP ring: ${cappedDailyXp} of ${dailyGoalXp} XP, ${dailyProgressPercent}% complete`}
            aria-valuemax={dailyGoalXp}
            aria-valuemin={0}
            aria-valuenow={cappedDailyXp}
            className="daily-progress-ring"
            role="progressbar"
            style={dailyProgressStyle}
          >
            <span>{cappedDailyXp}/{dailyGoalXp}</span>
            <small>XP</small>
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
              {nextHeartRecoveryText && <li>{nextHeartRecoveryText}</li>}
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
          <small>{nextLesson.objective}</small>
          <small>
            Lesson {nextLessonNumber} of {nextUnit.lessons.length} - Unit {nextUnitNumber} - {nextLessonMastery} mastery
          </small>
          <i
            aria-label={`${nextLesson.title} mastery: ${nextLessonProgress.masteryLevel} of 5 crowns`}
            aria-valuemax={5}
            aria-valuemin={0}
            aria-valuenow={nextLessonProgress.masteryLevel}
            role="progressbar"
          >
            <b style={{ width: `${Math.max(12, nextLessonProgress.masteryLevel * 20)}%` }} />
          </i>
        </button>
        <section className="tips-card" aria-labelledby="unit-tips-title">
          <p className="eyebrow">unit tips</p>
          <h3 id="unit-tips-title">{nextUnit.title}</h3>
          {nextUnit.tips.map((tip) => (
            <article key={tip.title}>
              <strong><ReadableStatusText text={tip.title} /></strong>
              <p><ReadableStatusText text={tip.body} /></p>
              <ReadableExampleList examples={tip.examples} />
            </article>
          ))}
        </section>
        <section className="daily-quest-grid" aria-label="Daily quests">
          {dailyQuests.map((quest) => {
            const progressPercent = Math.min(100, Math.round((quest.current / Math.max(1, quest.target)) * 100))
            const questCardClass = [
              'quest-card',
              quest.completed ? 'complete' : '',
              quest.claimed ? 'claimed' : '',
              claimedQuestId === quest.id ? 'claiming' : '',
            ].filter(Boolean).join(' ')
            const questStatus = quest.claimed ? '🎉' : quest.completed ? '✅' : '⬜'
            const claimLabel = quest.claimed ? 'Claimed ✅' : quest.completed ? `Claim ${quest.rewardGems} 💎` : 'In progress'

            return (
              <article className={questCardClass} key={quest.id}>
                <div className="quest-header">
                  <span className="quest-state" aria-hidden="true">{questStatus}</span>
                  <strong>{quest.title}</strong>
                </div>
                <p>{quest.description}</p>
                <div
                  aria-label={`${quest.title} progress`}
                  aria-valuemax={quest.target}
                  aria-valuemin={0}
                  aria-valuenow={quest.current}
                  className="quest-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
                <span>{quest.current}/{quest.target} - +{quest.rewardGems} gems</span>
                <button
                  className={quest.completed && !quest.claimed ? 'secondary-action quest-claim-action' : 'secondary-action'}
                  disabled={!quest.completed || quest.claimed}
                  onClick={() => claimQuestReward(quest)}
                  type="button"
                >
                  {claimLabel}
                </button>
                {claimedQuestId === quest.id && (
                  <div className="confetti-burst quest-confetti" aria-label={`Quest claim celebration: ${quest.title}`}>
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </article>
            )
          })}
        </section>
        <section className="quick-actions-card" aria-label="Quick actions">
          <div>
            <p className="eyebrow">quick actions</p>
            <h3>Jump back in</h3>
          </div>
          <div className="quick-action-grid">
            <button
              aria-label="Open review drills"
              className="secondary-action"
              onClick={() => setTab('practice')}
              type="button"
            >
              Practice
            </button>
            <button
              aria-label="Open reader mode"
              className="secondary-action"
              onClick={() => setTab('stories')}
              type="button"
            >
              Stories
            </button>
            <button
              aria-label="Open tutor messages"
              className="secondary-action"
              onClick={() => setTab('chat')}
              type="button"
            >
              Chat
            </button>
          </div>
        </section>
      </section>
    )
  }

  function renderExerciseContent(exercise: LessonExercise) {
    if (isReverseTranslateExercise(exercise)) {
      return (
        <>
          <div className="phrase-card reverse-translate-card">
            <small>Choose the Kannada phrase for:</small>
            <strong className="review-english-prompt">{exercise.english ?? exercise.answer}</strong>
          </div>
          {renderOptions(exercise)}
          {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
        </>
      )
    }

    if (exercise.type === 'arrange') {
      return (
        <>
          <div className="phrase-card">
            <small>{exercise.english}</small>
            {placedWords.length ? (
              <>
                <div className="placed-word-row" role="region" aria-label="Placed words">
                  {placedWords.map((word, index) => (
                    <button
                      aria-label={`Remove ${getReadableKannadaAriaLabel(word, exercise)} from answer`}
                      className="placed-word-chip"
                      key={`${word}-${index}`}
                      onClick={() => removeArrangeWord(index)}
                      type="button"
                    >
                      <ChoiceText text={word} context={exercise} />
                    </button>
                  ))}
                </div>
                <SubtitleLines text={placedWords.join(' ')} context={exercise} />
              </>
            ) : (
              <>
                <strong>Tap words below</strong>
                <SubtitleLines text={exercise.answer} context={exercise} />
              </>
            )}
          </div>
          <EnglishWordGuide words={exercise.options} context={exercise} />
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
              aria-keyshortcuts={lessonReplayAudioShortcuts}
              className="speaker-button"
              onClick={() => void playExerciseReference(exercise)}
              type="button"
            >
              Play Again
            </button>
            <button
              className="mini-button"
              onClick={() => void playExerciseReference(exercise, 0.7)}
              type="button"
            >
              Slow
            </button>
            {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
          </div>
          <div className="option-stack" aria-label="Listening choices">
            {exercise.options.map((option) => (
              <button
                className={selectedAnswer === option ? 'answer-option selected' : 'answer-option'}
                key={option}
                onClick={() => {
                  playAppSound('tap')
                  setSelectedAnswer(option)
                }}
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
            <KannadaStrong text={exercise.kannada} context={exercise} />
            <SubtitleLines text={exercise.kannada} context={exercise} />
          </div>
          <div className="speaking-card">
            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} style={{ height: `${20 + ((index * 13) % 48)}px` }} />
              ))}
            </div>
            <button
              aria-keyshortcuts={lessonReplayAudioShortcuts}
              className="mini-button"
              onClick={() => void playExerciseReference(exercise)}
              type="button"
            >
              Listen first
            </button>
            <button
              className="mini-button"
              onClick={() => void playExerciseReference(exercise, 0.7)}
              type="button"
            >
              Play slow audio
            </button>
            <button
              aria-keyshortcuts={microphoneShortcuts}
              className={recordingTarget === 'lesson' ? 'speaker-button recording' : 'speaker-button'}
              onClick={() => recordPhrase(exercise)}
              type="button"
            >
              {recordingTarget === 'lesson' ? 'Stop Recording' : 'Record phrase'}
            </button>
            {speakingResult && (
              <>
                <div className="score-card" role="status" aria-label="Speaking score result">
                  <strong>Score: {speakingResult.score} / 100</strong>
                  <span>Level: {formatPronunciationLevel(speakingResult.level)}</span>
                  <span>
                    Problem: {speakingResult.problemParts.length ? speakingResult.problemParts.join(', ') : 'None'}
                  </span>
                  {speakingResult.problemParts.length > 0 && (
                    <SubtitleLines text={speakingResult.problemParts.join(' ')} context={exercise} />
                  )}
                  <span>Tip: {speakingResult.tip}</span>
                  <span className={speakingResult.score >= 70 ? 'score-ready' : 'score-warning'}>
                    {speakingResult.score >= 70 ? 'Ready to continue' : 'Minimum 70 to continue'}
                  </span>
                </div>
                <div className="speaking-actions">
                  <button className="secondary-action" onClick={retrySpeakingExercise} type="button">
                    Try Again
                  </button>
                  <button
                    aria-keyshortcuts={checkAnswerShortcuts}
                    className="primary-action"
                    disabled={speakingResult.score < 70 || Boolean(feedback)}
                    onClick={() => continueSpeakingExercise(exercise)}
                    type="button"
                  >
                    Continue →
                  </button>
                </div>
              </>
            )}
            {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
          </div>
        </>
      )
    }

    if (exercise.type === 'typeKannada') {
      const scriptTransliterationExercise = isScriptTransliterationExercise(exercise)
      const convertedAnswer = scriptTransliterationExercise
        ? `${exercise.kannada} = ${typedAnswer || exercise.answer}`
        : transliterateLatinToKannada(typedAnswer)
      const inputLabel = scriptTransliterationExercise ? 'Script transliteration answer' : 'Kannada typing answer'
      return (
        <>
          <div className={scriptTransliterationExercise ? 'phrase-card' : 'phrase-card typing-target-card'}>
            <small>{scriptTransliterationExercise ? exercise.english : 'Type the Kannada for:'}</small>
            {scriptTransliterationExercise ? (
              <>
                <KannadaStrong text={exercise.kannada} context={exercise} />
                <SubtitleLines text={exercise.kannada} context={exercise} />
              </>
            ) : (
              <strong className="review-english-prompt">{exercise.english ?? exercise.answer}</strong>
            )}
            <button aria-keyshortcuts={lessonReplayAudioShortcuts} className="mini-button" onClick={() => void playExerciseReference(exercise)} type="button">
              Listen
            </button>
          </div>
          <label className="transcript-field typing-helper">
            <span>{inputLabel}</span>
            <input
              aria-label={inputLabel}
              onChange={(event) => {
                setTypedAnswer(event.target.value)
                setSelectedAnswer(scriptTransliterationExercise ? event.target.value : transliterateLatinToKannada(event.target.value))
                if (feedback === 'almost') {
                  setFeedback(null)
                  setAlmostTypingDistance(null)
                }
              }}
              placeholder={scriptTransliterationExercise ? `Type ${exercise.answer}` : 'Type namaskara saar'}
              value={typedAnswer}
            />
          </label>
          {!scriptTransliterationExercise && (
            <article className="typing-preview-card" role="region" aria-label="Kannada live preview">
              <span>{typedAnswer || 'Type Latin letters'}</span>
              <strong>
                {convertedAnswer ? (
                  <ReadableStatusText text={convertedAnswer} context={exercise} />
                ) : (
                  'Live preview appears here'
                )}
              </strong>
              <small>Live preview</small>
            </article>
          )}
          <article className="keyboard-helper" aria-label={scriptTransliterationExercise ? 'Script sound helper' : 'Kannada keyboard helper'}>
            <strong>{scriptTransliterationExercise ? 'Script sound helper' : 'Keyboard helper'}</strong>
            <ReadableStatusText
              text={scriptTransliterationExercise ? convertedAnswer : 'Transliteration input converts Latin to Kannada script in real time.'}
              context={exercise}
            />
            <div className="suggestion-row compact">
              {exercise.options.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    playAppSound('tap')
                    setTypedAnswer(option)
                    setSelectedAnswer(scriptTransliterationExercise ? option : transliterateLatinToKannada(option))
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
            <small>Complete the conversation</small>
            <div className="dialogue-line">
              <span>Speaker says</span>
              <KannadaStrong text={exercise.kannada} context={exercise} />
              <SubtitleLines text={exercise.kannada} context={exercise} />
            </div>
            <button aria-keyshortcuts={lessonReplayAudioShortcuts} className="mini-button" onClick={() => void playExerciseReference(exercise)} type="button">
              Listen
            </button>
          </div>
          <div className="dialogue-reply-prompt">
            <strong>You reply</strong>
            <small>Pick the best response for this situation.</small>
          </div>
          {renderOptions(exercise)}
          {audioStatus && <p role="status"><ReadableStatusText text={audioStatus} context={exercise} /></p>}
        </>
      )
    }

    if (exercise.type === 'matchPairs') {
      const pairs = parseMatchPairs(exercise.answer)
      const matchedPairIds = new Set(matchedPairs)
      return (
        <div className="match-grid" aria-label="Match pairs">
          <div>
            {pairs.map((pair) => {
              const pairId = getMatchPairId(pair.left, pair.right)
              const matched = matchedPairIds.has(pairId)
              const mismatched = mismatchedPair?.left === pair.left

              return (
                <button
                  className={getMatchOptionClass(selectedMatch.left === pair.left, matched, mismatched)}
                  disabled={matched}
                  key={pair.left}
                  onClick={() => handleMatchSelection(pair.left, 'left', exercise)}
                  type="button"
                >
                  {matched && <span className="match-check" aria-hidden="true">✅</span>}
                  <ChoiceText text={pair.left} context={exercise} />
                </button>
              )
            })}
          </div>
          <div>
            {pairs.map((pair) => {
              const pairId = getMatchPairId(pair.left, pair.right)
              const matched = matchedPairIds.has(pairId)
              const mismatched = mismatchedPair?.right === pair.right

              return (
                <button
                  className={getMatchOptionClass(selectedMatch.right === pair.right, matched, mismatched)}
                  disabled={matched}
                  key={pair.right}
                  onClick={() => handleMatchSelection(pair.right, 'right', exercise)}
                  type="button"
                >
                  {matched && <span className="match-check" aria-hidden="true">✅</span>}
                  <ChoiceText text={pair.right} context={exercise} />
                </button>
              )
            })}
          </div>
          <p>{matchedPairs.length} of {pairs.length} matched</p>
        </div>
      )
    }

    return (
      <>
        <div className="phrase-card">
          <KannadaStrong text={exercise.kannada} context={exercise} />
          <SubtitleLines text={exercise.kannada} context={exercise} />
          {exercise.english && <small>{exercise.english}</small>}
          <button
            aria-keyshortcuts={lessonReplayAudioShortcuts}
            type="button"
            className="mini-button"
            onClick={() => void playExerciseReference(exercise)}
          >
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
            onClick={() => {
              playAppSound('tap')
              setSelectedAnswer(option)
            }}
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

function SettingsSwitch({
  checked,
  label,
  onClick,
}: {
  checked: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={`${label}: ${checked ? 'On' : 'Off'}`}
      className={checked ? 'settings-switch active' : 'settings-switch'}
      onClick={onClick}
      role="switch"
      type="button"
    >
      <span>Toggle: {checked ? 'ON' : 'OFF'}</span>
      <i aria-hidden="true" />
    </button>
  )
}

function getDailyGoalDetails(goal: number): DailyGoalDetails {
  const normalizedGoal = dailyGoalOptions.includes(goal as DailyGoalXp)
    ? goal as DailyGoalXp
    : defaultLearnerProfile.dailyGoalXp as DailyGoalXp

  return dailyGoalDetailsByXp[normalizedGoal]
}

function formatDailyGoalLabel(goal: number): string {
  const details = getDailyGoalDetails(goal)
  return `${details.name} - ${details.minutesPerDay} min / day - ${goal} XP`
}

function formatStreakCounter(streakDays: number): string {
  return streakDays > 0 ? `🔥 ${streakDays}-day streak` : '🔥 Start a streak!'
}

function getConfiguredHostedExerciseFallbackSettings(settings: AiProviderSettings): AiProviderSettings | null {
  const openRouterSettings: AiProviderSettings = { ...settings, activeProvider: 'openrouter' }
  if (isHostedProviderConfigured(openRouterSettings)) {
    return openRouterSettings
  }

  const nvidiaSettings: AiProviderSettings = { ...settings, activeProvider: 'nvidia' }
  if (isHostedProviderConfigured(nvidiaSettings)) {
    return nvidiaSettings
  }

  return null
}

function formatAdaptiveDifficultyForAiPrompt(level: AdaptiveDifficultyLevel): string {
  if (level === 'gentle') {
    return 'gentle beginner'
  }

  if (level === 'challenge') {
    return 'challenge beginner'
  }

  return 'steady beginner'
}

function getAiExerciseVocabularyList(targetSkillTag: string, units: CurriculumUnit[]): string[] {
  const matchingExercises = units
    .flatMap((unit) => unit.lessons)
    .flatMap((lesson) => lesson.exercises)
    .filter((exercise) => exercise.skillTag === targetSkillTag)

  const fallbackExercises = units
    .flatMap((unit) => unit.lessons)
    .flatMap((lesson) => lesson.exercises)

  const vocabularyIds = collectGeneratedPromptVocabularyIds(
    matchingExercises.length ? matchingExercises : fallbackExercises,
  )

  return vocabularyIds
    .map((vocabularyId) => getPhraseByVocabularyId(vocabularyId))
    .filter((phrase): phrase is Phrase => phrase !== null)
    .slice(0, 12)
    .map((phrase) => `${phrase.id}: ${phrase.kannada} (${phrase.transliteration}) = ${phrase.english}`)
}

function collectGeneratedPromptVocabularyIds(exercises: LessonExercise[]): string[] {
  const vocabularyIds = new Set<string>()

  for (const exercise of exercises) {
    for (const vocabularyId of exercise.vocabularyIds) {
      vocabularyIds.add(vocabularyId)
    }
  }

  return Array.from(vocabularyIds)
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

function formatCrownRating(masteryLevel: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(masteryLevel)))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function getUnitCompletionSummary(unit: CurriculumUnit, progress: ProgressState) {
  const totalLessons = unit.lessons.length
  const completedLessons = unit.lessons.filter((lesson) => getLessonProgressSummary(progress, lesson.id).completed).length
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return {
    completedLessons,
    totalLessons,
    percent,
  }
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
    text: scenario.openingLine.english,
    subtext: formatEnglishFirstPhraseLine(scenario.openingLine),
  }
}

function buildTutorReply(input: string, scenario: Scenario, persona: TutorPersona): Pick<ChatMessage, 'text' | 'subtext' | 'correction'> {
  const normalized = input.toLowerCase()

  if (scenario.id === 'auto-ride' && normalized.includes('majestic') && normalized.includes('hogbeku')) {
    const phrase = getRequiredPhrase('majestic-ge-hogbeku')
    return {
      text: `${persona.name}: Add -ge for "to" before the destination.`,
      subtext: formatTutorPhraseSupport(persona, phrase, 'Use this exact auto phrase.'),
      correction: toConversationCorrection(phrase),
    }
  }

  if (scenario.id === 'bmtc-bus') {
    const phrase = getRequiredPhrase('ticket-eshtu')
    return {
      text: `${persona.name}: Good fare question for BMTC.`,
      subtext: formatTutorPhraseSupport(persona, phrase, 'Put the destination first, then ask the fare.'),
    }
  }

  if (normalized.includes('beda') || input.includes('ಬೇಡ')) {
    const phrase = getRequiredPhrase('beda')
    return {
      text: `${persona.name}: Good. ಬೇಡ is a clear way to say you do not want it.`,
      subtext: formatTutorPhraseSupport(persona, phrase, persona.correctionStyle),
    }
  }

  const phrase = scenario.usefulPhrases[0]
  return {
    text: `${persona.name}: Try it in the ${scenario.title} roleplay.`,
    subtext: formatTutorPhraseSupport(persona, phrase, 'Suggested next phrase.'),
  }
}

function getChatQuickReplies(scenario: Scenario): Phrase[] {
  const scenarioPhraseIds: Record<string, string[]> = {
    'bmtc-bus': ['ticket-eshtu', 'nidhanavagi-heli', 'majestic-ge-hogbeku', 'dhanyavada'],
    'auto-ride': ['majestic-ge-hogbeku', 'illi-nillisi', 'eshtu', 'swalpa-adjust-maadi'],
    darshini: ['beku', 'dhanyavada', 'eshtu', 'beda'],
    kirana: ['eshtu', 'beda', 'beku', 'dhanyavada'],
    office: ['oota-aayta', 'chennagiddene', 'namaskara-saar', 'dhanyavada'],
    'pg-owner': ['barutte', 'matte-heli', 'nidhanavagi-heli', 'dhanyavada'],
  }
  const phraseIds = scenarioPhraseIds[scenario.id] ?? scenario.usefulPhrases.map((phrase) => phrase.id)
  const replies = [...scenario.usefulPhrases]

  for (const phraseId of phraseIds) {
    const phrase = survivalPhrases.find((item) => item.id === phraseId)
    if (phrase && !replies.some((reply) => reply.id === phrase.id)) {
      replies.push(phrase)
    }
  }

  return replies.slice(0, 4)
}

function formatTutorPhraseSupport(persona: TutorPersona, phrase: Phrase, note: string): string {
  return `${persona.name}: ${note} ${formatEnglishFirstPhraseLine(phrase)}`
}

function toConversationCorrection(phrase: Phrase): PersistedConversationCorrection {
  return {
    id: phrase.id,
    kannada: phrase.kannada,
    transliteration: phrase.transliteration,
    english: phrase.english,
    context: phrase.context,
  }
}

function getRequiredPhrase(phraseId: string): Phrase {
  return survivalPhrases.find((phrase) => phrase.id === phraseId) ?? survivalPhrases[0]
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
        (attempt.level === 'clear' || attempt.level === 'steady' || attempt.level === 'needs-practice' || attempt.level === 'try-again'),
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

function hydrateStringList(serialized: string | null): string[] {
  if (!serialized) {
    return []
  }

  try {
    const parsed = JSON.parse(serialized) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
  } catch {
    return []
  }
}

function isGeneratedExercise(exercise: Partial<GeneratedExercise>): exercise is GeneratedExercise {
  return (
    typeof exercise.type === 'string' &&
    typeof exercise.prompt === 'string' &&
    typeof exercise.kannada === 'string' &&
    (exercise.transliteration === undefined || typeof exercise.transliteration === 'string') &&
    (exercise.english === undefined || typeof exercise.english === 'string') &&
    typeof exercise.answer === 'string' &&
    Array.isArray(exercise.options) &&
    exercise.options.every((option) => typeof option === 'string') &&
    (exercise.explanation === undefined || typeof exercise.explanation === 'string') &&
    (exercise.skillTag === undefined || typeof exercise.skillTag === 'string') &&
    (exercise.xp === undefined || typeof exercise.xp === 'number') &&
    (exercise.vocabularyIds === undefined ||
      (Array.isArray(exercise.vocabularyIds) && exercise.vocabularyIds.every((vocabularyId) => typeof vocabularyId === 'string')))
  )
}

function getPronunciationParts(kannada: string): string[] {
  return kannada
    .replace(/[?]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function formatVoiceTranscriptStatus(transcript: string) {
  const companion = getTranscriptCompanion(transcript)

  if (companion !== 'Kannada transcript') {
    return `Voice transcript ready: ${companion}`
  }

  return `Voice transcript ready: ${transcript} (${companion})`
}

function getTranscriptCompanion(transcript: string) {
  const normalizedTranscript = transcript.trim().normalize('NFC')
  const phrase = survivalPhrases.find((item) => item.kannada.normalize('NFC') === normalizedTranscript)

  if (phrase) {
    return formatEnglishFirstPhraseLine(phrase)
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

function getMatchPairId(left: string, right: string): string {
  return `${left}=${right}`
}

function getMatchOptionClass(selected: boolean, matched: boolean, mismatched: boolean): string {
  return [
    'answer-option',
    selected ? 'selected' : '',
    matched ? 'matched' : '',
    mismatched ? 'mismatch' : '',
  ].filter(Boolean).join(' ')
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
  const phrase = getPhraseByVocabularyId(vocabularyId)

  if (phrase) {
    return formatEnglishFirstPhraseLine(phrase)
  }

  const fallbackLabel = vocabularyId.split(':').at(-1) ?? vocabularyId
  const subtitle = getKannadaSubtitle(fallbackLabel)

  if (subtitle) {
    return formatEnglishFirstSubtitleLine(fallbackLabel, subtitle)
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

function formatScenarioDifficultyLabel(difficulty: Scenario['difficulty']): string {
  const starCount = difficulty === 'Intermediate' ? 2 : 1
  return `${'⭐'.repeat(starCount)} ${difficulty}`
}

function formatStoryDifficultyLabel(difficulty: Story['difficulty']): string {
  const starCount = difficulty === 'Advanced' ? 3 : difficulty === 'Intermediate' ? 2 : 1
  return `${'⭐'.repeat(starCount)} ${difficulty}`
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

function formatDesktopStorageState(status: LearnerStoreStatus, hasDesktopStore: boolean) {
  if (!hasDesktopStore) {
    return 'Browser fallback'
  }

  if (status === 'synced') {
    return 'Synced ✅'
  }

  if (status === 'error') {
    return 'Needs attention'
  }

  return status === 'saving' ? 'Saving...' : 'Syncing...'
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

function formatPronunciationHistoryLabel(index: number): string {
  if (index === 0) {
    return 'Latest'
  }

  if (index === 1) {
    return 'Previous'
  }

  return 'First'
}

function formatPronunciationAttemptDate(createdAt: string): string {
  const date = new Date(createdAt)
  if (!Number.isFinite(date.getTime())) {
    return 'saved attempt'
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatPronunciationLevel(level: PronunciationScoreResult['level']) {
  return level.split('-').map(titleCase).join(' ')
}

function formatGeneratedExerciseSource(source: GeneratedExerciseSource) {
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

function formatGeneratedExerciseStatus(source: GeneratedExerciseSource, exercise: GeneratedExercise) {
  return `${formatGeneratedExerciseSource(source)}: ${exercise.prompt}`
}

export default App
