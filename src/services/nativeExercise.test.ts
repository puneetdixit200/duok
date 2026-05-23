import { describe, expect, it, vi } from 'vitest'
import type { LocalRuntimeConfig } from './localRuntime'
import { generateExerciseWithNativeRuntime } from './nativeExercise'

const runtimeConfig: LocalRuntimeConfig = {
  llmModelPath: '/models/aya-8b-q4_K_M.gguf',
  whisperModelPath: '/models/whisper-small.bin',
  piperVoicePath: '/models/kn_IN-piper-medium.onnx',
  llamaBinaryPath: '/bin/llama-cli',
  whisperBinaryPath: '/bin/whisper-cli',
  piperBinaryPath: '/bin/piper',
}

describe('native exercise generation', () => {
  it('parses a llama.cpp JSON exercise response from the desktop bridge', async () => {
    const generateNativeExercise = vi.fn(async ({ prompt }: { prompt: string }) => ({
      ok: true,
      response: JSON.stringify({
        type: 'fillBlank',
        prompt: 'Fill the native blank',
        kannada: 'ನಾನು ___ ಹೋಗಬೇಕು',
        answer: 'ಮನೆಗೆ',
        options: ['ಮನೆಗೆ', 'ನಮಸ್ಕಾರ'],
        explanation: 'Native llama.cpp generated this.',
      }),
      observedPrompt: prompt,
    }))

    const result = await generateExerciseWithNativeRuntime({
      runtimeConfig,
      weakArea: 'postpositions',
      generateNativeExercise,
    })

    expect(generateNativeExercise).toHaveBeenCalledWith({
      runtimeConfig,
      prompt: expect.stringContaining('Target weak area: postpositions'),
    })
    expect(result).toEqual({
      source: 'native',
      exercise: {
        type: 'fillBlank',
        prompt: 'Fill the native blank',
        kannada: 'ನಾನು ___ ಹೋಗಬೇಕು',
        answer: 'ಮನೆಗೆ',
        options: ['ಮನೆಗೆ', 'ನಮಸ್ಕಾರ'],
        explanation: 'Native llama.cpp generated this.',
      },
    })
  })

  it('falls back to local exercise when native generation is unavailable or malformed', async () => {
    await expect(
      generateExerciseWithNativeRuntime({
        runtimeConfig,
        weakArea: 'verbs',
        generateNativeExercise: async () => ({ ok: false, response: '', error: 'not ready' }),
      }),
    ).resolves.toMatchObject({ source: 'fallback' })

    await expect(
      generateExerciseWithNativeRuntime({
        runtimeConfig,
        weakArea: 'verbs',
        generateNativeExercise: async () => ({ ok: true, response: '{ broken' }),
      }),
    ).resolves.toMatchObject({ source: 'fallback' })
  })
})
