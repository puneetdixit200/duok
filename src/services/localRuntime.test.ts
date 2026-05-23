import { describe, expect, it } from 'vitest'
import { inspectLocalRuntime } from './localRuntime'

describe('local runtime readiness', () => {
  it('summarizes llama, whisper, and piper model readiness', async () => {
    const existingPaths = new Set([
      '/models/aya-8b-q4_K_M.gguf',
      '/models/whisper-small.bin',
      '/models/kn_IN-piper-medium.onnx',
    ])

    const summary = await inspectLocalRuntime(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/kn_IN-piper-medium.onnx',
      },
      async (modelPath) => existingPaths.has(modelPath),
    )

    expect(summary.readyCount).toBe(3)
    expect(summary.statusText).toBe('3 of 3 runtime components ready')
    expect(summary.components).toEqual([
      expect.objectContaining({ id: 'llm', label: 'Llama.cpp LLM', ready: true, status: 'Ready' }),
      expect.objectContaining({ id: 'stt', label: 'Whisper.cpp STT', ready: true, status: 'Ready' }),
      expect.objectContaining({ id: 'tts', label: 'Piper TTS', ready: true, status: 'Ready' }),
    ])
  })

  it('reports missing native model paths with clear next actions', async () => {
    const summary = await inspectLocalRuntime(
      {
        llmModelPath: '/models/missing.gguf',
        whisperModelPath: '',
        piperVoicePath: '/models/missing.onnx',
      },
      async () => false,
    )

    expect(summary.readyCount).toBe(0)
    expect(summary.statusText).toBe('0 of 3 runtime components ready')
    expect(summary.components).toEqual([
      expect.objectContaining({ id: 'llm', ready: false, status: 'Model file missing' }),
      expect.objectContaining({ id: 'stt', ready: false, nextAction: 'Choose a Whisper model path.' }),
      expect.objectContaining({ id: 'tts', ready: false, status: 'Voice file missing' }),
    ])
  })
})
