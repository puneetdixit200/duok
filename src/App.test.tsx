import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { coreCurriculumUnits, getScriptCurriculumUnit } from './domain/curriculum'
import { completeLessonProgress, createInitialProgress, serializeProgress } from './domain/progress'

const voiceCaptureMock = vi.hoisted(() => ({
  startVoiceCapture: vi.fn(),
}))

vi.mock('./services/voiceCapture', () => ({
  startVoiceCapture: voiceCaptureMock.startVoiceCapture,
}))

async function completeOnboarding(user: ReturnType<typeof userEvent.setup>, dailyGoal: RegExp = /10 XP/i) {
  await user.click(screen.getByRole('button', { name: /continue onboarding/i }))
  await user.click(screen.getByRole('button', { name: /moved to bangalore/i }))
  await user.click(screen.getByRole('button', { name: /next: choose level/i }))
  await user.click(screen.getByRole('button', { name: /zero/i }))
  await user.click(screen.getByRole('button', { name: /next: set goal/i }))
  await user.click(screen.getByRole('button', { name: dailyGoal }))
  await user.click(screen.getByRole('button', { name: /start learning/i }))
}

function stubKannadaWebSpeech(voices: Array<{ lang: string; name: string }> = []) {
  const speak = vi.fn()
  vi.stubGlobal('speechSynthesis', {
    getVoices: vi.fn(() => voices),
    speak,
  })
  vi.stubGlobal('SpeechSynthesisUtterance', class MockSpeechSynthesisUtterance {
    lang = ''
    rate = 1
    voice: unknown = null

    constructor(public text: string) {}
  })
  return speak
}

