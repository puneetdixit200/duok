import { describe, expect, it, vi } from 'vitest'
import { buildExercisePrompt, generateExerciseWithOllama, generateTutorReplyWithOllama } from './ollama'

describe('Ollama exercise generation', () => {
  it('parses valid JSON exercise responses', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          type: 'fillBlank',
          prompt: 'Fill in the blank',
          kannada: 'ನಾನು ___ ಹೋಗಬೇಕು',
          transliteration: 'naanu manege hogbeku',
          english: 'I need to go home',
          answer: 'ಮನೆಗೆ',
          options: ['ಮನೆಗೆ', 'ಧನ್ಯವಾದ', 'ನಮಸ್ಕಾರ', 'ಸಾರ್'],
          explanation: 'ಮನೆಗೆ means to home.',
          skillTag: 'postpositions',
          xp: 2,
          vocabularyIds: ['manege'],
        }),
      }),
    })) as unknown as typeof fetch

    const result = await generateExerciseWithOllama({
      fetchImpl,
      model: 'llama3.2',
      weakArea: 'postpositions',
    })

    expect(result.source).toBe('ollama')
    expect(result.exercise.answer).toBe('ಮನೆಗೆ')
    expect(result.exercise.english).toBe('I need to go home')
    expect(result.exercise.transliteration).toBe('naanu manege hogbeku')
    expect(result.exercise.options).toContain('ಮನೆಗೆ')
    expect(result.exercise.skillTag).toBe('postpositions')
    expect(result.exercise.xp).toBe(2)
    expect(result.exercise.vocabularyIds).toEqual(['manege'])
  })

  it('builds the frontend spec AI exercise prompt with learner context and metadata schema', () => {
    const prompt = buildExercisePrompt('transport', {
      difficultyLevel: 'steady beginner',
      weakAreas: { transport: 3, verbs: 1 },
      targetSkillTag: 'transport',
      vocabularyList: ['majestic-ge-hogbeku: ಮೆಜೆಸ್ಟಿಕ್‌ಗೆ ಹೋಗಬೇಕು (Majestic-ge hogbeku) = I need to go to Majestic'],
    })

    expect(prompt).toContain('The learner is at steady beginner level')
    expect(prompt).toContain('transport (3), verbs (1)')
    expect(prompt).toContain('Focus on the skill tag: transport')
    expect(prompt).toContain('Use vocabulary from this list: majestic-ge-hogbeku')
    expect(prompt).toContain('"skillTag":"greetings"')
    expect(prompt).toContain('"xp":2')
    expect(prompt).toContain('"vocabularyIds":["phrase-id"]')
  })

  it('extracts JSON from markdown code fences before parsing', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        response:
          '```json\n{"type":"translate","prompt":"Translate","kannada":"ಧನ್ಯವಾದ","answer":"Thank you","options":["Thank you","Hello"]}\n```',
      }),
    })) as unknown as typeof fetch

    const result = await generateExerciseWithOllama({ fetchImpl, weakArea: 'greetings' })

    expect(result.source).toBe('ollama')
    expect(result.exercise.kannada).toBe('ಧನ್ಯವಾದ')
  })

  it('falls back to a local exercise on malformed JSON or network errors', async () => {
    const malformedFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ response: '{ not valid json' }),
    })) as unknown as typeof fetch
    const failingFetch = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    await expect(
      generateExerciseWithOllama({ fetchImpl: malformedFetch, weakArea: 'verbs' }),
    ).resolves.toMatchObject({ source: 'fallback' })
    await expect(
      generateExerciseWithOllama({ fetchImpl: failingFetch, weakArea: 'verbs' }),
    ).resolves.toMatchObject({ source: 'fallback' })
  })

  it('generates tutor chat replies through Ollama with persona and scenario context', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        response: 'Friendly Anna: You can say ಮೀಟರ್ ಹಾಕಿ. Say: miitar haaki. English: Put the meter.',
      }),
    })) as unknown as typeof fetch

    const result = await generateTutorReplyWithOllama({
      fetchImpl,
      model: 'llama3.1:8b',
      learnerText: 'meter please',
      scenarioTitle: 'Auto Ride',
      scenarioSituation: 'You are negotiating an auto from Indiranagar to Majestic.',
      personaName: 'Friendly Anna',
      personaStyle: 'Casual and patient',
      correctionStyle: 'Gentle: Nice try!',
      usefulPhrases: ['ಮೀಟರ್ ಹಾಕಿ = miitar haaki = Put the meter'],
    })

    expect(result.source).toBe('ollama')
    expect(result.text).toContain('ಮೀಟರ್ ಹಾಕಿ')
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.objectContaining({
      method: 'POST',
    }))
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      model: 'llama3.1:8b',
      stream: false,
      prompt: expect.stringContaining('Learner said: "meter please"'),
    })
    const prompt = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).prompt
    expect(prompt).toContain('Scenario: Auto Ride. You are negotiating an auto from Indiranagar to Majestic.')
    expect(prompt).toContain('If the learner made a mistake, correct it Gentle: Nice try!.')
    expect(prompt).toContain('Always include a Kannada phrase')
  })

  it('falls back from Ollama tutor replies when the local model is unavailable', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch

    await expect(
      generateTutorReplyWithOllama({
        fetchImpl,
        learnerText: 'hello',
        scenarioTitle: 'Auto Ride',
        scenarioSituation: 'You are negotiating an auto from Indiranagar to Majestic.',
        personaName: 'Friendly Anna',
        personaStyle: 'Patient',
        correctionStyle: 'Gentle',
        usefulPhrases: ['ನಮಸ್ಕಾರ = namaskara = hello'],
      }),
    ).resolves.toMatchObject({ source: 'fallback', error: 'Ollama HTTP 503' })
  })
})
