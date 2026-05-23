import { describe, expect, it } from 'vitest'
import { inspectLocalRuntime } from './localRuntime'

describe('local runtime readiness', () => {
  it('summarizes llama, whisper, and piper model readiness', async () => {
    const existingPaths = new Set([
      '/models/aya-8b-q4_K_M.gguf',
      '/models/whisper-small.bin',
      '/models/kn_IN-piper-medium.onnx',
      '/bin/llama-cli',
      '/bin/whisper-cli',
      '/bin/piper',
    ])

    const summary = await inspectLocalRuntime(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/kn_IN-piper-medium.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      async (modelPath) => existingPaths.has(modelPath),
    )

    expect(summary.readyCount).toBe(3)
    expect(summary.statusText).toBe('3 of 3 runtime components ready')
    expect(summary.components).toEqual([
      expect.objectContaining({ id: 'llm', label: 'Llama.cpp LLM', binaryPath: '/bin/llama-cli', ready: true, status: 'Ready' }),
      expect.objectContaining({ id: 'stt', label: 'Whisper.cpp STT', binaryPath: '/bin/whisper-cli', ready: true, status: 'Ready' }),
      expect.objectContaining({ id: 'tts', label: 'Piper TTS', binaryPath: '/bin/piper', ready: true, status: 'Ready' }),
    ])
  })

  it('requires native executable paths in addition to model assets', async () => {
    const existingPaths = new Set(['/models/aya-8b-q4_K_M.gguf', '/models/whisper-small.bin', '/bin/piper', '/models/voice.onnx'])
    const summary = await inspectLocalRuntime(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/voice.onnx',
        llamaBinaryPath: '',
        whisperBinaryPath: '/bin/missing-whisper',
        piperBinaryPath: '/bin/piper',
      },
      async (runtimePath) => existingPaths.has(runtimePath),
    )

    expect(summary.readyCount).toBe(1)
    expect(summary.statusText).toBe('1 of 3 runtime components ready')
    expect(summary.components).toEqual([
      expect.objectContaining({ id: 'llm', ready: false, status: 'Executable not set' }),
      expect.objectContaining({ id: 'stt', ready: false, status: 'Executable missing' }),
      expect.objectContaining({ id: 'tts', ready: true, status: 'Ready' }),
    ])
  })

  it('reports missing native model paths with clear next actions', async () => {
    const summary = await inspectLocalRuntime(
      {
        llmModelPath: '/models/missing.gguf',
        whisperModelPath: '',
        piperVoicePath: '/models/missing.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
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
