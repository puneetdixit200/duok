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
type Screen = 'onboarding' | 'app' | 'lesson'

interface ChatMessage {
  id: string
  speaker: 'tutor' | 'learner'
  text: string
  subtext?: string
}

const progressKey = 'kannadaos:progress'
const onboardedKey = 'kannadaos:onboarded'

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

  const activeExercise = lessonExercises[0]

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

  function checkAnswer(exercise: LessonExercise) {
    const correct = selectedAnswer === exercise.answer
    setFeedback(correct ? 'correct' : 'wrong')
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
    return (
      <main className="app-shell lesson-shell">
        <header className="lesson-topbar">
          <button className="icon-button" onClick={() => setScreen('app')} type="button" aria-label="Close lesson">
            x
          </button>
          <div className="lesson-progress" aria-label="Lesson progress: 1 of 6 exercises complete">
            <span style={{ width: feedback ? '34%' : '18%' }} />
          </div>
          <strong>Heart {progress.hearts}</strong>
        </header>
        <section className="lesson-card" aria-labelledby="lesson-title">
          <p className="eyebrow">{activeExercise.type}</p>
          <h1 id="lesson-title">{activeExercise.prompt}</h1>
          <div className="phrase-card">
            <strong lang="kn">{activeExercise.kannada}</strong>
            <span>{activeExercise.transliteration}</span>
            <button type="button" className="mini-button">
              Listen
            </button>
          </div>
          <div className="option-stack">
            {activeExercise.options.map((option) => (
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
        <button className="continue-card" onClick={() => setScreen('lesson')} type="button">
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
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <article className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  )
}

export default App