describe('KannadaOS desktop app', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    voiceCaptureMock.startVoiceCapture.mockReset()
    voiceCaptureMock.startVoiceCapture.mockResolvedValue({
      stop: vi.fn().mockResolvedValue({
        audioBytes: new Uint8Array([82, 73, 70, 70]),
        durationMs: 800,
        sampleRate: 16000,
      }),
    })
    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      transcribeRecordedAudio: vi.fn().mockResolvedValue({ ok: true, text: 'ನಮಸ್ಕಾರ ಸಾರ್' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('stores a learner profile from onboarding and moves to the home dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /continue onboarding/i }))
    await user.click(screen.getByRole('button', { name: /moved to bangalore/i }))
    await user.click(screen.getByRole('button', { name: /next: choose level/i }))
    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /next: set goal/i }))
    await user.click(screen.getByRole('button', { name: /20 XP/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))

    expect(screen.getByRole('heading', { name: /KannadaOS/i })).toBeInTheDocument()
    expect(screen.getByText(/Learn Kannada/i)).toBeInTheDocument()
    expect(screen.getAllByText(/🔥 Start a streak!/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Continue: Hello & Thanks/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Greetings & Basics/i })).toBeInTheDocument()
    expect(screen.getAllByText(/^Universal polite greeting$/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/^English: Hello sir$/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText(/Daily quests/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/0 of 20 XP/i)).toHaveTextContent('0/20')
    expect(localStorage.getItem('kannadaos:learner-profile')).toContain('"dailyGoalXp":20')
    expect(localStorage.getItem('kannadaos:sound-prefs')).toContain('"autoPlayAudio":true')
    expect(screen.getByRole('button', { name: /learn/i })).toBeInTheDocument()
  })

  it('offers every spec onboarding motivation and starting-level choice', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /continue onboarding/i }))

    const motivationChoices = screen.getByLabelText(/Choose learning motivation/i)
    expect(within(motivationChoices).getByRole('button', { name: /I just moved to Bangalore/i })).toBeInTheDocument()
    expect(within(motivationChoices).getByRole('button', { name: /I want to talk to family\/friends/i })).toBeInTheDocument()
    expect(within(motivationChoices).getByRole('button', { name: /I'm curious about the language/i })).toBeInTheDocument()
    expect(within(motivationChoices).getByRole('button', { name: /Work requires some Kannada/i })).toBeInTheDocument()

    await user.click(within(motivationChoices).getByRole('button', { name: /Work requires some Kannada/i }))
    await user.click(screen.getByRole('button', { name: /next: choose level/i }))

    const levelChoices = screen.getByLabelText(/Choose Kannada level/i)
    expect(within(levelChoices).getByRole('button', { name: /Zero.*Teach me everything/i })).toBeInTheDocument()
    expect(within(levelChoices).getByRole('button', { name: /I know a few words.*namaskara.*eshtu.*beku/i })).toBeInTheDocument()
    expect(within(levelChoices).getByRole('button', { name: /I can have basic conversations/i })).toBeInTheDocument()
    expect(within(levelChoices).getByRole('button', { name: /I can read Kannada script/i })).toBeInTheDocument()

    await user.click(within(levelChoices).getByRole('button', { name: /I know a few words/i }))
    await user.click(screen.getByRole('button', { name: /next: set goal/i }))
    await user.click(screen.getByRole('button', { name: /5 XP/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))

    expect(localStorage.getItem('kannadaos:learner-profile')).toContain('"motivation":"work"')
    expect(localStorage.getItem('kannadaos:learner-profile')).toContain('"startingLevel":"few-words"')
    expect(localStorage.getItem('kannadaos:learner-profile')).toContain('"dailyGoalXp":5')
  })

  it('shows spec daily quest states and claim celebration', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:learner-profile', JSON.stringify({
      motivation: 'moved-to-bangalore',
      startingLevel: 'zero',
      dailyGoalXp: 10,
      onboardedAt: '2026-05-27T08:00:00.000Z',
    }))
    localStorage.setItem('kannadaos:progress', serializeProgress({
      ...createInitialProgress(),
      dailyXp: 10,
      gems: 120,
      completedExerciseIds: ['survival-translate-1', 'survival-arrange-1', 'survival-fill-1'],
      todayActivityIds: ['survival-translate-1', 'survival-arrange-1', 'survival-fill-1'],
    }))

    render(<App />)

    const quests = screen.getByLabelText(/Daily quests/i)
    const xpQuestCard = within(quests).getByText('Earn 10 XP').closest('article')
    const activityQuestCard = within(quests).getByText('Complete 3 activities').closest('article')
    const heartsQuestCard = within(quests).getByText('Keep every heart').closest('article')
    expect(xpQuestCard).toBeInTheDocument()
    expect(activityQuestCard).toBeInTheDocument()
    expect(heartsQuestCard).toBeInTheDocument()

    expect(within(xpQuestCard!).getByText('✅')).toBeInTheDocument()
    expect(within(xpQuestCard!).getByRole('progressbar', { name: /Earn 10 XP progress/i })).toHaveAttribute('aria-valuenow', '10')
    expect(within(xpQuestCard!).getByRole('button', { name: /Claim 10/i })).toBeEnabled()
    expect(within(activityQuestCard!).getByRole('button', { name: /Claim 15/i })).toBeEnabled()
    expect(within(heartsQuestCard!).getByText('⬜')).toBeInTheDocument()
    expect(within(heartsQuestCard!).getByRole('button', { name: /In progress/i })).toBeDisabled()

    await user.click(within(xpQuestCard!).getByRole('button', { name: /Claim 10/i }))

    expect(within(xpQuestCard!).getByRole('button', { name: /Claimed/i })).toBeDisabled()
    expect(within(xpQuestCard!).getByLabelText(/Quest claim celebration: Earn 10 XP/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Gems/)).toHaveTextContent('💎 130')
  })

  it('shows home quick actions for practice, stories, and chat', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)

    const quickActions = screen.getByRole('region', { name: /Quick actions/i })
    expect(quickActions).toHaveTextContent('Practice')
    expect(quickActions).toHaveTextContent('Stories')
    expect(quickActions).toHaveTextContent('Chat')

    await user.click(within(quickActions).getByRole('button', { name: /Open review drills/i }))
    expect(screen.getByRole('heading', { name: /Practice/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '1', metaKey: true })
    await user.click(within(screen.getByRole('region', { name: /Quick actions/i })).getByRole('button', { name: /Open reader mode/i }))
    expect(screen.getByRole('heading', { name: /Stories/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '1', metaKey: true })
    await user.click(within(screen.getByRole('region', { name: /Quick actions/i })).getByRole('button', { name: /Open tutor messages/i }))
    expect(screen.getByRole('heading', { name: /Auto Ride/i })).toBeInTheDocument()
  })

  it('renders spec navigation icons and learner resource counters', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)

    const navigation = screen.getByLabelText(/Primary navigation/i)
    for (const [icon, label] of [
      ['🏠', 'Dashboard'],
      ['📚', 'Learn'],
      ['🔄', 'Practice'],
      ['📖', 'Stories'],
      ['💬', 'Chat'],
      ['🏙️', 'BLR'],
      ['👤', 'Me'],
    ]) {
      const button = within(navigation).getByRole('button', { name: new RegExp(label, 'i') })
      expect(button).toHaveTextContent(icon)
      expect(button).toHaveTextContent(label)
    }

    const resources = screen.getByLabelText(/resources/i)
    expect(resources).toHaveTextContent('🔥 Start a streak!')
    expect(resources).toHaveTextContent('❤️ 5')
    expect(resources).toHaveTextContent('💎 120')

    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    expect(screen.getByLabelText(/Lesson hearts/i)).toHaveTextContent('❤️ 5')
  })

  it('opens the Learn tab with curriculum units and grammar tips', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /learn/i }))

    expect(screen.getByRole('heading', { name: /Learn Kannada/i })).toBeInTheDocument()
    expect(screen.getByText(/Unit 0: Kannada Script/i)).toBeInTheDocument()
    expect(screen.getByText(/Unit 1: Greetings & Basics/i)).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /tips/i })[1])

    const tipsDialog = screen.getByRole('dialog', { name: /Tips: Greetings & Basics/i })
    expect(tipsDialog).toBeInTheDocument()
    expect(within(tipsDialog).getAllByText(/^Universal polite greeting$/i).length).toBeGreaterThanOrEqual(1)
  })

  it('runs Kannada Script Academy letter and transliteration drills', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /learn/i }))
    await user.click(screen.getByRole('button', { name: /Vowels Part 1/i }))

    expect(screen.getByRole('heading', { name: /Which letter makes the "a" sound/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ಅ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByText(/Correct/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByRole('heading', { name: /Which letter did you hear/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ಆ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByText(/Correct/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByRole('heading', { name: /Match script to sound/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ಅ/i }))
    await user.click(screen.getByRole('button', { name: /^a$/i }))
    await user.click(screen.getByRole('button', { name: /ಆ/i }))
    await user.click(screen.getByRole('button', { name: /^aa$/i }))
    await user.click(screen.getByRole('button', { name: /ಇ/i }))
    await user.click(screen.getByRole('button', { name: /^i$/i }))
    await user.click(screen.getByRole('button', { name: /ಈ/i }))
    await user.click(screen.getByRole('button', { name: /^ii$/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByText(/Correct/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByRole('heading', { name: /Type the transliteration/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Script transliteration answer/i), 'a')
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByText(/Correct/i)).toBeInTheDocument()
  })

  it('shows English-readable subtitles on every Kannada script choice', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /learn/i }))
    await user.click(screen.getByRole('button', { name: /Vowels Part 1/i }))

    expect(screen.getByRole('button', { name: /^English: Sounds like aa\s+ಆ\s+Say: aa/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^English: Sounds like i\s+ಇ\s+Say: i/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^English: Sounds like ii\s+ಈ\s+Say: ii/i })).toBeInTheDocument()
  })

  it('shows navigation badges for active streak and due practice reviews', () => {
    const progress = {
      ...createInitialProgress(),
      streakDays: 3,
      reviewQueue: {
        hogbeku: {
          vocabularyId: 'hogbeku',
          dueAt: '2026-05-20T09:00:00.000Z',
          strength: 0.4,
          attempts: 1,
          leitnerBox: 2,
        },
        'ticket-eshtu': {
          vocabularyId: 'ticket-eshtu',
          dueAt: '2026-05-21T09:00:00.000Z',
          strength: 0.6,
          attempts: 2,
          leitnerBox: 3,
        },
        dhanyavada: {
          vocabularyId: 'dhanyavada',
          dueAt: '2099-05-21T09:00:00.000Z',
          strength: 0.8,
          attempts: 3,
          leitnerBox: 4,
        },
      },
    }
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress(progress))

    render(<App />)

    const navigation = screen.getByLabelText(/Primary navigation/i)
    expect(within(navigation).getByRole('button', { name: /Dashboard.*streak active/i })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: /Practice.*2 due reviews/i })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: /^Chat$/i })).toBeInTheDocument()
  })

  it('shows recovery actions when the learner is out of hearts', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress({
      ...createInitialProgress(),
      hearts: 0,
      gems: 60,
      lastHeartLostAt: new Date().toISOString(),
    }))

    render(<App />)

    const recoveryCard = screen.getByRole('region', { name: /Out of Hearts/i })
    expect(within(recoveryCard).getByRole('heading', { name: /Out of Hearts/i })).toBeInTheDocument()
    expect(within(recoveryCard).getAllByText(/Practice to earn hearts/i).length).toBeGreaterThanOrEqual(1)
    expect(within(recoveryCard).getByText(/Wait 4 hours for 1 heart/i)).toBeInTheDocument()
    expect(within(recoveryCard).getByRole('button', { name: /Refill 50 gems/i })).toBeEnabled()

    await user.click(within(recoveryCard).getByRole('button', { name: /Practice Now/i }))
    expect(screen.getByRole('heading', { name: /Practice/i })).toBeInTheDocument()
  })

  it('checks a lesson answer, awards XP, and shows feedback', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    const feedbackPanel = screen.getByRole('status', { name: /Correct feedback/i })
    expect(within(feedbackPanel).getByText('Correct!')).toBeInTheDocument()
    expect(screen.getByText(/\+2 XP/i)).toBeInTheDocument()
    expect(within(feedbackPanel).getByText('ನಮಸ್ಕಾರ ಸಾರ್ = Hello sir')).toBeInTheDocument()
    expect(within(feedbackPanel).getByText(/respectful hello used across Bangalore/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('shows spec wrong-answer feedback with heart loss and the correct answer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Goodbye sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    const feedbackPanel = screen.getByRole('status', { name: /Wrong answer feedback/i })
    expect(within(feedbackPanel).getByText('Not quite.')).toBeInTheDocument()
    expect(within(feedbackPanel).getByText('❤️ -1')).toBeInTheDocument()
    expect(within(feedbackPanel).getByText('Correct answer: Hello sir')).toBeInTheDocument()
    expect(within(feedbackPanel).getByText(/respectful hello used across Bangalore/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument()
  })

  it('adds English subtitles to Kannada correct answers after a wrong lesson answer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /I am fine.*ಚೆನ್ನಾಗಿದ್ದೇನೆ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    const feedbackPanel = screen.getByRole('status', { name: /Wrong answer feedback/i })
    expect(within(feedbackPanel).getByText('Correct answer: ನಮಸ್ಕಾರ ಸಾರ್ ಹೇಗಿದ್ದೀರಾ')).toBeInTheDocument()
    expect(within(feedbackPanel).getByText('English: Hello sir, how are you?')).toBeInTheDocument()
    expect(within(feedbackPanel).getByText('Say: namaskara saar hegiddira')).toBeInTheDocument()
  })

  it('reintroduces a missed lesson exercise after two more exercises', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    await user.click(screen.getByRole('button', { name: 'Goodbye sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /question will return/i }))

    expect(screen.getByText('arrange')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('fillBlank')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('translate')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Translate this phrase/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hello sir' })).toBeInTheDocument()
  })

  it('renders segmented lesson progress for current, completed, and wrong states', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    let progressBar = screen.getByLabelText(/Lesson progress: 0 of 6 exercises complete/i)
    expect(within(progressBar).getAllByLabelText(/Exercise \d of 6:/i)).toHaveLength(6)
    expect(within(progressBar).getByLabelText('Exercise 1 of 6: current')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    progressBar = screen.getByLabelText(/Lesson progress: 1 of 6 exercises complete/i)
    expect(within(progressBar).getByLabelText('Exercise 1 of 6: completed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    progressBar = screen.getByLabelText(/Lesson progress: 1 of 6 exercises complete/i)
    expect(within(progressBar).getByLabelText('Exercise 2 of 6: current')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    progressBar = screen.getByLabelText(/Lesson progress: 1 of 7 exercises complete/i)
    expect(within(progressBar).getAllByLabelText(/Exercise \d of 7:/i)).toHaveLength(7)
    expect(within(progressBar).getByLabelText('Exercise 1 of 7: completed')).toBeInTheDocument()
    expect(within(progressBar).getByLabelText('Exercise 2 of 7: wrong')).toBeInTheDocument()
  })

  it('plays bundled sound effects for lesson feedback and completion', async () => {
    const user = userEvent.setup()
    const play = vi.fn().mockResolvedValue(undefined)
    const AudioMock = vi.fn(function mockAudio(this: { play: typeof play }) {
      this.play = play
    })
    vi.stubGlobal('Audio', AudioMock)
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(AudioMock).toHaveBeenCalledWith('./sounds/correct.wav')
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByRole('button', { name: /^Listen first$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /play reference audio/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Check$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))
    expect(await screen.findByText(/Score: 100 \/ 100/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Continue/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: 'Hello' }))
    await user.click(screen.getByRole('button', { name: /ಧನ್ಯವಾದ/i }))
    await user.click(screen.getByRole('button', { name: 'Thank you' }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗು/i }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await user.click(screen.getByRole('button', { name: /ಬಾ/i }))
    await user.click(screen.getByRole('button', { name: 'Come' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByRole('heading', { name: /Lesson Complete/i })).toBeInTheDocument()
    expect(AudioMock).toHaveBeenCalledWith('./sounds/lesson-complete.wav')
  }, 30_000)

  it('plays the wrong-answer sound and respects the sound effects toggle', async () => {
    const user = userEvent.setup()
    const play = vi.fn().mockResolvedValue(undefined)
    const AudioMock = vi.fn(function mockAudio(this: { play: typeof play }) {
      this.play = play
    })
    vi.stubGlobal('Audio', AudioMock)
    const { unmount } = render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Goodbye sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(AudioMock).toHaveBeenCalledWith('./sounds/wrong.wav')

    unmount()
    localStorage.clear()
    vi.clearAllMocks()
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":false,"autoPlayAudio":true}')
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(AudioMock).not.toHaveBeenCalled()
  })

  it('shows English-readable subtitles for Kannada exercise text and choices', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getAllByText(/namaskara saar hegiddira/i).length).toBeGreaterThanOrEqual(1)
    const wordBank = screen.getByLabelText(/Word bank/i)
    expect(within(wordBank).getByRole('button', { name: /hello.*ನಮಸ್ಕಾರ.*namaskara/i })).toBeInTheDocument()
    expect(within(wordBank).getByRole('button', { name: /sir.*ಸಾರ್.*saar/i })).toBeInTheDocument()
    expect(within(wordBank).getByRole('button', { name: /how are you.*ಹೇಗಿದ್ದೀರಾ.*hegiddira/i })).toBeInTheDocument()

    await user.click(within(wordBank).getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(within(wordBank).getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(within(wordBank).getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText(/hogbeku/i)).toBeInTheDocument()
    const fillOptions = screen.getByRole('button', { name: /ಹೋಗಬೇಕು.*hogbeku/i })
    expect(fillOptions).toBeInTheDocument()
  })

  it('shows an English-first word guide for Kannada arrange choices', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    const wordGuide = screen.getByRole('region', { name: /English word guide/i })
    expect(within(wordGuide).getByText(/^hello$/i)).toBeInTheDocument()
    expect(within(wordGuide).getByText(/^sir$/i)).toBeInTheDocument()
    expect(within(wordGuide).getByText(/^how are you$/i)).toBeInTheDocument()
    expect(within(wordGuide).getByText(/^I am fine$/i)).toBeInTheDocument()
    expect(within(wordGuide).getByText(/ನಮಸ್ಕಾರ/i)).toBeInTheDocument()
    expect(within(wordGuide).getByText(/Say: namaskara/i)).toBeInTheDocument()
  })

  it('lets learners remove placed words from the arrange answer area', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    const wordBank = screen.getByLabelText(/Word bank/i)
    await user.click(within(wordBank).getByRole('button', { name: /hello.*ನಮಸ್ಕಾರ.*namaskara/i }))

    const answerArea = screen.getByRole('region', { name: /Placed words/i })
    expect(within(answerArea).getByRole('button', { name: /Remove ನಮಸ್ಕಾರ from answer/i })).toBeInTheDocument()
    expect(within(wordBank).getByRole('button', { name: /hello.*ನಮಸ್ಕಾರ.*namaskara/i })).toBeDisabled()

    await user.click(within(answerArea).getByRole('button', { name: /Remove ನಮಸ್ಕಾರ from answer/i }))

    expect(screen.getByText(/Tap words below/i)).toBeInTheDocument()
    expect(within(wordBank).getByRole('button', { name: /hello.*ನಮಸ್ಕಾರ.*namaskara/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled()
  })

  it('shows English subtitles on non-lesson Kannada study surfaces', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /practice/i }))

    expect(screen.getByRole('button', { name: /^English: need to go\s+ಹೋಗಬೇಕು\s+Say: hogbeku/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /stories/i }))
    await user.click(screen.getByRole('button', { name: /read first day in bangalore/i }))

    expect(screen.getByRole('button', { name: /^English: came\s+ಬಂದ\s+Say: banda/i })).toBeInTheDocument()
  })

  it('adds English and romanized aria labels to visible Kannada text', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)

    expect(screen.getByLabelText(/^English: Learn Kannada ಕನ್ನಡ ಕಲಿಯಿರಿ Say: kannada kaliyiri$/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^English: hello$/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/^Say: namaskara$/i).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByLabelText(/^English: I to school need to go\s+ನಾನು ಶಾಲೆಗೆ ಹೋಗಬೇಕು\s+Say: naanu shaalege hogbeku$/i).length,
    ).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    expect(screen.getByLabelText(/^English: Hello sir\s+ನಮಸ್ಕಾರ ಸಾರ್\s+Say: namaskara saar$/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /close lesson/i }))
    await user.click(screen.getByRole('button', { name: /stories/i }))
    await user.click(screen.getByRole('button', { name: /read first day in bangalore/i }))

    expect(
      screen.getByLabelText(/^English: Rahul came to Bangalore\.\s+ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ\.\s+Say: raahul bengalurige banda$/i),
    ).toBeInTheDocument()
  })

  it('keeps English subtitles visible when a Kannada label sounds the same in English', () => {
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:ai-expansion', JSON.stringify([
      {
        type: 'translate',
        prompt: 'AI ticket drill',
        kannada: 'ಟಿಕೆಟ್',
        answer: 'ticket',
        options: ['ticket'],
        explanation: 'Ticket means ticket.',
      },
    ]))

    render(<App />)

    const expansionQueue = screen.getByLabelText(/AI curriculum expansion/i)
    expect(within(expansionQueue).getByText('English: ticket')).toBeInTheDocument()
    expect(within(expansionQueue).getByText('Say: ticket')).toBeInTheDocument()
  })

  it('adds English phrase subtitles to generated Kannada word choices', async () => {
    const user = userEvent.setup()
    const [firstLesson, secondLesson, introductionsLesson] = coreCurriculumUnits[0].lessons
    const progress = [firstLesson, secondLesson].reduce(
      (state, lesson, index) =>
        completeLessonProgress(state, lesson.id, `2026-05-27T10:0${index}:00.000Z`),
      createInitialProgress(),
    )
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress(progress))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /learn/i }))
    await user.click(screen.getByRole('button', { name: new RegExp(introductionsLesson.title, 'i') }))
    await user.click(screen.getByRole('button', { name: /What is your name/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    const wordBank = screen.getByLabelText(/Word bank/i)
    expect(within(wordBank).getByRole('button', { name: /phrase: What is your name.*ನಿಮ್ಮ.*nimma/i })).toBeInTheDocument()
    expect(within(wordBank).getByRole('button', { name: /phrase: What is your name.*ಹೆಸರು.*hesaru/i })).toBeInTheDocument()
  })

  it('keeps listening answer text hidden until the learner checks', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    const listeningChoices = screen.getByLabelText(/Listening choices/i)
    expect(within(listeningChoices).queryByText(/ಟಿಕೆಟ್ ಎಷ್ಟು/i)).not.toBeInTheDocument()
    await user.click(within(listeningChoices).getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(within(listeningChoices).getByText(/ಟಿಕೆಟ್ ಎಷ್ಟು/i)).toBeInTheDocument()
  })

  it('offers slow reference audio in listening, speaking, and the pronunciation lab', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('listening')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Slow$/i }))
    expect(screen.getByText(/Playing slow reference audio.*0\.7x/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('speaking')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /play slow audio/i }))
    expect(screen.getByText(/Playing slow reference audio.*0\.7x/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Close lesson/i }))
    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.click(screen.getByRole('button', { name: /play slow/i }))
    expect(screen.getByText(/Slow reference audio.*0\.7x/i)).toBeInTheDocument()
  }, 30_000)

  it('allows a near-miss typeKannada answer to retry without losing a heart', async () => {
    const user = userEvent.setup()
    const [firstLesson, secondLesson, introductionsLesson] = coreCurriculumUnits[0].lessons
    const progress = [
      firstLesson,
      secondLesson,
      introductionsLesson,
      introductionsLesson,
    ].reduce(
      (state, lesson, index) =>
        completeLessonProgress(state, lesson.id, `2026-05-27T10:0${index}:00.000Z`),
      createInitialProgress(),
    )
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress(progress))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /learn/i }))
    await user.click(screen.getByRole('button', { name: new RegExp(introductionsLesson.title, 'i') }))

    expect(screen.getByText('typeKannada')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Kannada typing answer/i), 'ನಿಮ್ಮ ಹೆಸರು ಏನ')
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByText(/Almost! Check:/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Lesson hearts/i)).toHaveTextContent('❤️ 5')

    await user.clear(screen.getByLabelText(/Kannada typing answer/i))
    await user.type(screen.getByLabelText(/Kannada typing answer/i), 'ನಿಮ್ಮ ಹೆಸರು ಏನು?')
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByText(/Correct/i)).toBeInTheDocument()
  }, 30_000)

  it('unlocks the first three core units for learners who already know basic conversations', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /continue onboarding/i }))
    await user.click(screen.getByRole('button', { name: /moved to bangalore/i }))
    await user.click(screen.getByRole('button', { name: /next: choose level/i }))
    await user.click(screen.getByRole('button', { name: /basic conversations/i }))
    await user.click(screen.getByRole('button', { name: /next: set goal/i }))
    await user.click(screen.getByRole('button', { name: /10 XP/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /learn/i }))

    expect(screen.getByRole('button', { name: /Auto Ride Basics/i })).toBeEnabled()
  })

  it('marks script academy lessons complete for learners who can read Kannada script', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /continue onboarding/i }))
    await user.click(screen.getByRole('button', { name: /I just moved to Bangalore/i }))
    await user.click(screen.getByRole('button', { name: /next: choose level/i }))
    await user.click(screen.getByRole('button', { name: /I can read Kannada script/i }))
    await user.click(screen.getByRole('button', { name: /next: set goal/i }))
    await user.click(screen.getByRole('button', { name: /10 XP/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /learn/i }))

    expect(screen.getByRole('button', { name: /Learn unit 1 lesson 1: Vowels Part 1, 1 crowns/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Learn unit 1 lesson 9: Reading Practice, 1 crowns/i })).toBeInTheDocument()
    expect(localStorage.getItem('kannadaos:learner-profile')).toContain('"startingLevel":"can-read"')
  })

  it('switches primary tabs with desktop keyboard shortcuts', async () => {
    localStorage.setItem('kannadaos:onboarded', 'true')
    render(<App />)

    const navigation = screen.getByLabelText(/Primary navigation/i)
    expect(within(navigation).getAllByRole('button').slice(0, 7).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Dashboard',
      'Learn',
      'Practice',
      'Stories',
      'Chat',
      'BLR',
      'Me',
    ])

    fireEvent.keyDown(window, { key: '1', metaKey: true })
    expect(screen.getByRole('heading', { name: /^KannadaOS$/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '2', metaKey: true })
    expect(screen.getByRole('heading', { name: /Learn Kannada/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '3', metaKey: true })
    expect(screen.getByRole('heading', { name: /Practice/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '4', metaKey: true })
    expect(screen.getByRole('heading', { name: /Stories/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '5', metaKey: true })
    expect(screen.getByRole('heading', { name: /Auto Ride/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '6', metaKey: true })
    expect(screen.getByRole('heading', { name: /Slang of the Day/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '7', metaKey: true })
    expect(screen.getByRole('heading', { name: /Rahul/i })).toBeInTheDocument()
  })

  it('supports lesson keyboard bindings for select, check, replay, continue, and escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    fireEvent.keyDown(window, { key: ' ' })
    expect(screen.getByText(/Playing reference audio/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true })
    expect(screen.getByText(/Correct/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('arrange')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'r', metaKey: true })
    expect(screen.getByText(/Playing reference audio/i)).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('heading', { name: /KannadaOS/i })).toBeInTheDocument()
  })

  it('puts English subtitles first on Kannada exercise choices', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('arrange')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^English: hello\s+ನಮಸ್ಕಾರ\s+Say: namaskara/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^English: sir\s+ಸಾರ್\s+Say: saar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^English: how are you\s+ಹೇಗಿದ್ದೀರಾ\s+Say: hegiddira/i })).toBeInTheDocument()
  })

  it('renders the reverse translate variant from English to Kannada', async () => {
    const user = userEvent.setup()
    const firstLesson = coreCurriculumUnits[0].lessons[0]
    const progress = completeLessonProgress(createInitialProgress(), firstLesson.id, '2026-05-27T10:00:00.000Z')
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress(progress))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /learn/i }))
    await user.click(screen.getByRole('button', { name: /How Are You/i }))

    expect(screen.getByRole('heading', { name: /Translate to Kannada/i })).toBeInTheDocument()
    expect(screen.getByText('Choose the Kannada phrase for:')).toBeInTheDocument()
    expect(screen.getByText('How are you?')).toBeInTheDocument()

    const correctOption = screen.getByRole('button', {
      name: /^English: how are you\s+ಹೇಗಿದ್ದೀರಾ\?\s+Say: hegiddira$/i,
    })
    expect(correctOption).toBeInTheDocument()

    await user.click(correctOption)
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByRole('status', { name: /Correct feedback/i })).toHaveTextContent('+2 XP')
    expect(screen.getByText(/ಹೇಗಿದ್ದೀರಾ\? = How are you\?/i)).toBeInTheDocument()
  })

  it('opens one-crown lessons with reduced-option crown replay drills', async () => {
    const user = userEvent.setup()
    const firstLesson = coreCurriculumUnits[0].lessons[0]
    const progress = completeLessonProgress(createInitialProgress(), firstLesson.id, '2026-05-27T10:00:00.000Z')
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress(progress))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /learn/i }))
    await user.click(screen.getByRole('button', { name: /Learn unit 2 lesson 1: Hello & Thanks, 1 crowns/i }))

    expect(screen.getByRole('heading', { name: /Translate this phrase/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hello sir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Goodbye sir' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thank you sir' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'How are you sir' })).not.toBeInTheDocument()
  })

  it('times out crown-four replay drills after fifteen seconds', async () => {
    vi.useFakeTimers()
    const firstLesson = coreCurriculumUnits[0].lessons[0]
    const progress = Array.from({ length: 3 }).reduce(
      (state, _unused, index) =>
        completeLessonProgress(state, firstLesson.id, `2026-05-2${7 + index}T10:00:00.000Z`),
      createInitialProgress(),
    )
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress(progress))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /learn/i }))
    fireEvent.click(screen.getByRole('button', { name: /Learn unit 2 lesson 1: Hello & Thanks, 3 crowns/i }))

    expect(screen.getByText(/15s timed/i)).toBeInTheDocument()
    expect(screen.getByRole('timer', { name: /15 seconds remaining/i })).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    expect(screen.getByRole('status', { name: /Wrong answer feedback/i })).toBeInTheDocument()
    expect(screen.getByText(/Time's up/i)).toBeInTheDocument()
    expect(screen.getByText('❤️ -1')).toBeInTheDocument()
  })

  it('uses spec replay labels and hides Kannada text before checking listening answers', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('listening')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Play Again$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Slow$/i })).toBeInTheDocument()

    const listeningChoices = screen.getByLabelText(/Listening choices/i)
    expect(within(listeningChoices).queryByRole('button', { name: /ಟಿಕೆಟ್ ಎಷ್ಟು/i })).not.toBeInTheDocument()
    await user.click(within(listeningChoices).getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(within(listeningChoices).getByRole('button', { name: /ಟಿಕೆಟ್ ಎಷ್ಟು/i })).toBeInTheDocument()
  })

  it('shows speaking score level and problem syllables after recording', async () => {
    const user = userEvent.setup()
    vi.mocked(window.kannadaOS.transcribeRecordedAudio).mockResolvedValueOnce({
      ok: true,
      text: 'ನಮಸ್ಕಾರ',
    })
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('speaking')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    const speakingResult = await screen.findByLabelText(/Speaking score result/i)
    expect(within(speakingResult).getByText(/Score: \d+ \/ 100/i)).toBeInTheDocument()
    expect(within(speakingResult).getByText(/Level: Steady/i)).toBeInTheDocument()
    expect(within(speakingResult).getByText(/Problem: ಸಾರ್/i)).toBeInTheDocument()
  })

  it('requires a 70 pronunciation score before the speaking continue action unlocks', async () => {
    const user = userEvent.setup()
    vi.mocked(window.kannadaOS.transcribeRecordedAudio)
      .mockResolvedValueOnce({ ok: true, text: '' })
      .mockResolvedValueOnce({ ok: true, text: 'ನಮಸ್ಕಾರ ಸಾರ್' })
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    const failedResult = await screen.findByLabelText(/Speaking score result/i)
    expect(within(failedResult).getByText(/Score: 20 \/ 100/i)).toBeInTheDocument()
    expect(screen.getByText(/Minimum 70 to continue/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Continue/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Try Again/i }))
    expect(screen.queryByLabelText(/Speaking score result/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    expect(await screen.findByText(/Score: 100 \/ 100/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Continue/i }))
    expect(screen.getByText(/Correct/i)).toBeInTheDocument()
  })

  it('completes all six lesson exercise types and shows the completion screen', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    expect(screen.getByText('translate')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('arrange')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('fillBlank')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('listening')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Play Again$/i }))
    expect(screen.getByText(/Playing reference audio/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('speaking')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Listen first$/i }))
    expect(screen.getByText(/Playing reference audio/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /stop recording/i }))
    expect(await screen.findByText(/Score: 100 \/ 100/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Continue/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('matchPairs')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: 'Hello' }))
    await user.click(screen.getByRole('button', { name: /ಧನ್ಯವಾದ/i }))
    await user.click(screen.getByRole('button', { name: 'Thank you' }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗು/i }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await user.click(screen.getByRole('button', { name: /ಬಾ/i }))
    await user.click(screen.getByRole('button', { name: 'Come' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByRole('heading', { name: /Lesson Complete/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Confetti celebration/i)).toBeInTheDocument()
    expect(screen.getByText(/\+18 XP/i)).toBeInTheDocument()
    expect(screen.getByLabelText('6 Correct')).toBeInTheDocument()
    expect(screen.getByLabelText('★☆☆☆☆ Crown')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue Learning/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to Home/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Continue Learning/i }))
    expect(screen.getByRole('heading', { name: /Translate to Kannada/i })).toBeInTheDocument()
    expect(screen.getByText('How are you?')).toBeInTheDocument()
  }, 30_000)

  it('shows matched and wrong visual states in match-pair exercises', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))
    expect(await screen.findByText(/Score: 100 \/ 100/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Continue/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    const matchGrid = screen.getByLabelText(/Match pairs/i)
    const namaskaraButton = within(matchGrid).getByRole('button', { name: /ನಮಸ್ಕಾರ/i })
    const thankYouButton = within(matchGrid).getByRole('button', { name: /^Thank you$/i })

    await user.click(namaskaraButton)
    await user.click(thankYouButton)

    expect(namaskaraButton).toHaveClass('mismatch')
    expect(thankYouButton).toHaveClass('mismatch')

    await waitFor(() => expect(namaskaraButton).not.toHaveClass('mismatch'))
    await waitFor(() => expect(thankYouButton).not.toHaveClass('mismatch'))

    await user.click(namaskaraButton)
    const helloButton = within(matchGrid).getByRole('button', { name: /^Hello$/i })
    await user.click(helloButton)

    expect(namaskaraButton).toHaveClass('matched')
    expect(helloButton).toHaveClass('matched')
    expect(namaskaraButton).toHaveTextContent('✅')
    expect(helloButton).toHaveTextContent('✅')
    expect(namaskaraButton).toBeDisabled()
    expect(helloButton).toBeDisabled()
  }, 30_000)

  it('shows lesson completion accuracy from actual correct and wrong attempts', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    await user.click(screen.getByRole('button', { name: 'Goodbye sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByRole('button', { name: /question will return/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /question will return/i }))

    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('translate')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ticket eshtu/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))
    expect(await screen.findByText(/Score: 100 \/ 100/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Continue/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: 'Hello' }))
    await user.click(screen.getByRole('button', { name: /ಧನ್ಯವಾದ/i }))
    await user.click(screen.getByRole('button', { name: 'Thank you' }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗು/i }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await user.click(screen.getByRole('button', { name: /ಬಾ/i }))
    await user.click(screen.getByRole('button', { name: 'Come' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByRole('heading', { name: /Lesson Complete/i })).toBeInTheDocument()
    expect(screen.getByLabelText('86 Accuracy')).toBeInTheDocument()
    expect(screen.getByLabelText('6 Correct')).toBeInTheDocument()
    expect(screen.getByLabelText('1 Wrong')).toBeInTheDocument()
  }, 30_000)

  it('uses the offline tutor fallback in chat when Ollama is unavailable', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /chat/i }))
    await user.type(screen.getByPlaceholderText(/type in kannada/i), 'Majestic hogbeku')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText(/Add -ge for "to" before the destination/i)).toBeInTheDocument()
    expect(screen.getByText(/Kannada: ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು/i)).toBeInTheDocument()
    expect(screen.getAllByText(/English: I need to go to Majestic/i).length).toBeGreaterThanOrEqual(1)
    expect(localStorage.getItem('kannadaos:progress')).toContain('"chatMessagesSent":1')
  })

  it('persists Bangalore checklist progress from scenario checkboxes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /blr/i }))
    await user.click(screen.getByRole('button', { name: /start bmtc bus/i }))
    await user.click(screen.getByRole('checkbox', { name: /Ask the fare/i }))

    expect(screen.getByRole('checkbox', { name: /Ask the fare/i })).toBeChecked()
    expect(localStorage.getItem('kannadaos:progress')).toContain('"bmtc-bus":["Ask the fare"]')
  })

  it('awards 10 XP once when a Bangalore scenario checklist is completed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /blr/i }))
    await user.click(screen.getByRole('button', { name: /start auto ride/i }))

    for (const item of ['Say destination', 'Ask fare', 'Confirm meter', 'Ask to stop']) {
      await user.click(screen.getByRole('checkbox', { name: item }))
    }

    expect(screen.getByRole('status')).toHaveTextContent(/Scenario checklist complete: \+10 XP earned/i)
    await waitFor(() => {
      const savedProgress = JSON.parse(localStorage.getItem('kannadaos:progress') ?? '{}')
      expect(savedProgress.xp).toBe(10)
      expect(savedProgress.dailyXp).toBe(10)
      expect(savedProgress.completedExerciseIds).toContain('scenario-auto-ride-checklist')
    })

    await user.click(screen.getByRole('checkbox', { name: /Ask to stop/i }))
    await user.click(screen.getByRole('checkbox', { name: /Ask to stop/i }))

    await waitFor(() => {
      const savedProgress = JSON.parse(localStorage.getItem('kannadaos:progress') ?? '{}')
      expect(savedProgress.xp).toBe(10)
      expect(savedProgress.dailyXp).toBe(10)
      expect(savedProgress.completedExerciseIds.filter((id: string) => id === 'scenario-auto-ride-checklist')).toHaveLength(1)
    })
  })

  it('persists chat history across app reloads', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: /chat/i }))
    await user.type(screen.getByPlaceholderText(/type in kannada/i), 'Majestic hogbeku')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect((await screen.findAllByText(/Majestic-ge hogbeku/i)).length).toBeGreaterThanOrEqual(1)

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /chat/i }))

    expect(screen.getByText('Majestic hogbeku')).toBeInTheDocument()
    expect(screen.getAllByText(/Majestic-ge hogbeku/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows contextual quick replies and restores chat logs when switching scenarios', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /chat/i }))

    const scenarioPicker = screen.getByLabelText(/Chat scenarios/i)
    let quickReplies = screen.getByRole('group', { name: /Quick replies/i })
    expect(within(quickReplies).getAllByRole('button')).toHaveLength(4)
    expect(within(quickReplies).getByRole('button', { name: /English: I need to go to Majestic/i })).toBeInTheDocument()
    expect(within(quickReplies).getByRole('button', { name: /English: Stop here/i })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/type in kannada/i), 'Majestic hogbeku')
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText(/Add -ge for "to" before the destination/i)).toBeInTheDocument()

    await user.click(within(scenarioPicker).getByRole('button', { name: /BMTC Bus/i }))
    expect(screen.queryByText('Majestic hogbeku')).not.toBeInTheDocument()
    quickReplies = screen.getByRole('group', { name: /Quick replies/i })
    expect(within(quickReplies).getAllByRole('button')).toHaveLength(4)
    expect(within(quickReplies).getByRole('button', { name: /English: How much is the ticket/i })).toBeInTheDocument()
    expect(within(quickReplies).getByRole('button', { name: /English: Please speak slowly/i })).toBeInTheDocument()

    await user.click(within(scenarioPicker).getByRole('button', { name: /Auto Ride/i }))
    expect(screen.getByText('Majestic hogbeku')).toBeInTheDocument()
    expect(screen.getByText(/Kannada: ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು/i)).toBeInTheDocument()
  })

  it('restores desktop learner data before syncing it back to the Electron store', async () => {
    const user = userEvent.setup()
    const loadLearnerData = vi.fn().mockResolvedValue({
      schemaVersion: 1,
      appName: 'KannadaOS',
      savedAt: '2026-05-23T18:30:00.000Z',
      values: {
        'kannadaos:onboarded': 'true',
        'kannadaos:progress': JSON.stringify({
          xp: 42,
          dailyXp: 10,
          hearts: 4,
          gems: 88,
          streakDays: 5,
          lastPracticeDate: '2026-05-23',
          completedExerciseIds: ['survival-translate-1'],
          weakAreas: {},
          reviewQueue: {},
        }),
        'kannadaos:reminder': JSON.stringify({ enabled: true, time: '8:30 PM', permission: 'granted' }),
      },
    })
    const saveLearnerData = vi.fn().mockResolvedValue({ ok: true })

    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      loadLearnerData,
      saveLearnerData,
    })

    render(<App />)

    await screen.findByRole('heading', { name: /KannadaOS/i })
    await user.click(screen.getByRole('button', { name: /^Me$/i }))

    expect(screen.getByLabelText('42 XP')).toBeInTheDocument()
    expect(screen.getByText(/Reminder On - 8:30 PM/i)).toBeInTheDocument()
    await screen.findByText(/Desktop data synced/i)

    expect(loadLearnerData).toHaveBeenCalledTimes(1)
    expect(saveLearnerData).toHaveBeenCalled()
    expect(saveLearnerData.mock.calls[0][0]['kannadaos:progress']).toContain('"xp":42')
  })

  it('switches chat scenarios, tutor persona, and voice input', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /chat/i }))

    await user.click(screen.getByRole('button', { name: /BMTC Bus/i }))

    expect(screen.getByRole('heading', { name: /BMTC Bus/i })).toBeInTheDocument()
    expect(screen.getByText(/ಟಿಕೆಟ್! ಟಿಕೆಟ್!/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Grammar Teacher/i }))
    await user.click(screen.getByRole('button', { name: /ಟಿಕೆಟ್ ಎಷ್ಟು/i }))
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByText(/Grammar Teacher: Good fare question/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ಟಿಕೆಟ್ ಎಷ್ಟು/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Put the destination first/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /record voice/i }))
    expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    expect(await screen.findByText(/Voice transcript ready: ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()
    expect(screen.getAllByText(/namaskara saar = Hello sir/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('ನಮಸ್ಕಾರ ಸಾರ್')).toBeInTheDocument()
  }, 30_000)

  it('shows English subtitles for Kannada inside tutor chat messages', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /chat/i }))
    await user.type(screen.getByPlaceholderText(/type in kannada/i), 'beda')
    await user.click(screen.getByRole('button', { name: /send/i }))

    const reply = screen.getByText(/Good\. ಬೇಡ is a clear way/i).closest('article')
    expect(reply).not.toBeNull()
    expect(within(reply!).getAllByText(/Say: beda/i).length).toBeGreaterThanOrEqual(1)
    expect(within(reply!).getAllByText('English: do not want').length).toBeGreaterThanOrEqual(1)
  })

  it('renders practice flashcards, Bangalore scenarios, and profile stats', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /practice/i }))
    const flashcard = screen.getByRole('button', { name: /^English: need to go\s+ಹೋಗಬೇಕು\s+Say: hogbeku/i })
    expect(within(flashcard).getByText(/Context: Core travel word for autos, buses, and directions/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Play Audio$/i }))
    expect(screen.getByText(/Playing flashcard audio: hogbeku/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^English: need to go\s+ಹೋಗಬೇಕು\s+Say: hogbeku/i }))
    expect(within(flashcard).getByText(/^need to go$/i)).toBeInTheDocument()
    expect(screen.getByText(/Skill: Verbs/i)).toBeInTheDocument()
    expect(screen.getByText(/Leitner Box: 1/i)).toBeInTheDocument()
    expect(screen.getByText(/Next review: Not scheduled/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Strength 20%/i).length).toBeGreaterThanOrEqual(1)
    await user.click(screen.getByRole('button', { name: /^Easy$/i }))
    expect(screen.getByText(/Strength 40%/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /blr/i }))
    expect(screen.getByText(/Slang of the Day/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /BMTC Bus beginner scenario icon/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Auto Ride/i).length).toBeGreaterThanOrEqual(1)
    await user.click(screen.getByRole('button', { name: /start bmtc bus/i }))
    expect(screen.getByText(/Ask the fare/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ticket eshtu/i).length).toBeGreaterThanOrEqual(1)
    await user.click(screen.getByRole('button', { name: /back/i }))
    await user.click(screen.getByRole('button', { name: /open auto ride in chat/i }))
    expect(screen.getByRole('heading', { name: /Auto Ride/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^English: I need to go to Majestic/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Me$/i }))
    const stats = screen.getByTestId('profile-stats')
    expect(within(stats).getByText(/XP/i)).toBeInTheDocument()
    expect(screen.getByText(/Level 4 Learner/i)).toBeInTheDocument()
  })

  it('generates an AI practice exercise from the Practice tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /practice/i }))

    const aiPracticeCard = screen.getByLabelText(/AI practice exercise/i)
    expect(within(aiPracticeCard).getByText(/Targets your weakest skill/i)).toBeInTheDocument()

    await user.click(within(aiPracticeCard).getByRole('button', { name: /Generate Practice Exercise/i }))

    expect(await within(aiPracticeCard).findByText(/Offline: Fill in the blank:/i)).toBeInTheDocument()
    expect(within(aiPracticeCard).getByText(/1 saved drill for curriculum review/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(localStorage.getItem('kannadaos:ai-expansion')).toContain('Fill in the blank:')
    })
  })

  it('opens Bangalore scenario details with phrase controls and dialogue practice', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /blr/i }))
    await user.click(screen.getByRole('button', { name: /start auto ride/i }))

    expect(screen.getByRole('heading', { name: /Auto Ride/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Auto Ride beginner scenario icon/i })).toBeInTheDocument()
    expect(screen.getByText(/Situation: You are negotiating an auto from Indiranagar to Majestic/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Confirm meter/i })).toBeInTheDocument()
    expect(screen.queryByText(/Driver: ಸಾರ್, ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Driver says/i)).toBeInTheDocument()
    expect(screen.getByText('English: Sir, where do you need to go?')).toBeInTheDocument()
    expect(screen.getAllByText('English: I need to go to Majestic').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('radio', { name: /^English: I need to go to Majestic/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /play majestic-ge hogbeku/i }))
    expect(screen.getByText(/Playing scenario audio: Majestic-ge hogbeku/i)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /I need to go to Majestic/i }))
    await user.click(screen.getByRole('button', { name: /check dialogue/i }))
    expect(screen.getByText(/Good reply for Auto Ride/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /practice majestic-ge hogbeku/i }))
    expect(screen.getByRole('heading', { name: /Practice/i })).toBeInTheDocument()
    expect(screen.getByText(/Pronunciation Lab/i)).toBeInTheDocument()
  })

  it('shows unlocked achievements and learner-owned stats in profile', async () => {
    const user = userEvent.setup()
    const scriptLessonProgress = Object.fromEntries(
      getScriptCurriculumUnit().lessons.map((lesson) => [
        lesson.id,
        {
          lessonId: lesson.id,
          masteryLevel: 1,
          attempts: 1,
          perfectCompletions: 0,
          lastCompletedAt: '2026-05-23T10:00:00.000Z',
        },
      ]),
    )
    const masteredUnitProgress = Object.fromEntries(
      coreCurriculumUnits[0].lessons.map((lesson, index) => [
        lesson.id,
        {
          lessonId: lesson.id,
          masteryLevel: 5,
          attempts: 5,
          perfectCompletions: index === 0 ? 1 : 0,
          lastCompletedAt: '2026-05-23T10:00:00.000Z',
        },
      ]),
    )
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem(
      'kannadaos:progress',
      JSON.stringify({
        xp: 92,
        dailyXp: 10,
        hearts: 4,
        gems: 132,
        streakDays: 30,
        lastPracticeDate: '2026-05-23',
        completedExerciseIds: [
          'survival-translate-1',
          'survival-arrange-1',
          'survival-fill-1',
          'survival-listening-1',
          'survival-speaking-1',
          'survival-match-1',
          'story-first-day-bangalore',
        ],
        weakAreas: {},
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
        chatMessagesSent: 100,
        totalPracticeTimeMs: ((4 * 60) + 23) * 60 * 1000,
      }),
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Me$/i }))

    const stats = screen.getByTestId('profile-stats')
    expect(within(stats).getByLabelText('92 XP')).toBeInTheDocument()
    expect(within(stats).getByLabelText('1 Words')).toBeInTheDocument()
    expect(within(stats).getByLabelText('30 Streak')).toBeInTheDocument()
    expect(within(stats).getByLabelText('14 Lessons')).toBeInTheDocument()
    expect(within(stats).getByLabelText('1 Stories')).toBeInTheDocument()
    expect(within(stats).getByLabelText('4h 23m Time')).toBeInTheDocument()
    const achievements = screen.getByLabelText('Achievements')
    expect(within(achievements).getByText('Getting Started')).toBeInTheDocument()
    expect(within(achievements).getByText(/6\/6 lesson exercises/i)).toBeInTheDocument()
    expect(within(achievements).getByText('One Week')).toBeInTheDocument()
    expect(within(achievements).getByText(/7\/7 streak days/i)).toBeInTheDocument()
    expect(within(achievements).getByText('Review Pro')).toBeInTheDocument()
    expect(within(achievements).getByText(/1 practiced word/i)).toBeInTheDocument()
    expect(within(achievements).getByText('Script Reader')).toBeInTheDocument()
    expect(within(achievements).getByText(/9\/9 script lessons/i)).toBeInTheDocument()
    expect(within(achievements).getByText('Bangalore Pro')).toBeInTheDocument()
    expect(within(achievements).getByText(/6\/6 scenarios/i)).toBeInTheDocument()
    expect(within(achievements).getByText('Chat Master')).toBeInTheDocument()
    expect(within(achievements).getByText(/100\/100 messages/i)).toBeInTheDocument()
    expect(within(achievements).getByText('30 Day Streak')).toBeInTheDocument()
    expect(within(achievements).getByText(/30\/30 streak days/i)).toBeInTheDocument()
    expect(within(achievements).getByText('Unit Champion')).toBeInTheDocument()
    expect(within(achievements).getByText(/1 unit mastered/i)).toBeInTheDocument()
    expect(within(achievements).getByText('Perfect Lesson')).toBeInTheDocument()
    expect(within(achievements).getByText(/1 perfect lesson/i)).toBeInTheDocument()
  })

  it('resets learner progress without removing AI provider settings', async () => {
    const user = userEvent.setup()
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true)
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem(
      'kannadaos:progress',
      JSON.stringify({
        xp: 92,
        dailyXp: 10,
        hearts: 4,
        gems: 132,
        streakDays: 7,
        lastPracticeDate: '2026-05-23',
        completedExerciseIds: ['survival-translate-1', 'survival-speaking-1'],
        weakAreas: { verbs: 2 },
        reviewQueue: {
          hogbeku: {
            vocabularyId: 'hogbeku',
            dueAt: '2026-05-25T09:00:00.000Z',
            strength: 0.85,
            attempts: 3,
          },
        },
      }),
    )
    localStorage.setItem(
      'kannadaos:pronunciation-history',
      JSON.stringify([
        {
          id: 'attempt-1',
          phraseId: 'namaskara-saar',
          phrase: 'ನಮಸ್ಕಾರ ಸಾರ್',
          transcript: 'ನಮಸ್ಕಾರ ಸಾರ್',
          score: 98,
          level: 'clear',
          feedback: 'Clear',
          tip: 'Keep it',
          problemParts: [],
          createdAt: '2026-05-23T15:45:00.000Z',
        },
      ]),
    )
    localStorage.setItem('kannadaos:conversation-log', JSON.stringify({ 'auto-ride': [] }))
    localStorage.setItem(
      'kannadaos:ai-provider',
      JSON.stringify({
        activeProvider: 'openrouter',
        openRouterApiKey: 'sk-or-test',
        openRouterModel: 'openai/gpt-4o-mini',
        openRouterBaseUrl: 'https://openrouter.ai/api/v1',
        nvidiaApiKey: '',
        nvidiaModel: 'sarvamai/sarvam-m',
        nvidiaBaseUrl: 'https://integrate.api.nvidia.com/v1',
      }),
    )

    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Me$/i }))
    await user.click(screen.getByRole('button', { name: /reset all progress/i }))

    const stats = screen.getByTestId('profile-stats')
    expect(within(stats).getByLabelText('0 XP')).toBeInTheDocument()
    expect(within(stats).getByLabelText('0 Words')).toBeInTheDocument()
    expect(within(stats).getByLabelText('0 Streak')).toBeInTheDocument()
    expect(within(stats).getByLabelText('0 Lessons')).toBeInTheDocument()
    expect(within(stats).getByLabelText('0 Stories')).toBeInTheDocument()
    expect(within(stats).getByLabelText('0m Time')).toBeInTheDocument()
    expect(screen.getByText(/Progress reset. Your AI model paths and hosted AI keys were kept./i)).toBeInTheDocument()
    expect(localStorage.getItem('kannadaos:pronunciation-history')).toBe('[]')
    expect(localStorage.getItem('kannadaos:conversation-log')).toBe('{}')
    expect(localStorage.getItem('kannadaos:ai-provider')).toContain('sk-or-test')
    expect(confirmMock).toHaveBeenCalledWith(
      expect.stringContaining('Reset all lesson progress, pronunciation attempts, and chat history?'),
    )
  })

  it('configures and persists daily reminder notifications', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: /^Me$/i }))

    expect(screen.getByRole('heading', { name: /Daily Reminder/i })).toBeInTheDocument()
    expect(screen.getByText(/Reminder Off/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /enable daily reminder/i }))
    await user.click(screen.getByRole('button', { name: /8:30 PM/i }))
    await user.click(screen.getByRole('button', { name: /allow reminder alerts/i }))

    expect(screen.getByText(/Reminder On - 8:30 PM/i)).toBeInTheDocument()
    expect(screen.getByText(/Alerts allowed/i)).toBeInTheDocument()

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Me$/i }))

    expect(screen.getByText(/Reminder On - 8:30 PM/i)).toBeInTheDocument()
    expect(screen.getByText(/Alerts allowed/i)).toBeInTheDocument()
  })

  it('exports a learner data snapshot from profile settings', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem(
      'kannadaos:progress',
      JSON.stringify({
        xp: 42,
        completedExerciseIds: ['survival-translate-1', 'story-first-day-bangalore'],
        reviewQueue: {
          hogbeku: {
            vocabularyId: 'hogbeku',
            dueAt: '2026-05-25T09:00:00.000Z',
            strength: 0.7,
            attempts: 3,
          },
        },
      }),
    )
    localStorage.setItem(
      'kannadaos:pronunciation-history',
      JSON.stringify([{ id: 'attempt-1', phraseId: 'namaskara-saar', phrase: 'ನಮಸ್ಕಾರ ಸಾರ್', transcript: 'ನಮಸ್ಕಾರ ಸಾರ್', score: 98, level: 'clear', feedback: 'Clear', tip: 'Keep it', problemParts: [], createdAt: '2026-05-23T15:45:00.000Z' }]),
    )
    localStorage.setItem(
      'kannadaos:local-runtime',
      JSON.stringify({ llmModelPath: '/models/aya.gguf', whisperModelPath: '', piperVoicePath: '/models/voice.onnx' }),
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Me$/i }))
    await user.click(screen.getByRole('button', { name: /export data/i }))

    expect(screen.getByText(/Export ready: 2 activities, 1 practiced word, 1 pronunciation attempt/i)).toBeInTheDocument()
    expect(screen.getByText(/2 runtime paths configured/i)).toBeInTheDocument()

    const preview = screen.getByTestId('export-preview')
    expect(preview).toHaveTextContent('"schemaVersion": 1')
    expect(preview).toHaveTextContent('"appName": "KannadaOS"')
    expect(preview).toHaveTextContent('"score": 98')
  })

  it('adapts practice to weak areas and due review after a wrong lesson answer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Goodbye sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByRole('button', { name: /question will return/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close lesson/i }))
    await user.click(screen.getByRole('button', { name: /practice/i }))

    expect(screen.getByText(/1 word due today/i)).toBeInTheDocument()
    expect(screen.getByText(/Adaptive difficulty: Gentle/i)).toBeInTheDocument()
    expect(screen.getByText(/Greetings needs review/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ನಮಸ್ಕಾರ ಸಾರ್/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/Strength 20%/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows English-readable subtitles in due review summaries', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress({
      ...createInitialProgress(),
      reviewQueue: {
        hogbeku: {
          vocabularyId: 'hogbeku',
          dueAt: '2026-05-20T09:00:00.000Z',
          strength: 0.2,
          attempts: 1,
          leitnerBox: 1,
        },
      },
    }))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice/i }))

    const dueReviewCard = screen.getByText(/Due Review Queue/i).closest('article')
    expect(dueReviewCard).not.toBeNull()
    expect(within(dueReviewCard as HTMLElement).getByText(/ಹೋಗಬೇಕು - hogbeku - need to go - Strength 20%/i)).toBeInTheDocument()
  })

  it('runs due review items as a heart-safe mini session', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress({
      ...createInitialProgress(),
      hearts: 1,
      reviewQueue: {
        hogbeku: {
          vocabularyId: 'hogbeku',
          dueAt: '2026-05-20T09:00:00.000Z',
          strength: 0.2,
          attempts: 1,
          leitnerBox: 1,
        },
        dhanyavada: {
          vocabularyId: 'dhanyavada',
          dueAt: '2099-05-20T09:00:00.000Z',
          strength: 0.6,
          attempts: 2,
          leitnerBox: 3,
        },
      },
    }))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice/i }))
    expect(screen.getByText(/1 word due today/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Start Review/i }))

    const reviewSession = screen.getByRole('region', { name: /Review Session/i })
    expect(within(reviewSession).getByText(/1 of 1/i)).toBeInTheDocument()
    expect(within(reviewSession).getByText(/ಹೋಗಬೇಕು/i)).toBeInTheDocument()
    const reviewCard = reviewSession.querySelector('.review-card')
    expect(reviewCard).not.toBeNull()
    expect(within(reviewCard as HTMLElement).getByText(/need to go/i)).toBeInTheDocument()

    await user.click(within(reviewSession).getByRole('button', { name: /need to go/i }))
    await user.click(within(reviewSession).getByRole('button', { name: /Check Review/i }))

    expect(within(reviewSession).getByText(/Correct/i)).toBeInTheDocument()
    expect(within(reviewSession).getByText(/\+1 XP/i)).toBeInTheDocument()
    await user.click(within(reviewSession).getByRole('button', { name: /Finish Review/i }))

    expect(screen.getByRole('heading', { name: /Review Complete/i })).toBeInTheDocument()
    expect(screen.getByText(/\+1 XP/i)).toBeInTheDocument()

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('kannadaos:progress') ?? '{}')
      expect(stored.xp).toBe(1)
      expect(stored.dailyXp).toBe(1)
      expect(stored.hearts).toBe(1)
      expect(stored.reviewQueue.hogbeku.attempts).toBe(2)
      expect(stored.reviewQueue.hogbeku.leitnerBox).toBeGreaterThan(1)
    })
  })

  it('restores one heart after three correct review practice answers', async () => {
    const user = userEvent.setup()
    const lastHeartLostAt = new Date().toISOString()
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem('kannadaos:progress', serializeProgress({
      ...createInitialProgress(),
      hearts: 1,
      lastHeartLostAt,
      reviewQueue: {
        hogbeku: {
          vocabularyId: 'hogbeku',
          dueAt: '2026-05-20T09:00:00.000Z',
          strength: 0.2,
          attempts: 1,
          leitnerBox: 1,
        },
        dhanyavada: {
          vocabularyId: 'dhanyavada',
          dueAt: '2026-05-20T09:00:00.000Z',
          strength: 0.2,
          attempts: 1,
          leitnerBox: 1,
        },
        'namaskara-saar': {
          vocabularyId: 'namaskara-saar',
          dueAt: '2026-05-20T09:00:00.000Z',
          strength: 0.2,
          attempts: 1,
          leitnerBox: 1,
        },
      },
    }))

    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.click(screen.getByRole('button', { name: /Start Review/i }))

    let reviewSession = screen.getByRole('region', { name: /Review Session/i })
    expect(within(reviewSession).getByText(/Choose the meaning/i)).toBeInTheDocument()
    await user.click(within(reviewSession).getByRole('button', { name: /Thank you/i }))
    await user.click(within(reviewSession).getByRole('button', { name: /Check Review/i }))
    expect(within(reviewSession).getByText(/Correct/i)).toBeInTheDocument()
    await user.click(within(reviewSession).getByRole('button', { name: /Next Review/i }))

    reviewSession = screen.getByRole('region', { name: /Review Session/i })
    expect(within(reviewSession).getByText(/Complete the Kannada phrase/i)).toBeInTheDocument()
    await user.click(within(reviewSession).getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(within(reviewSession).getByRole('button', { name: /Check Review/i }))
    expect(within(reviewSession).getByText(/Correct/i)).toBeInTheDocument()
    await user.click(within(reviewSession).getByRole('button', { name: /Next Review/i }))

    reviewSession = screen.getByRole('region', { name: /Review Session/i })
    expect(within(reviewSession).getByText(/Type the Kannada for "Hello sir"/i)).toBeInTheDocument()
    await user.type(within(reviewSession).getByLabelText(/Review Kannada typing answer/i), 'namaskara saar')
    expect(within(reviewSession).getByText(/ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()
    await user.click(within(reviewSession).getByRole('button', { name: /Check Review/i }))
    expect(within(reviewSession).getByText(/Correct/i)).toBeInTheDocument()
    await user.click(within(reviewSession).getByRole('button', { name: /Finish Review/i }))

    expect(screen.getByRole('heading', { name: /Review Complete/i })).toBeInTheDocument()

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('kannadaos:progress') ?? '{}')
      expect(stored.xp).toBe(3)
      expect(stored.dailyXp).toBe(3)
      expect(stored.hearts).toBe(2)
      expect(stored.lastHeartLostAt).toBe(lastHeartLostAt)
      expect(stored.todayActivityIds).toEqual(['review-dhanyavada', 'review-hogbeku', 'review-namaskara-saar'])
    })
  })

  it('scores pronunciation practice and persists the latest attempt', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: /practice/i }))

    expect(screen.getByRole('heading', { name: /Pronunciation Lab/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /play reference/i }))
    expect(screen.getByText(/Reference audio: namaskara saar/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Transcribed speech/i), 'ನಮಸ್ಕಾರ ಸಾರ್')
    await user.click(screen.getByRole('button', { name: /score pronunciation/i }))

    const pronunciationResult = screen.getByLabelText(/Pronunciation result/i)
    expect(within(pronunciationResult).getByText(/Score 100/i)).toBeInTheDocument()
    expect(within(pronunciationResult).getByText(/Clear pronunciation/i)).toBeInTheDocument()
    expect(within(pronunciationResult).getByText(/No problem syllables/i)).toBeInTheDocument()
    expect(screen.getByText(/Latest attempt: ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /practice/i }))

    expect(screen.getByText(/Last score 100/i)).toBeInTheDocument()
    expect(screen.getByText(/Latest attempt: ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()
  })

  it('records pronunciation audio, transcribes it through Whisper, and scores the transcript', async () => {
    const user = userEvent.setup()
    const transcribeRecordedAudio = vi.fn().mockResolvedValue({ ok: true, text: 'ನಮಸ್ಕಾರ ಸಾರ್' })
    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      transcribeRecordedAudio,
    })
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem(
      'kannadaos:local-runtime',
      JSON.stringify({
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      }),
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.click(screen.getByRole('button', { name: /record pronunciation/i }))
    expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    expect(transcribeRecordedAudio).toHaveBeenCalledWith({
      runtimeConfig: {
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      audioBytes: [82, 73, 70, 70],
      source: 'pronunciation',
    })
    expect(await screen.findByText(/Voice transcript ready: ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()
    expect(screen.getByText(/namaskara saar = Hello sir/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('ನಮಸ್ಕಾರ ಸಾರ್')).toBeInTheDocument()
    expect(screen.getByLabelText(/Pronunciation result/i)).toHaveTextContent(/Score 100/i)
  })

  it('shows a clear error when recorded chat audio cannot be transcribed', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      transcribeRecordedAudio: vi.fn().mockResolvedValue({ ok: false, text: '', error: 'Whisper runtime is not ready.' }),
    })
    localStorage.setItem('kannadaos:onboarded', 'true')
    render(<App />)

    await user.click(screen.getByRole('button', { name: /chat/i }))
    await user.click(screen.getByRole('button', { name: /record voice/i }))
    await user.click(screen.getByRole('button', { name: /stop recording/i }))

    expect(await screen.findByText(/Whisper runtime is not ready/i)).toBeInTheDocument()
  })

  it('falls back to Web Speech for lesson reference audio when Piper is unavailable', async () => {
    const user = userEvent.setup()
    const speak = vi.fn()
    const kannadaVoice = { lang: 'kn-IN', name: 'Kannada Voice' }
    vi.stubGlobal('speechSynthesis', {
      getVoices: vi.fn(() => [kannadaVoice]),
      speak,
    })
    vi.stubGlobal('SpeechSynthesisUtterance', class MockSpeechSynthesisUtterance {
      lang = ''
      rate = 1
      voice: unknown = null

      constructor(public text: string) {}
    })
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":true,"autoPlayAudio":false}')
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: /listen/i }))

    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0][0]).toMatchObject({
      text: 'ನಮಸ್ಕಾರ ಸಾರ್',
      lang: 'kn-IN',
      rate: 1,
      voice: kannadaVoice,
    })
    expect(screen.getByText(/Playing Web Speech reference: namaskara saar/i)).toBeInTheDocument()
  })

  it('auto-plays lesson reference audio through Web Speech when Piper is unavailable', async () => {
    const user = userEvent.setup()
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', {
      getVoices: vi.fn(() => []),
      speak,
    })
    vi.stubGlobal('SpeechSynthesisUtterance', class MockSpeechSynthesisUtterance {
      lang = ''
      rate = 1
      voice: unknown = null

      constructor(public text: string) {}
    })
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":true,"autoPlayAudio":true}')
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1))
    expect(speak.mock.calls[0][0]).toMatchObject({
      text: 'ನಮಸ್ಕಾರ ಸಾರ್',
      lang: 'kn-IN',
      rate: 1,
    })
    expect(screen.getByText(/Auto Web Speech reference: namaskara saar/i)).toBeInTheDocument()
  })

  it('auto-plays lesson reference audio through Piper when the desktop bridge is configured', async () => {
    const user = userEvent.setup()
    const playReference = vi.fn().mockResolvedValue(undefined)
    const AudioMock = vi.fn(function mockAudio(this: { play: typeof playReference; playbackRate?: number }) {
      this.play = playReference
    })
    vi.stubGlobal('Audio', AudioMock)
    const synthesizeNativeSpeech = vi.fn().mockResolvedValue({
      ok: true,
      audioPath: '/tmp/auto-lesson.wav',
      audioUrl: 'file:///tmp/auto-lesson.wav',
    })
    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      synthesizeNativeSpeech,
    })
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":true,"autoPlayAudio":true}')
    localStorage.setItem(
      'kannadaos:local-runtime',
      JSON.stringify({
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      }),
    )
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))

    await waitFor(() => expect(synthesizeNativeSpeech).toHaveBeenCalledWith({
      runtimeConfig: {
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      text: 'ನಮಸ್ಕಾರ ಸಾರ್',
    }))
    await waitFor(() => expect(AudioMock).toHaveBeenCalledWith('file:///tmp/auto-lesson.wav'))
    expect(playReference).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Auto Piper audio playing: \/tmp\/auto-lesson.wav/i)).toBeInTheDocument()
  })

  it('uses 0.7x Web Speech rate for slow lesson audio fallback', async () => {
    const user = userEvent.setup()
    const speak = vi.fn()
    vi.stubGlobal('speechSynthesis', {
      getVoices: vi.fn(() => []),
      speak,
    })
    vi.stubGlobal('SpeechSynthesisUtterance', class MockSpeechSynthesisUtterance {
      lang = ''
      rate = 1
      voice: unknown = null

      constructor(public text: string) {}
    })
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":true,"autoPlayAudio":false}')
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /Continue: Hello & Thanks/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ನಮಸ್ಕಾರ/i }))
    await user.click(screen.getByRole('button', { name: /ಸಾರ್/i }))
    await user.click(screen.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    await user.click(screen.getByRole('button', { name: /^Slow$/i }))

    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak.mock.calls[0][0]).toMatchObject({
      text: 'ಟಿಕೆಟ್ ಎಷ್ಟು?',
      lang: 'kn-IN',
      rate: 0.7,
    })
    expect(screen.getByText(/Playing slow Web Speech reference at 0.7x: ticket eshtu/i)).toBeInTheDocument()
  }, 30_000)

  it('uses Web Speech fallback for flashcards, stories, and Bangalore scenario phrases', async () => {
    const user = userEvent.setup()
    const speak = stubKannadaWebSpeech()
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":true,"autoPlayAudio":false}')
    render(<App />)

    await completeOnboarding(user)

    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.click(screen.getByRole('button', { name: /^Play Audio$/i }))
    expect(speak.mock.calls.at(-1)?.[0]).toMatchObject({
      text: 'ಹೋಗಬೇಕು',
      lang: 'kn-IN',
      rate: 1,
    })
    expect(screen.getByText(/Playing Web Speech flashcard audio: hogbeku/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /stories/i }))
    await user.click(screen.getByRole('button', { name: /read first day in bangalore/i }))
    await user.click(screen.getByRole('button', { name: /play sentence audio/i }))
    expect(speak.mock.calls.at(-1)?.[0]).toMatchObject({
      text: 'ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ.',
      lang: 'kn-IN',
      rate: 1,
    })
    expect(screen.getByText(/Playing Web Speech story audio: raahul bengalurige banda/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /blr/i }))
    await user.click(screen.getByRole('button', { name: /start auto ride/i }))
    await user.click(screen.getByRole('button', { name: /play majestic-ge hogbeku/i }))
    expect(speak.mock.calls.at(-1)?.[0]).toMatchObject({
      text: 'ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು',
      lang: 'kn-IN',
      rate: 1,
    })
    expect(screen.getByText(/Playing Web Speech scenario audio: majestic-ge hogbeku/i)).toBeInTheDocument()
  }, 30_000)

  it('uses Web Speech fallback for pronunciation reference audio', async () => {
    const user = userEvent.setup()
    const speak = stubKannadaWebSpeech()
    localStorage.setItem('kannadaos:sound-prefs', '{"soundEffects":true,"autoPlayAudio":false}')
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.click(screen.getByRole('button', { name: /^Play Reference$/i }))

    expect(speak.mock.calls.at(-1)?.[0]).toMatchObject({
      text: 'ನಮಸ್ಕಾರ ಸಾರ್',
      lang: 'kn-IN',
      rate: 1,
    })
    expect(screen.getByText(/Playing Web Speech reference: namaskara saar/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Play Slow$/i }))
    expect(speak.mock.calls.at(-1)?.[0]).toMatchObject({
      text: 'ನಮಸ್ಕಾರ ಸಾರ್',
      lang: 'kn-IN',
      rate: 0.7,
    })
    expect(screen.getByText(/Playing slow Web Speech reference at 0.7x: namaskara saar/i)).toBeInTheDocument()
  }, 30_000)

  it('synthesizes pronunciation reference audio through the desktop Piper bridge', async () => {
    const user = userEvent.setup()
    const playReference = vi.fn().mockResolvedValue(undefined)
    const AudioMock = vi.fn(function mockAudio(this: { play: typeof playReference }) {
      this.play = playReference
    })
    vi.stubGlobal('Audio', AudioMock)
    const synthesizeNativeSpeech = vi.fn().mockResolvedValue({
      ok: true,
      audioPath: '/tmp/reference.wav',
      audioUrl: 'file:///tmp/reference.wav',
    })
    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      synthesizeNativeSpeech,
    })
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem(
      'kannadaos:local-runtime',
      JSON.stringify({
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      }),
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.click(screen.getByRole('button', { name: /play reference/i }))

    expect(synthesizeNativeSpeech).toHaveBeenCalledWith({
      runtimeConfig: {
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      text: 'ನಮಸ್ಕಾರ ಸಾರ್',
    })
    expect(AudioMock).toHaveBeenCalledWith('file:///tmp/reference.wav')
    expect(playReference).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Piper audio ready: \/tmp\/reference.wav/i)).toBeInTheDocument()
  })

  it('transcribes pronunciation audio through the desktop Whisper bridge', async () => {
    const user = userEvent.setup()
    const transcribeNativeAudio = vi.fn().mockResolvedValue({ ok: true, text: 'ನಮಸ್ಕಾರ ಸಾರ್' })
    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      transcribeNativeAudio,
    })
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem(
      'kannadaos:local-runtime',
      JSON.stringify({
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      }),
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.type(screen.getByLabelText(/Audio file path/i), '/tmp/namaskara.wav')
    await user.click(screen.getByRole('button', { name: /transcribe with whisper/i }))

    expect(transcribeNativeAudio).toHaveBeenCalledWith({
      runtimeConfig: {
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      audioPath: '/tmp/namaskara.wav',
    })
    expect(await screen.findByDisplayValue('ನಮಸ್ಕಾರ ಸಾರ್')).toBeInTheDocument()
    expect(screen.getByText(/Whisper transcript ready/i)).toBeInTheDocument()
  })

  it('opens model management from profile and shows required model setup states', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /^Me$/i }))
    await user.click(screen.getByRole('button', { name: /manage ai models/i }))

    expect(screen.getByRole('heading', { name: /Setting up your AI Teacher/i })).toBeInTheDocument()
    expect(screen.getByText(/Aya 8B Q4/i)).toBeInTheDocument()
    expect(screen.getByText(/4.8 GB/i)).toBeInTheDocument()
    expect(screen.getByText(/Whisper Small/i)).toBeInTheDocument()
    expect(screen.getByText(/466 MB/i)).toBeInTheDocument()
    expect(screen.getByText(/Piper Kannada Voice/i)).toBeInTheDocument()
    expect(screen.getByText(/75 MB/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start model setup/i }))

    expect(screen.getByRole('button', { name: /setup in progress/i })).toBeDisabled()
    expect(screen.getByText(/Language Model/i)).toBeInTheDocument()
    expect(screen.getByText(/78%/i)).toBeInTheDocument()
    expect(screen.getByText(/Downloaded/i)).toBeInTheDocument()
    expect(screen.getByText(/Waiting/i)).toBeInTheDocument()
    expect(screen.getByText(/You can start learning while models download/i)).toBeInTheDocument()
  })

  it('lets the learner choose OpenRouter and uses it for generated exercises', async () => {
    const user = userEvent.setup()
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'http://localhost:11434/api/tags') {
        return { ok: false }
      }

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: 'translate',
                  prompt: 'Hosted greeting drill',
                  kannada: 'ನಮಸ್ಕಾರ ಸಾರ್',
                  answer: 'Hello sir',
                  options: ['Hello sir', 'Goodbye sir'],
                }),
              },
            },
          ],
        }),
      }
    }) as unknown as typeof fetch

    vi.stubGlobal('fetch', fetchImpl)
    localStorage.setItem('kannadaos:onboarded', 'true')
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: /^Me$/i }))
    await user.click(screen.getByRole('button', { name: /manage ai models/i }))
    await user.selectOptions(screen.getByLabelText(/active ai provider/i), 'openrouter')
    await user.type(screen.getByLabelText(/OpenRouter API key/i), 'sk-or-test')
    await user.clear(screen.getByLabelText(/OpenRouter model/i))
    await user.type(screen.getByLabelText(/OpenRouter model/i), 'openai/gpt-4o-mini')
    await user.click(screen.getByLabelText(/Back to app/i))
    await user.click(screen.getByRole('button', { name: /generate ai exercise/i }))

    expect(await screen.findByText(/OpenRouter: Hosted greeting drill ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-or-test' }),
      }),
    )

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Me$/i }))
    await user.click(screen.getByRole('button', { name: /manage ai models/i }))

    expect(screen.getByLabelText(/active ai provider/i)).toHaveValue('openrouter')
    expect(screen.getByLabelText(/OpenRouter model/i)).toHaveValue('openai/gpt-4o-mini')
  }, 30_000)

  it('uses the selected NVIDIA hosted model for tutor chat replies', async () => {
    const user = userEvent.setup()
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'http://localhost:11434/api/tags') {
        return { ok: false }
      }

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'NVIDIA Tutor: ಹೇಳಿ, Majestic-ge hogbeku.' } }],
        }),
      }
    }) as unknown as typeof fetch

    vi.stubGlobal('fetch', fetchImpl)
    localStorage.setItem('kannadaos:onboarded', 'true')
    localStorage.setItem(
      'kannadaos:ai-provider',
      JSON.stringify({
        activeProvider: 'nvidia',
        nvidiaApiKey: 'nvapi-test',
        nvidiaModel: 'sarvamai/sarvam-m',
      }),
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /chat/i }))
    await user.type(screen.getByPlaceholderText(/type in kannada/i), 'Majestic hogbeku')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect((await screen.findAllByText(/NVIDIA Tutor: ಹೇಳಿ, Majestic-ge hogbeku/i)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/NVIDIA hosted/i).length).toBeGreaterThanOrEqual(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer nvapi-test' }),
      }),
    )
  })

  it('checks on-device runtime model paths through the desktop bridge', async () => {
    const user = userEvent.setup()
    const inspectLocalRuntime = vi.fn().mockResolvedValue({
      readyCount: 3,
      totalCount: 3,
      statusText: '3 of 3 runtime components ready',
      components: [
        {
          id: 'llm',
          label: 'Llama.cpp LLM',
          modelPath: '/models/aya-8b-q4_K_M.gguf',
          binaryPath: '/bin/llama-cli',
          ready: true,
          status: 'Ready',
          nextAction: 'Ready for offline native runtime.',
        },
        {
          id: 'stt',
          label: 'Whisper.cpp STT',
          modelPath: '/models/whisper-small.bin',
          binaryPath: '/bin/whisper-cli',
          ready: true,
          status: 'Ready',
          nextAction: 'Ready for offline native runtime.',
        },
        {
          id: 'tts',
          label: 'Piper TTS',
          modelPath: '/models/kn_IN-piper-medium.onnx',
          binaryPath: '/bin/piper',
          ready: true,
          status: 'Ready',
          nextAction: 'Ready for offline native runtime.',
        },
      ],
    })
    const smokeLocalRuntime = vi.fn().mockResolvedValue({
      passedCount: 3,
      totalCount: 3,
      statusText: '3 of 3 native commands responded',
      components: [
        { id: 'llm', label: 'Llama.cpp LLM', ok: true, status: 'Command responded', nextAction: 'Native command smoke passed.' },
        { id: 'stt', label: 'Whisper.cpp STT', ok: true, status: 'Command responded', nextAction: 'Native command smoke passed.' },
        { id: 'tts', label: 'Piper TTS', ok: true, status: 'Command responded', nextAction: 'Native command smoke passed.' },
      ],
    })
    const generateNativeExercise = vi.fn().mockResolvedValue({
      ok: true,
      response: JSON.stringify({
        type: 'translate',
        prompt: 'Native generated prompt',
        kannada: 'ಹೋಗಬೇಕು',
        answer: 'need to go',
        options: ['need to go'],
        explanation: 'From native llama.cpp.',
      }),
    })

    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      inspectLocalRuntime,
      smokeLocalRuntime,
      generateNativeExercise,
    })
    localStorage.setItem('kannadaos:onboarded', 'true')
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Me$/i }))
    await user.click(screen.getByRole('button', { name: /manage ai models/i }))

    expect(screen.getByRole('heading', { name: /On-device Runtime/i })).toBeInTheDocument()
    expect(screen.getByText(/0 of 3 runtime components ready/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Aya GGUF model path/i), '/models/aya-8b-q4_K_M.gguf')
    await user.type(screen.getByLabelText(/Llama.cpp executable path/i), '/bin/llama-cli')
    await user.type(screen.getByLabelText(/Whisper model path/i), '/models/whisper-small.bin')
    await user.type(screen.getByLabelText(/Whisper.cpp executable path/i), '/bin/whisper-cli')
    await user.type(screen.getByLabelText(/Piper voice path/i), '/models/kn_IN-piper-medium.onnx')
    await user.type(screen.getByLabelText(/Piper executable path/i), '/bin/piper')
    await user.click(screen.getByRole('button', { name: /check local runtime/i }))

    expect(inspectLocalRuntime).toHaveBeenCalledWith({
      llmModelPath: '/models/aya-8b-q4_K_M.gguf',
      whisperModelPath: '/models/whisper-small.bin',
      piperVoicePath: '/models/kn_IN-piper-medium.onnx',
      llamaBinaryPath: '/bin/llama-cli',
      whisperBinaryPath: '/bin/whisper-cli',
      piperBinaryPath: '/bin/piper',
    })
    expect(await screen.findByText(/3 of 3 runtime components ready/i)).toBeInTheDocument()
    expect(screen.getByText(/Llama.cpp LLM/i)).toBeInTheDocument()
    expect(screen.getByText(/Whisper.cpp STT/i)).toBeInTheDocument()
    expect(screen.getByText(/Piper TTS/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^Ready$/i)).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: /run runtime smoke/i }))

    expect(smokeLocalRuntime).toHaveBeenCalledWith({
      llmModelPath: '/models/aya-8b-q4_K_M.gguf',
      whisperModelPath: '/models/whisper-small.bin',
      piperVoicePath: '/models/kn_IN-piper-medium.onnx',
      llamaBinaryPath: '/bin/llama-cli',
      whisperBinaryPath: '/bin/whisper-cli',
      piperBinaryPath: '/bin/piper',
    })
    expect(await screen.findByText(/3 of 3 native commands responded/i)).toBeInTheDocument()

    await user.click(screen.getByLabelText(/Back to app/i))
    await user.click(screen.getByRole('button', { name: /generate ai exercise/i }))

    expect(generateNativeExercise).toHaveBeenCalled()
    expect(await screen.findByText(/Native: Native generated prompt ಹೋಗಬೇಕು/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/AI curriculum expansion/i)).toHaveTextContent(/1 saved drill/i)
    expect(localStorage.getItem('kannadaos:ai-expansion')).toContain('Native generated prompt')
  }, 30_000)

  it('opens story mode, shows interactive words, and completes the story quiz', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /stories/i }))

    expect(screen.getByRole('heading', { name: /Stories/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /First Day in Bangalore/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Illustration for First Day in Bangalore: Bus stop/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Illustration for Office Lunch: Tech park cafeteria/i })).toBeInTheDocument()
    expect(screen.getAllByText(/5 min read/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/12 new words/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Office Lunch/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Complete First Day in Bangalore first/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /read first day in bangalore/i }))

    expect(screen.getByRole('heading', { name: /First Day in Bangalore/i })).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByText(/ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ/i)).toBeInTheDocument()
    expect(screen.getByText(/raahul bengalurige banda/i)).toBeInTheDocument()
    expect(screen.getByText(/Rahul came to Bangalore/i)).toBeInTheDocument()
    expect(screen.queryByText(/ಅವನಿಗೆ ಕನ್ನಡ ಬರುತ್ತಿರಲಿಲ್ಲ/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /take quiz/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ಬಂದ/i }))

    const wordDialog = screen.getByRole('dialog', { name: /ಬಂದ/i })
    expect(wordDialog).toBeInTheDocument()
    expect(within(wordDialog).getByText(/banda/i)).toBeInTheDocument()
    expect(within(wordDialog).getAllByText(/came/i).length).toBeGreaterThanOrEqual(1)
    expect(within(wordDialog).getByRole('button', { name: /add to vocabulary/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(screen.getByText(/ಅವನಿಗೆ ಕನ್ನಡ ಬರುತ್ತಿರಲಿಲ್ಲ/i)).toBeInTheDocument()
    expect(screen.queryByText(/ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('3/3')).toBeInTheDocument()
    expect(screen.getByText(/ಬಸ್ ನಿಲ್ದಾಣದಲ್ಲಿ ಅವನು ಕೇಳಿದ/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /take quiz/i }))
    await user.click(screen.getByRole('button', { name: /He does not know Kannada yet/i }))
    await user.click(screen.getByRole('button', { name: /check story answer/i }))

    expect(screen.getByRole('heading', { name: /Story Complete/i })).toBeInTheDocument()
    expect(screen.getByText(/\+5 XP/i)).toBeInTheDocument()
    expect(screen.getByText(/Total: 5 XP/i)).toBeInTheDocument()
  })

  it('lets learners spend gems to unlock a locked story early', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /stories/i }))

    const officeLunchCard = screen.getByRole('heading', { name: /Office Lunch/i }).closest('article')
    expect(officeLunchCard).not.toBeNull()
    expect(within(officeLunchCard!).getByText(/Complete First Day in Bangalore first/i)).toBeInTheDocument()

    await user.click(within(officeLunchCard!).getByRole('button', { name: /Unlock Office Lunch early - 75 gems/i }))

    expect(within(officeLunchCard!).getByRole('button', { name: /Read Office Lunch/i })).toBeInTheDocument()
    await waitFor(() => {
      const savedProgress = JSON.parse(localStorage.getItem('kannadaos:progress') ?? '{}')
      expect(savedProgress.gems).toBe(45)
      expect(savedProgress.unlockedStoryIds).toContain('office-lunch')
      expect(savedProgress.completedStoryIds ?? []).not.toContain('office-lunch')
    })

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /stories/i }))
    const restoredOfficeLunchCard = screen.getByRole('heading', { name: /Office Lunch/i }).closest('article')
    expect(restoredOfficeLunchCard).not.toBeNull()
    expect(within(restoredOfficeLunchCard!).getByRole('button', { name: /Read Office Lunch/i })).toBeInTheDocument()
  })

  it('plays story sentence audio from the reader', async () => {
    const user = userEvent.setup()
    render(<App />)

    await completeOnboarding(user)
    await user.click(screen.getByRole('button', { name: /stories/i }))
    await user.click(screen.getByRole('button', { name: /read first day in bangalore/i }))

    await user.click(screen.getAllByRole('button', { name: /play sentence audio/i })[0])

    expect(screen.getByText(/Playing story audio: raahul bengalurige banda/i)).toBeInTheDocument()
  })
})
