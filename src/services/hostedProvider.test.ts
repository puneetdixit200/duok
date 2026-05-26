import { describe, expect, it, vi } from 'vitest'
import {
  defaultAiProviderSettings,
  generateExerciseWithHostedProvider,
  generateTutorReplyWithHostedProvider,
  hydrateAiProviderSettings,
  sanitizeAiProviderSettingsForExport,
} from './hostedProvider'

describe('hosted AI provider routing', () => {
  it('calls OpenRouter with the configured key, model, and OpenAI-compatible chat endpoint', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: 'translate',
                prompt: 'Translate the Kannada phrase',
                kannada: 'ನಮಸ್ಕಾರ ಸಾರ್',
                answer: 'Hello sir',
                options: ['Hello sir', 'Goodbye sir'],
                explanation: 'A respectful greeting.',
              }),
            },
          },
        ],
      }),
    })) as unknown as typeof fetch

    const result = await generateExerciseWithHostedProvider({
      fetchImpl,
      providerSettings: {
        ...defaultAiProviderSettings,
        activeProvider: 'openrouter',
        openRouterApiKey: 'sk-or-test',
        openRouterModel: 'openai/gpt-4o-mini',
      },
      weakArea: 'greetings',
    })

    expect(result.source).toBe('openrouter')
    expect(result.exercise.answer).toBe('Hello sir')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-test',
          'Content-Type': 'application/json',
          'X-Title': 'KannadaOS',
        }),
      }),
    )
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      model: 'openai/gpt-4o-mini',
    })
  })

  it('calls NVIDIA hosted NIM with the configured key, model, and base URL', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: 'fillBlank',
                prompt: 'Fill the blank',
                kannada: 'ನಾನು ___ ಹೋಗಬೇಕು',
                answer: 'ಮನೆಗೆ',
                options: ['ಮನೆಗೆ', 'ಸಾರ್'],
              }),
            },
          },
        ],
      }),
    })) as unknown as typeof fetch

    const result = await generateExerciseWithHostedProvider({
      fetchImpl,
      providerSettings: {
        ...defaultAiProviderSettings,
        activeProvider: 'nvidia',
        nvidiaApiKey: 'nvapi-test',
        nvidiaModel: 'sarvamai/sarvam-m',
      },
      weakArea: 'postpositions',
    })

    expect(result.source).toBe('nvidia')
    expect(result.exercise.answer).toBe('ಮನೆಗೆ')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer nvapi-test',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('returns local fallback when the selected hosted provider is missing a key or model', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch

    const result = await generateExerciseWithHostedProvider({
      fetchImpl,
      providerSettings: { ...defaultAiProviderSettings, activeProvider: 'openrouter' },
      weakArea: 'verbs',
    })

    expect(result.source).toBe('fallback')
    expect(result.error).toMatch(/OpenRouter API key/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('generates tutor chat replies through the selected hosted provider', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Tutor: ಹೇಳಿ, where do you want to go?' } }],
      }),
    })) as unknown as typeof fetch

    const result = await generateTutorReplyWithHostedProvider({
      fetchImpl,
      providerSettings: {
        ...defaultAiProviderSettings,
        activeProvider: 'openrouter',
        openRouterApiKey: 'sk-or-test',
        openRouterModel: 'openai/gpt-4o-mini',
      },
      learnerText: 'Majestic hogbeku',
      scenarioTitle: 'Auto Ride',
      personaName: 'Bangalore Buddy',
      personaStyle: 'Friendly and practical',
      usefulPhrases: ['Majestic-ge hogbeku'],
    })

    expect(result.source).toBe('openrouter')
    expect(result.text).toBe('Tutor: ಹೇಳಿ, where do you want to go?')
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: expect.stringContaining('Majestic hogbeku') }),
      ]),
    )
  })

  it('hydrates provider settings and redacts keys for exported learner snapshots', () => {
    const settings = hydrateAiProviderSettings(
      JSON.stringify({
        activeProvider: 'nvidia',
        openRouterApiKey: 'sk-or-test',
        openRouterModel: 'openai/gpt-4o-mini',
        nvidiaApiKey: 'nvapi-test',
        nvidiaModel: 'sarvamai/sarvam-m',
      }),
    )

    expect(settings.activeProvider).toBe('nvidia')
    expect(settings.openRouterBaseUrl).toBe('https://openrouter.ai/api/v1')
    expect(settings.nvidiaBaseUrl).toBe('https://integrate.api.nvidia.com/v1')
    expect(sanitizeAiProviderSettingsForExport(settings)).toEqual({
      activeProvider: 'nvidia',
      openRouterModel: 'openai/gpt-4o-mini',
      openRouterBaseUrl: 'https://openrouter.ai/api/v1',
      openRouterApiKeyConfigured: true,
      nvidiaModel: 'sarvamai/sarvam-m',
      nvidiaBaseUrl: 'https://integrate.api.nvidia.com/v1',
      nvidiaApiKeyConfigured: true,
    })
  })

  it('defaults NVIDIA hosted generation to the configured Sarvam model', () => {
    expect(hydrateAiProviderSettings(null).nvidiaModel).toBe('sarvamai/sarvam-m')
  })
})
