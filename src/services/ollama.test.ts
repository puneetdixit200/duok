import { describe, expect, it, vi } from 'vitest'
import { generateExerciseWithOllama } from './ollama'

describe('Ollama exercise generation', () => {
  it('parses valid JSON exercise responses', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          type: 'fillBlank',
          prompt: 'Fill in the blank',
          kannada: 'ನಾನು ___ ಹೋಗಬೇಕು',
          answer: 'ಮನೆಗೆ',
          options: ['ಮನೆಗೆ', 'ಧನ್ಯವಾದ', 'ನಮಸ್ಕಾರ', 'ಸಾರ್'],
          explanation: 'ಮನೆಗೆ means to home.',
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
    expect(result.exercise.options).toContain('ಮನೆಗೆ')
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
})
