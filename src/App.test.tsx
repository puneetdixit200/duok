import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('KannadaOS desktop app', () => {
  beforeEach(() => {
    localStorage.clear()
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
})
