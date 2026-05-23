import { useEffect, useMemo, useState } from 'react'
import { bangaloreScenarios, getLevelOneCurriculum, lessonExercises, survivalPhrases } from './domain/curriculum'
import {
  applyExerciseResult,
  hydrateProgress,
  serializeProgress,
  type ProgressState,
} from './domain/progress'
import { checkOllamaStatus, generateExerciseWithOllama } from './services/ollama'
import type { LessonExercise } from './types'
import './styles.css'

type Tab = 'home' | 'chat' | 'practice' | 'blr' | 'me'
type Screen = 'onboarding' | 'app' | 'lesson' | 'models'

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

const progressKey = 'kannadaos:progress'
const onboardedKey = 'kannadaos:onboarded'

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
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'opening',
      speaker: 'tutor',
      text: 'ಸಾರ್, ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು?',
      subtext: 'saar, ellige hogbeku? = Sir, where do you need to go?',
    },
  ])
  const [flashcardBack, setFlashcardBack] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [generatedExercise, setGeneratedExercise] = useState('')
  const [modelSetupStarted, setModelSetupStarted] = useState(false)
  const [lessonIndex, setLessonIndex] = useState(0)
  const [totalLessonXp, setTotalLessonXp] = useState(0)
  const [placedWords, setPlacedWords] = useState<string[]>([])
  const [audioStatus, setAudioStatus] = useState('')
  const [speakingScore, setSpeakingScore] = useState<number | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<{ left?: string; right?: string }>({})
  const [matchedPairs, setMatchedPairs] = useState<string[]>([])

  const activeExercise = lessonExercises[Math.min(lessonIndex, lessonExercises.length - 1)]
  const completedInCurrentLesson = Math.min(
    lessonIndex + (feedback === 'correct' ? 1 : 0),
    lessonExercises.length,
  )

  useEffect(() => {
    localStorage.setItem(progressKey, serializeProgress(progress))
  }, [progress])

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

    setChatMessages((messages) => [
      ...messages,
      { id: `learner-${Date.now()}`, speaker: 'learner', text: trimmed },
      {
        id: `tutor-${Date.now()}`,
        speaker: 'tutor',
        text: 'Majestic-ge hogbeku is better.',
        subtext: 'Add -ge for "to": ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು.',
      },
    ])
    setChatInput('')
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
              <p className="eyebrow">Beginner mode</p>
              <h2 id="chat-title">Auto Driver</h2>
            </div>
            <button className="secondary-action" type="button">
              Change Scenario
            </button>
          </header>
          <div className="chat-stream" aria-live="polite">
            {chatMessages.map((message) => (
              <article className={`message ${message.speaker}`} key={message.id}>
                <p>{message.text}</p>
                {message.subtext && <small>{message.subtext}</small>}
              </article>
            ))}
          </div>
          <div className="suggestion-row">
            {['ಎಷ್ಟು?', 'Meter?', 'Left hogi', 'Stop here'].map((suggestion) => (
              <button key={suggestion} onClick={() => setChatInput(suggestion)} type="button">
                {suggestion}
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
      const card = survivalPhrases.find((phrase) => phrase.id === 'hogbeku')!
      return (
        <section className="panel" aria-labelledby="practice-title">
          <header className="section-header">
            <div>
              <p className="eyebrow">3 weak areas</p>
              <h2 id="practice-title">Practice</h2>
            </div>
            <span className="metric-pill">12 words due today</span>
          </header>
          <div className="review-layout">
            <button className="flashcard" onClick={() => setFlashcardBack((value) => !value)} type="button">
              <span lang="kn">{card.kannada}</span>
              <strong>{flashcardBack ? card.english : card.transliteration}</strong>
              {flashcardBack ? <small>{card.context}</small> : <small>Tap to flip</small>}
            </button>
            <div className="practice-stack">
              <article className="accent-card rose">
                <strong>Verbs need review</strong>
                <p>ಹೋಗಬೇಕು, ಬರುತ್ತೆ, ಬೇಕು</p>
              </article>
              <article className="accent-card purple">
                <strong>Pronunciation Practice</strong>
                <p>5 phrases with waveform scoring</p>
              </article>
              <article className="accent-card saffron">
                <strong>AI Exercises</strong>
                <p>Targets your weakest skill with Ollama or local fallback.</p>
              </article>
            </div>
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
      return (
        <section className="panel" aria-labelledby="profile-title">
          <header className="profile-header">
            <div className="avatar">R</div>
            <div>
              <h2 id="profile-title">Rahul</h2>
              <p>Level 4 Learner</p>
              <strong>12 day streak</strong>
            </div>
          </header>
          <div className="stats-grid" data-testid="profile-stats">
            <Stat value={Math.max(340, progress.xp)} label="XP" />
            <Stat value={87} label="Words" />
            <Stat value={45} label="Hours" />
          </div>
          <section className="chart-card" aria-label="Progress chart">
            <span style={{ height: '32%' }} />
            <span style={{ height: '56%' }} />
            <span style={{ height: '44%' }} />
            <span style={{ height: '72%' }} />
            <span style={{ height: '64%' }} />
            <span style={{ height: '86%' }} />
          </section>
          <div className="achievement-grid">
            {['First Lesson', 'One Week', 'Voice Ready', 'BLR Explorer', 'Story Starter', 'Review Pro'].map(
              (achievement) => (
                <span key={achievement}>{achievement}</span>
              ),
            )}
          </div>
          <div className="settings-list">
            <button className="secondary-action" onClick={() => setScreen('models')} type="button">
              Manage AI Models
            </button>
            <button className="secondary-action" type="button">
              Export Data
            </button>
          </div>
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

function parseMatchPairs(answer: string) {
  return answer.split(';').map((pair) => {
    const [left, right] = pair.split('=')
    return { left, right }
  })
}

export default App
