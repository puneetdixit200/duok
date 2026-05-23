import { useEffect, useMemo, useState } from 'react'
import {
  bangaloreScenarios,
  getLevelOneCurriculum,
  lessonExercises,
  stories,
  survivalPhrases,
  tutorPersonas,
} from './domain/curriculum'
import {
  applyExerciseResult,
  getAdaptiveDifficulty,
  getAchievementSummaries,
  getDueReviewItems,
  getWeakSkillSummaries,
  hydrateProgress,
  serializeProgress,
  type ProgressState,
} from './domain/progress'
import { checkOllamaStatus, generateExerciseWithOllama } from './services/ollama'
import {
  createMissingLocalRuntimeSummary,
  emptyLocalRuntimeConfig,
  inspectLocalRuntime,
  type LocalRuntimeConfig,
  type LocalRuntimeSummary,
} from './services/localRuntime'
import { scorePronunciation, type PronunciationScoreResult } from './services/pronunciation'
import { buildExportSnapshot, serializeExportSnapshot } from './services/exportSnapshot'
import {
  appendScenarioMessages,
  getScenarioMessages,
  hydrateConversationStore,
  serializeConversationStore,
  type ConversationStore,
} from './services/conversationLog'
import type { LessonExercise, Phrase, Scenario, StoryWord, TutorPersona } from './types'
import './styles.css'

type Tab = 'home' | 'chat' | 'practice' | 'stories' | 'blr' | 'me'
type Screen = 'onboarding' | 'app' | 'lesson' | 'models'
type StoryMode = 'list' | 'reader' | 'quiz' | 'complete'

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

const progressKey = 'kannadaos:progress'
const onboardedKey = 'kannadaos:onboarded'
const reminderKey = 'kannadaos:reminder'
const runtimeKey = 'kannadaos:local-runtime'
const pronunciationKey = 'kannadaos:pronunciation-history'
const conversationKey = 'kannadaos:conversation-log'
const defaultChatScenario = bangaloreScenarios.find((scenario) => scenario.id === 'auto-ride') ?? bangaloreScenarios[0]
const defaultTutorPersona = tutorPersonas[0]
const pronunciationPhrases = survivalPhrases.filter((phrase) =>
  ['namaskara-saar', 'ticket-eshtu', 'swalpa-adjust-maadi'].includes(phrase.id),
)
const defaultReminderPreference: ReminderPreference = {
  enabled: false,
  time: '7:30 PM',
  permission: 'default',
}

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

