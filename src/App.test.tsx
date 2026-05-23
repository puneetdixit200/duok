import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('KannadaOS desktop app', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('moves from onboarding to the home dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))

    expect(screen.getByRole('heading', { name: /KannadaOS/i })).toBeInTheDocument()
    expect(screen.getByText(/12 Day Streak/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue: Greetings/i })).toBeInTheDocument()
  })

  it('checks a lesson answer, awards XP, and shows feedback', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /Continue: Greetings/i }))
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByText(/Correct/i)).toBeInTheDocument()
    expect(screen.getByText(/\+2 XP/i)).toBeInTheDocument()
  })

  it('completes all six lesson exercise types and shows the completion screen', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /Continue: Greetings/i }))

    expect(screen.getByText('translate')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hello sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('arrange')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ನಮಸ್ಕಾರ' }))
    await user.click(screen.getByRole('button', { name: 'ಸಾರ್' }))
    await user.click(screen.getByRole('button', { name: 'ಹೇಗಿದ್ದೀರಾ' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('fillBlank')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ಹೋಗಬೇಕು' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('listening')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /play reference audio/i }))
    expect(screen.getByText(/Playing reference audio/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ಟಿಕೆಟ್ ಎಷ್ಟು?' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('speaking')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /record phrase/i }))
    expect(screen.getByText(/Score: 87%/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /next exercise/i }))

    expect(screen.getByText('matchPairs')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ನಮಸ್ಕಾರ' }))
    await user.click(screen.getByRole('button', { name: 'Hello' }))
    await user.click(screen.getByRole('button', { name: 'ಧನ್ಯವಾದ' }))
    await user.click(screen.getByRole('button', { name: 'Thank you' }))
    await user.click(screen.getByRole('button', { name: 'ಹೋಗು' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await user.click(screen.getByRole('button', { name: 'ಬಾ' }))
    await user.click(screen.getByRole('button', { name: 'Come' }))
    await user.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByRole('heading', { name: /Lesson Complete/i })).toBeInTheDocument()
    expect(screen.getByText(/\+18 XP/i)).toBeInTheDocument()
    expect(screen.getByLabelText('6 Correct')).toBeInTheDocument()
  })

  it('uses the offline tutor fallback in chat when Ollama is unavailable', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /chat/i }))
    await user.type(screen.getByPlaceholderText(/type in kannada/i), 'Majestic hogbeku')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText(/Majestic-ge hogbeku/i)).toBeInTheDocument()
  })

  it('persists chat history across app reloads', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: /chat/i }))
    await user.type(screen.getByPlaceholderText(/type in kannada/i), 'Majestic hogbeku')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByText(/Majestic-ge hogbeku/i)).toBeInTheDocument()

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /chat/i }))

    expect(screen.getByText('Majestic hogbeku')).toBeInTheDocument()
    expect(screen.getByText(/Majestic-ge hogbeku/i)).toBeInTheDocument()
  })

  it('switches chat scenarios, tutor persona, and voice input', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /chat/i }))

    await user.click(screen.getByRole('button', { name: /BMTC Bus/i }))

    expect(screen.getByRole('heading', { name: /BMTC Bus/i })).toBeInTheDocument()
    expect(screen.getByText(/ಟಿಕೆಟ್! ಟಿಕೆಟ್!/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Grammar Teacher/i }))
    await user.click(screen.getByRole('button', { name: /ಟಿಕೆಟ್ ಎಷ್ಟು/i }))
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByText(/Grammar Teacher: Good fare question/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ಟಿಕೆಟ್ ಎಷ್ಟು/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/add the destination first/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /record voice/i }))

    expect(screen.getByText(/Voice input transcribed: koramangala-ge ticket beku/i)).toBeInTheDocument()
  })

  it('renders practice flashcards, Bangalore scenarios, and profile stats', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /practice/i }))
    await user.click(screen.getByRole('button', { name: /ಹೋಗಬೇಕು/i }))
    expect(screen.getByText(/need to go/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /blr/i }))
    expect(screen.getByText(/Slang of the Day/i)).toBeInTheDocument()
    expect(screen.getByText(/Auto Ride/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /me/i }))
    const stats = screen.getByTestId('profile-stats')
    expect(within(stats).getByText(/XP/i)).toBeInTheDocument()
    expect(screen.getByText(/Level 4 Learner/i)).toBeInTheDocument()
  })

  it('shows unlocked achievements and learner-owned stats in profile', async () => {
    const user = userEvent.setup()
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
      }),
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: /me/i }))

    const stats = screen.getByTestId('profile-stats')
    expect(within(stats).getByLabelText('92 XP')).toBeInTheDocument()
    expect(within(stats).getByLabelText('1 Words')).toBeInTheDocument()
    expect(within(stats).getByLabelText('7 Streak')).toBeInTheDocument()
    expect(screen.getByText(/Getting Started/i)).toBeInTheDocument()
    expect(screen.getByText(/6\/6 lesson exercises/i)).toBeInTheDocument()
    expect(screen.getByText(/One Week/i)).toBeInTheDocument()
    expect(screen.getByText(/7\/7 streak days/i)).toBeInTheDocument()
    expect(screen.getByText(/Review Pro/i)).toBeInTheDocument()
    expect(screen.getByText(/1 practiced word/i)).toBeInTheDocument()
  })

  it('configures and persists daily reminder notifications', async () => {
    const user = userEvent.setup()
    localStorage.setItem('kannadaos:onboarded', 'true')
    const { unmount } = render(<App />)

    await user.click(screen.getByRole('button', { name: /me/i }))

    expect(screen.getByRole('heading', { name: /Daily Reminder/i })).toBeInTheDocument()
    expect(screen.getByText(/Reminder Off/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /enable daily reminder/i }))
    await user.click(screen.getByRole('button', { name: /8:30 PM/i }))
    await user.click(screen.getByRole('button', { name: /allow reminder alerts/i }))

    expect(screen.getByText(/Reminder On - 8:30 PM/i)).toBeInTheDocument()
    expect(screen.getByText(/Alerts allowed/i)).toBeInTheDocument()

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /me/i }))

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

    await user.click(screen.getByRole('button', { name: /me/i }))
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

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /Continue: Greetings/i }))
    await user.click(screen.getByRole('button', { name: 'Goodbye sir' }))
    await user.click(screen.getByRole('button', { name: /check/i }))
    await user.click(screen.getByRole('button', { name: /close lesson/i }))
    await user.click(screen.getByRole('button', { name: /practice/i }))

    expect(screen.getByText(/1 word due today/i)).toBeInTheDocument()
    expect(screen.getByText(/Adaptive difficulty: Gentle/i)).toBeInTheDocument()
    expect(screen.getByText(/Greetings needs review/i)).toBeInTheDocument()
    expect(screen.getAllByText(/ನಮಸ್ಕಾರ ಸಾರ್/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Strength 25%/i)).toBeInTheDocument()
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
    expect(within(pronunciationResult).getByText(/Score 98/i)).toBeInTheDocument()
    expect(within(pronunciationResult).getByText(/Clear pronunciation/i)).toBeInTheDocument()
    expect(within(pronunciationResult).getByText(/No problem syllables/i)).toBeInTheDocument()
    expect(screen.getByText(/Latest attempt: ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()

    unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /practice/i }))

    expect(screen.getByText(/Last score 98/i)).toBeInTheDocument()
    expect(screen.getByText(/Latest attempt: ನಮಸ್ಕಾರ ಸಾರ್/i)).toBeInTheDocument()
  })

  it('opens model management from profile and shows required model setup states', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /me/i }))
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
          ready: true,
          status: 'Ready',
          nextAction: 'Ready for offline native runtime.',
        },
        {
          id: 'stt',
          label: 'Whisper.cpp STT',
          modelPath: '/models/whisper-small.bin',
          ready: true,
          status: 'Ready',
          nextAction: 'Ready for offline native runtime.',
        },
        {
          id: 'tts',
          label: 'Piper TTS',
          modelPath: '/models/kn_IN-piper-medium.onnx',
          ready: true,
          status: 'Ready',
          nextAction: 'Ready for offline native runtime.',
        },
      ],
    })

    vi.stubGlobal('kannadaOS', {
      platform: 'darwin',
      inspectLocalRuntime,
    })
    localStorage.setItem('kannadaos:onboarded', 'true')
    render(<App />)

    await user.click(screen.getByRole('button', { name: /me/i }))
    await user.click(screen.getByRole('button', { name: /manage ai models/i }))

    expect(screen.getByRole('heading', { name: /On-device Runtime/i })).toBeInTheDocument()
    expect(screen.getByText(/0 of 3 runtime components ready/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Aya GGUF model path/i), '/models/aya-8b-q4_K_M.gguf')
    await user.type(screen.getByLabelText(/Whisper model path/i), '/models/whisper-small.bin')
    await user.type(screen.getByLabelText(/Piper voice path/i), '/models/kn_IN-piper-medium.onnx')
    await user.click(screen.getByRole('button', { name: /check local runtime/i }))

    expect(inspectLocalRuntime).toHaveBeenCalledWith({
      llmModelPath: '/models/aya-8b-q4_K_M.gguf',
      whisperModelPath: '/models/whisper-small.bin',
      piperVoicePath: '/models/kn_IN-piper-medium.onnx',
    })
    expect(await screen.findByText(/3 of 3 runtime components ready/i)).toBeInTheDocument()
    expect(screen.getByText(/Llama.cpp LLM/i)).toBeInTheDocument()
    expect(screen.getByText(/Whisper.cpp STT/i)).toBeInTheDocument()
    expect(screen.getByText(/Piper TTS/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^Ready$/i)).toHaveLength(3)
  })

  it('opens story mode, shows interactive words, and completes the story quiz', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /zero/i }))
    await user.click(screen.getByRole('button', { name: /start learning/i }))
    await user.click(screen.getByRole('button', { name: /stories/i }))

    expect(screen.getByRole('heading', { name: /Stories/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /First Day in Bangalore/i })).toBeInTheDocument()
    expect(screen.getByText(/5 min read/i)).toBeInTheDocument()
    expect(screen.getByText(/12 new words/i)).toBeInTheDocument()
    expect(screen.getByText(/Office Lunch/i)).toBeInTheDocument()
    expect(screen.getByText(/^Locked$/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /read first day in bangalore/i }))

    expect(screen.getByRole('heading', { name: /First Day in Bangalore/i })).toBeInTheDocument()
    expect(screen.getByText(/ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ/i)).toBeInTheDocument()
    expect(screen.getByText(/raahul bengalurige banda/i)).toBeInTheDocument()
    expect(screen.getByText(/Rahul came to Bangalore/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ಬಂದ' }))

    const wordDialog = screen.getByRole('dialog', { name: /ಬಂದ/i })
    expect(wordDialog).toBeInTheDocument()
    expect(within(wordDialog).getByText(/banda/i)).toBeInTheDocument()
    expect(within(wordDialog).getByText(/came/i)).toBeInTheDocument()
    expect(within(wordDialog).getByRole('button', { name: /add to vocabulary/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /take quiz/i }))
    await user.click(screen.getByRole('button', { name: /He does not know Kannada yet/i }))
    await user.click(screen.getByRole('button', { name: /check story answer/i }))

    expect(screen.getByRole('heading', { name: /Story Complete/i })).toBeInTheDocument()
    expect(screen.getByText(/\+20 XP/i)).toBeInTheDocument()
  })
})
