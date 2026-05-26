import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { requestHostedChatInMain } = require('../../electron/hosted-ai.cjs') as {
  requestHostedChatInMain: (
    request: unknown,
    fetchImpl: typeof fetch,
  ) => Promise<{ ok: boolean; text: string; error?: string }>
}

describe('electron hosted AI bridge', () => {
  it('sends OpenRouter chat requests from the main process with app attribution headers', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hosted reply' } }],
      }),
    })) as unknown as typeof fetch

    const result = await requestHostedChatInMain(
      {
        provider: 'openrouter',
        apiKey: 'sk-or-test',
        model: 'openai/gpt-4o-mini',
        baseUrl: 'https://openrouter.ai/api/v1',
        messages: [{ role: 'user', content: 'ನಮಸ್ಕಾರ' }],
      },
      fetchImpl,
    )

    expect(result).toEqual({ ok: true, text: 'Hosted reply' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-test',
          'HTTP-Referer': 'https://github.com/puneetdixit200/duok',
          'X-Title': 'KannadaOS',
        }),
      }),
    )
  })

  it('validates hosted AI requests before calling the network', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch

    const result = await requestHostedChatInMain(
      {
        provider: 'nvidia',
        apiKey: '',
        model: 'sarvamai/sarvam-m',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      fetchImpl,
    )

    expect(result).toEqual({ ok: false, text: '', error: 'NVIDIA hosted API key is required.' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