function App() {
  const curriculum = useMemo(() => getLevelOneCurriculum(), [])
  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem(onboardedKey) === 'true' ? 'app' : 'onboarding',
  )
  const [tab, setTab] = useState<Tab>('home')
  const [selectedLevel, setSelectedLevel] = useState('Zero. Teach me everything.')
  const [progress, setProgress] = useState<ProgressState>(() =>
    hydrateProgress(localStorage.getItem(progressKey)),
  )
  const [reminder, setReminder] = useState<ReminderPreference>(() =>
    hydrateReminder(localStorage.getItem(reminderKey)),
  )
  const [runtimeConfig, setRuntimeConfig] = useState<LocalRuntimeConfig>(() =>
    hydrateLocalRuntimeConfig(localStorage.getItem(runtimeKey)),
  )
  const [runtimeSummary, setRuntimeSummary] = useState<LocalRuntimeSummary>(() =>
    createMissingLocalRuntimeSummary(hydrateLocalRuntimeConfig(localStorage.getItem(runtimeKey))),
  )
  const [runtimeCheckStatus, setRuntimeCheckStatus] = useState<'idle' | 'checking' | 'checked' | 'error'>('idle')
  const [pronunciationPhraseId, setPronunciationPhraseId] = useState(pronunciationPhrases[0].id)
  const [pronunciationTranscript, setPronunciationTranscript] = useState('')
  const [pronunciationAudioStatus, setPronunciationAudioStatus] = useState('')
  const [pronunciationResult, setPronunciationResult] = useState<PronunciationScoreResult | null>(null)
  const [pronunciationHistory, setPronunciationHistory] = useState<PronunciationAttempt[]>(() =>
    hydratePronunciationHistory(localStorage.getItem(pronunciationKey)),
  )
  const [exportPayload, setExportPayload] = useState('')
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null)
  const [conversationStore, setConversationStore] = useState<ConversationStore>(() =>
    hydrateConversationStore(localStorage.getItem(conversationKey)),
  )
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultChatScenario.id)
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
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [generatedExercise, setGeneratedExercise] = useState('')
  const [modelSetupStarted, setModelSetupStarted] = useState(false)
  const [storyMode, setStoryMode] = useState<StoryMode>('list')
  const [selectedStoryId, setSelectedStoryId] = useState(stories[0].id)
  const [selectedStoryWord, setSelectedStoryWord] = useState<StoryWord | null>(null)
  const [selectedStoryAnswer, setSelectedStoryAnswer] = useState('')
  const [storyFeedback, setStoryFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [lessonIndex, setLessonIndex] = useState(0)
  const [totalLessonXp, setTotalLessonXp] = useState(0)
  const [placedWords, setPlacedWords] = useState<string[]>([])
  const [audioStatus, setAudioStatus] = useState('')
  const [speakingScore, setSpeakingScore] = useState<number | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<{ left?: string; right?: string }>({})
  const [matchedPairs, setMatchedPairs] = useState<string[]>([])

  const activeExercise = lessonExercises[Math.min(lessonIndex, lessonExercises.length - 1)]
  const activeStory = stories.find((story) => story.id === selectedStoryId) ?? stories[0]
  const selectedScenario =
    bangaloreScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? defaultChatScenario
  const selectedTutorPersona =
    tutorPersonas.find((persona) => persona.id === selectedTutorPersonaId) ?? defaultTutorPersona
  const activePronunciationPhrase =
    pronunciationPhrases.find((phrase) => phrase.id === pronunciationPhraseId) ?? pronunciationPhrases[0]
  const latestPronunciationAttempt = pronunciationHistory[0]
  const completedInCurrentLesson = Math.min(
    lessonIndex + (feedback === 'correct' ? 1 : 0),
    lessonExercises.length,
  )

  useEffect(() => {
    localStorage.setItem(progressKey, serializeProgress(progress))
  }, [progress])

  useEffect(() => {
    localStorage.setItem(reminderKey, JSON.stringify(reminder))
  }, [reminder])

  useEffect(() => {
    localStorage.setItem(runtimeKey, JSON.stringify(runtimeConfig))
  }, [runtimeConfig])

  useEffect(() => {
    localStorage.setItem(pronunciationKey, JSON.stringify(pronunciationHistory))
  }, [pronunciationHistory])

  useEffect(() => {
    localStorage.setItem(conversationKey, serializeConversationStore(conversationStore))
  }, [conversationStore])

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

  function startLearning() {
    localStorage.setItem(onboardedKey, 'true')
    setScreen('app')
  }

  function openLesson() {
    setLessonIndex(0)
    setTotalLessonXp(0)
    resetExerciseInteraction()
    setScreen('lesson')
  }

  function checkAnswer(exercise: LessonExercise) {
    if (feedback) {
      return
    }

    const correct = selectedAnswer === exercise.answer
    setFeedback(correct ? 'correct' : 'wrong')

    if (correct) {
      setTotalLessonXp((current) => current + exercise.xp)
    }

    setProgress((current) =>
      applyExerciseResult(current, {
        exerciseId: exercise.id,
        correct,
        skillTag: exercise.skillTag,
        xp: exercise.xp,
        vocabularyIds: exercise.vocabularyIds,
        now: new Date().toISOString(),
      }),
    )

    if (correct && lessonIndex === lessonExercises.length - 1) {
      setLessonIndex(lessonExercises.length)
      setSelectedAnswer('')
      setFeedback(null)
    }
  }

  function goToNextExercise() {
    if (lessonIndex + 1 >= lessonExercises.length) {
      setLessonIndex(lessonExercises.length)
      resetExerciseInteraction()
      return
    }

    setLessonIndex((current) => current + 1)
    resetExerciseInteraction()
  }

  function resetExerciseInteraction() {
    setSelectedAnswer('')
    setFeedback(null)
    setPlacedWords([])
    setAudioStatus('')
    setSpeakingScore(null)
    setSelectedMatch({})
    setMatchedPairs([])
  }

  function selectArrangeWord(word: string) {
    if (placedWords.includes(word)) {
      return
    }

    const nextWords = [...placedWords, word]
    setPlacedWords(nextWords)
    setSelectedAnswer(nextWords.join(' '))
  }

  function recordPhrase(exercise: LessonExercise) {
    setSpeakingScore(87)
    setSelectedAnswer(exercise.answer)
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
    const result = await generateExerciseWithOllama({ weakArea })
    setGeneratedExercise(
      `${result.source === 'ollama' ? 'Ollama' : 'Offline'}: ${result.exercise.prompt} ${result.exercise.kannada}`,
    )
  }

  function sendChatMessage() {
    const trimmed = chatInput.trim()
    if (!trimmed) {
      return
    }

    const tutorReply = buildTutorReply(trimmed, selectedScenario, selectedTutorPersona)
    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { id: `learner-${Date.now()}`, speaker: 'learner', text: trimmed },
      { id: `tutor-${Date.now()}`, speaker: 'tutor', ...tutorReply },
    ]
    setChatMessages(nextMessages)
    setConversationStore((current) => appendScenarioMessages(current, selectedScenario.id, nextMessages))
    setChatInput('')
    setVoiceStatus('')
  }

  function selectChatScenario(scenarioId: string) {
    const scenario = bangaloreScenarios.find((item) => item.id === scenarioId) ?? defaultChatScenario
    setSelectedScenarioId(scenario.id)
    setChatMessages(getScenarioMessages(conversationStore, scenario.id, [createOpeningMessage(scenario)]))
    setChatInput('')
    setVoiceStatus('')
  }

  function recordVoiceInput() {
    const voiceLine = getScenarioVoiceLine(selectedScenario)
    const tutorReply = buildTutorReply(voiceLine.text, selectedScenario, selectedTutorPersona)
    setVoiceStatus(`Voice input transcribed: ${voiceLine.transliteration}`)
    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      {
        id: `voice-${Date.now()}`,
        speaker: 'learner',
        text: voiceLine.text,
        subtext: voiceLine.transliteration,
      },
      { id: `voice-tutor-${Date.now()}`, speaker: 'tutor', ...tutorReply },
    ]
    setChatMessages(nextMessages)
    setConversationStore((current) => appendScenarioMessages(current, selectedScenario.id, nextMessages))
  }

  function toggleDailyReminder() {
    setReminder((current) => ({ ...current, enabled: !current.enabled }))
  }

  function setReminderTime(time: string) {
    setReminder((current) => ({ ...current, time }))
  }

  function allowReminderAlerts() {
    setReminder((current) => ({ ...current, permission: 'granted' }))
  }

  function updateRuntimePath(key: keyof LocalRuntimeConfig, value: string) {
    const nextConfig = { ...runtimeConfig, [key]: value }
    setRuntimeConfig(nextConfig)
    setRuntimeSummary(createMissingLocalRuntimeSummary(nextConfig))
    setRuntimeCheckStatus('idle')
  }

  async function checkLocalRuntime() {
    setRuntimeCheckStatus('checking')

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

  function selectPronunciationPhrase(phraseId: string) {
    setPronunciationPhraseId(phraseId)
    setPronunciationTranscript('')
    setPronunciationAudioStatus('')
    setPronunciationResult(null)
  }

  function playPronunciationReference() {
    setPronunciationAudioStatus(`Reference audio: ${activePronunciationPhrase.transliteration}`)
  }

  function scorePronunciationPractice() {
    const transcript = pronunciationTranscript.trim() || getSimulatedPronunciationTranscript(activePronunciationPhrase)
    const result = scorePronunciation({
      expectedText: activePronunciationPhrase.kannada,
      expectedTransliteration: activePronunciationPhrase.transliteration,
      transcript,
      targetParts: getPronunciationParts(activePronunciationPhrase.kannada),
    })
    const attempt: PronunciationAttempt = {
      id: `pronunciation-${Date.now()}`,
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

  function exportLearnerData() {
    const snapshot = buildExportSnapshot({
      exportedAt: new Date().toISOString(),
      progress,
      reminder,
      runtimeConfig,
      conversationStore,
      pronunciationHistory,
    })

    setExportPayload(serializeExportSnapshot(snapshot))
    setExportStatus({
      statusText: `Export ready: ${snapshot.summary.completedActivities} ${snapshot.summary.completedActivities === 1 ? 'activity' : 'activities'}, ${snapshot.summary.practicedWords} practiced ${snapshot.summary.practicedWords === 1 ? 'word' : 'words'}, ${snapshot.summary.pronunciationAttempts} pronunciation ${snapshot.summary.pronunciationAttempts === 1 ? 'attempt' : 'attempts'}`,
      runtimeText: `${snapshot.summary.runtimePathsConfigured} runtime ${snapshot.summary.runtimePathsConfigured === 1 ? 'path' : 'paths'} configured`,
    })
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
    return (
      <main className="app-shell onboarding-shell">
        <section className="splash-panel" aria-labelledby="onboarding-title">
          <div className="logo-mark" aria-hidden="true">
            ಕ
          </div>
          <p className="eyebrow">Offline Kannada AI teacher</p>
          <h1 id="onboarding-title">KannadaOS</h1>
          <p className="lead">
            Real Bangalore Kannada for buses, autos, darshinis, offices, and daily life.
          </p>
          <div className="level-grid" aria-label="Choose Kannada level">
            {[
              'Zero. Teach me everything.',
              'I know basics.',
              'Conversational, but rusty.',
            ].map((level) => (
              <button
                className={selectedLevel === level ? 'choice-card selected' : 'choice-card'}
                key={level}
                onClick={() => setSelectedLevel(level)}
                type="button"
              >
                <span>{level}</span>
                <small>{level.startsWith('Zero') ? 'Start with greetings and survival phrases' : 'Skip ahead later from Profile'}</small>
              </button>
            ))}
          </div>
          <button className="primary-action" onClick={startLearning} type="button">
            Start Learning
          </button>
        </section>
      </main>
    )
  }

  if (screen === 'lesson') {
    if (lessonIndex >= lessonExercises.length) {
      return (
        <main className="app-shell lesson-shell">
          <section className="lesson-card lesson-complete" aria-labelledby="lesson-complete-title">
            <p className="eyebrow">lesson complete</p>
            <h1 id="lesson-complete-title">Lesson Complete!</h1>
            <div className="star-row" aria-label="Three stars earned">
              <span>★</span>
              <span>★</span>
              <span>★</span>
            </div>
            <article className="xp-card">
              <strong>+{totalLessonXp} XP</strong>
              <span>Total: {progress.xp} XP</span>
            </article>
            <div className="completion-stats">
              <Stat value={100} label="Accuracy" />
              <Stat value={lessonExercises.length} label="Correct" />
              <Stat value={0} label="Wrong" />
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
            aria-label={`Lesson progress: ${completedInCurrentLesson} of ${lessonExercises.length} exercises complete`}
          >
            <span style={{ width: `${Math.max(12, (completedInCurrentLesson / lessonExercises.length) * 100)}%` }} />
          </div>
          <strong>Heart {progress.hearts}</strong>
        </header>
        <section className="lesson-card" aria-labelledby="lesson-title">
          <p className="eyebrow">{activeExercise.type}</p>
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
            <div className={feedback === 'correct' ? 'feedback correct' : 'feedback wrong'} role="status">
              <strong>{feedback === 'correct' ? 'Correct' : 'Try again'}</strong>
              <span>{feedback === 'correct' ? `+${activeExercise.xp} XP` : activeExercise.explanation}</span>
            </div>
          )}
          {feedback === 'correct' && (
            <button className="secondary-action" onClick={goToNextExercise} type="button">
              Next Exercise
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
                <span>Whisper model path</span>
                <input
                  onChange={(event) => updateRuntimePath('whisperModelPath', event.target.value)}
                  placeholder="/models/whisper-small.bin"
                  value={runtimeConfig.whisperModelPath}
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
            </div>
            <button
              className="primary-action runtime-check"
              disabled={runtimeCheckStatus === 'checking'}
              onClick={checkLocalRuntime}
              type="button"
            >
              {runtimeCheckStatus === 'checking' ? 'Checking Runtime' : 'Check Local Runtime'}
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
            <div className="runtime-component-grid">
              {runtimeSummary.components.map((component) => (
                <article className="runtime-component-card" key={component.id}>
                  <span className="model-category">{component.label}</span>
                  <strong className={component.ready ? 'model-state downloaded' : 'model-state'}>
                    {component.status}
                  </strong>
                  {component.modelPath && <small>{component.modelPath}</small>}
                  <p>{component.nextAction}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="desktop-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <div>
          <div className="brand-lockup">
            <span className="brand-mark">ಕ</span>
            <div>
              <strong>KannadaOS</strong>
              <p>ಕನ್ನಡ ಕಲಿಯಿರಿ</p>
            </div>
          </div>
          <nav className="nav-stack">
            {[
              ['home', 'Dashboard'],
              ['chat', 'Chat'],
              ['practice', 'Practice'],
              ['stories', 'Stories'],
              ['blr', 'BLR'],
              ['me', 'Me'],
            ].map(([id, label]) => (
              <button
                className={tab === id ? 'nav-button active' : 'nav-button'}
                key={id}
                onClick={() => setTab(id as Tab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <section className="model-status">
          <span>AI model</span>
          <strong>{ollamaStatus === 'online' ? 'Ollama online' : ollamaStatus === 'offline' ? 'Offline fallback' : 'Checking'}</strong>
          <button className="secondary-action" onClick={generateAiExercise} type="button">
            Generate AI Exercise
          </button>
          <button className="secondary-action" onClick={() => setScreen('models')} type="button">
            Manage Models
          </button>
          {generatedExercise && <p>{generatedExercise}</p>}
        </section>
      </aside>
      <section className="workspace">{renderTab()}</section>
    </main>
  )

  function renderTab() {
    if (tab === 'chat') {
      return (
        <section className="panel chat-panel" aria-labelledby="chat-title">
          <header className="section-header">
            <div>
              <p className="eyebrow">{selectedTutorPersona.name} - {selectedScenario.difficulty}</p>
              <h2 id="chat-title">{selectedScenario.title}</h2>
            </div>
            <button className="secondary-action" onClick={recordVoiceInput} type="button">
              Record Voice
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
                {message.subtext && <small>{message.subtext}</small>}
              </article>
            ))}
          </div>
          {voiceStatus && <p className="voice-status" role="status">{voiceStatus}</p>}
          <div className="suggestion-row">
            {selectedScenario.usefulPhrases.map((phrase) => (
              <button key={phrase.id} onClick={() => setChatInput(phrase.kannada)} type="button">
                <strong lang="kn">{phrase.kannada}</strong>
                <small>{phrase.english}</small>
              </button>
            ))}
          </div>
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault()
              sendChatMessage()
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
        .map((vocabularyId) => survivalPhrases.find((phrase) => phrase.id === vocabularyId))
        .filter((phrase): phrase is (typeof survivalPhrases)[number] => Boolean(phrase))
      const card = dueReviewPhrases[0] ?? survivalPhrases.find((phrase) => phrase.id === 'hogbeku')!
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
          <div className="review-layout">
            <button className="flashcard" onClick={() => setFlashcardBack((value) => !value)} type="button">
              <span lang="kn">{card.kannada}</span>
              <strong>{flashcardBack ? card.english : card.transliteration}</strong>
              {flashcardBack ? <small>{card.context}</small> : <small>Tap to flip</small>}
            </button>
            <div className="practice-stack">
              <article className="accent-card saffron">
                <strong>Adaptive difficulty: {titleCase(adaptiveDifficulty.level)}</strong>
                <p>{adaptiveDifficulty.reason}</p>
              </article>
              <article className="accent-card rose">
                <strong>Due Review Queue</strong>
                <p>{formatDueReviewSummary(dueReviewIds, progress)}</p>
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
                  <small>{phrase.transliteration}</small>
                </button>
              ))}
            </div>
            <article className="pronunciation-target">
              <div>
                <span className="model-category">target phrase</span>
                <strong lang="kn">{activePronunciationPhrase.kannada}</strong>
                <small>{activePronunciationPhrase.english}</small>
              </div>
              <div className="waveform compact" aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => (
                  <span key={index} style={{ height: `${18 + ((index * 11) % 42)}px` }} />
                ))}
              </div>
            </article>
            <div className="pronunciation-controls">
              <button className="secondary-action" onClick={playPronunciationReference} type="button">
                Play Reference
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
                {pronunciationAudioStatus}
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
                <small>{pronunciationResult.tip}</small>
              </article>
            )}
            {latestPronunciationAttempt && (
              <p className="pronunciation-history">
                Latest attempt: {latestPronunciationAttempt.transcript}
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
                        {word.text}
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
                  <span>{selectedStoryWord.transliteration}</span>
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
            <span className="metric-pill">1 unlocked</span>
          </header>
          <div className="story-grid">
            {stories.map((story) => (
              <article className={story.locked ? 'story-card locked' : 'story-card'} key={story.id}>
                <img src={story.imagePath} alt="" />
                <div className="story-card-body">
                  <span className={`difficulty-badge ${story.difficulty.toLowerCase()}`}>{story.difficulty}</span>
                  <h3>{story.title}</h3>
                  <p>{story.subtitle}</p>
                  <div className="story-meta">
                    <span>{story.readTimeMinutes} min read</span>
                    <span>{story.newWordCount} new words</span>
                  </div>
                  {story.locked ? (
                    <span className="locked-label">Locked</span>
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
            ))}
          </div>
        </section>
      )
    }

    if (tab === 'blr') {
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
            {bangaloreScenarios.map((scenario) => (
              <article className="scenario-card" key={scenario.id}>
                <span>{scenario.icon}</span>
                <strong>{scenario.title}</strong>
                <small>{scenario.difficulty}</small>
                <p>{scenario.situation}</p>
              </article>
            ))}
          </div>
        </section>
      )
    }

    if (tab === 'me') {
      const achievementSummaries = getAchievementSummaries(progress)
      const learnedWordCount = Object.keys(progress.reviewQueue).length
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
          <div className="settings-list">
            <button className="secondary-action" onClick={() => setScreen('models')} type="button">
              Manage AI Models
            </button>
            <button className="secondary-action" onClick={exportLearnerData} type="button">
              Export Data
            </button>
          </div>
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
            <strong>12 Day Streak!</strong>
            <p>Keep it up. {Math.max(0, 10 - progress.dailyXp)} XP to hit today&apos;s goal.</p>
          </div>
          <div className="ring" aria-label={`${progress.dailyXp} of 10 XP`}>
            {Math.min(10, progress.dailyXp)}/10
          </div>
        </section>
        <button className="continue-card" onClick={openLesson} type="button">
          <span>Continue: Greetings</span>
          <small>Lesson 3 of 8 - {curriculum.phrases.length} survival phrases loaded</small>
          <i>
            <b style={{ width: '37%' }} />
          </i>
        </button>
        <section className="level-map" aria-label="Level map">
          {['Greetings', 'Numbers', 'Transport', 'Food', 'Office', 'Boss'].map((node, index) => (
            <article className={index < 2 ? 'map-node done' : index === 2 ? 'map-node current' : 'map-node locked'} key={node}>
              <span>{index < 2 ? '✓' : index === 2 ? '★' : 'lock'}</span>
              <strong>{node}</strong>
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
            <strong lang="kn">{placedWords.length ? placedWords.join(' ') : 'Tap words below'}</strong>
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
                {word}
              </button>
            ))}
          </div>
        </>
      )
    }

    if (exercise.type === 'listening') {
      return (
        <>
          <div className="listening-card">
            <button
              className="speaker-button"
              onClick={() => setAudioStatus('Playing reference audio')}
              type="button"
            >
              Play reference audio
            </button>
            {audioStatus && <p role="status">{audioStatus}</p>}
          </div>
          {renderOptions(exercise)}
        </>
      )
    }

    if (exercise.type === 'speaking') {
      return (
        <>
          <div className="phrase-card">
            <strong lang="kn">{exercise.kannada}</strong>
            <span>{exercise.transliteration}</span>
          </div>
          <div className="speaking-card">
            <div className="waveform" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <span key={index} style={{ height: `${20 + ((index * 13) % 48)}px` }} />
              ))}
            </div>
            <button className="speaker-button" onClick={() => recordPhrase(exercise)} type="button">
              Record phrase
            </button>
            {speakingScore !== null && (
              <div className="score-card" role="status">
                <strong>Score: {speakingScore}%</strong>
                <span>Tip: Extend the aa sound in saar.</span>
              </div>
            )}
          </div>
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
                {pair.left}
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
                {pair.right}
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
          {exercise.transliteration && <span>{exercise.transliteration}</span>}
          {exercise.english && <small>{exercise.english}</small>}
          <button type="button" className="mini-button">
            Listen
          </button>
        </div>
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
            {option}
          </button>
        ))}
      </div>
    )
  }
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <article className="stat-card" aria-label={`${value} ${label}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
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

function getScenarioVoiceLine(scenario: Scenario) {
  if (scenario.id === 'bmtc-bus') {
    return {
      text: 'ಕೊರಮಂಗಲಕ್ಕೆ ಟಿಕೆಟ್ ಬೇಕು',
      transliteration: 'koramangala-ge ticket beku',
    }
  }

  const phrase = scenario.usefulPhrases[0]
  return {
    text: phrase.kannada,
    transliteration: phrase.transliteration,
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

function getPronunciationParts(kannada: string): string[] {
  return kannada
    .replace(/[?]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function getSimulatedPronunciationTranscript(phrase: Phrase): string {
  if (phrase.id === 'namaskara-saar') {
    return 'ನಮಸ್ಕಾರ'
  }

  return phrase.kannada.replace(/[?]/g, '')
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
      const phrase = survivalPhrases.find((item) => item.id === vocabularyId)
      const label = phrase?.kannada ?? vocabularyId.split(':').at(-1) ?? vocabularyId
      const strength = Math.round((progress.reviewQueue[vocabularyId]?.strength ?? 0) * 100)
      return `${label} - Strength ${strength}%`
    })
    .join(', ')
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default App
