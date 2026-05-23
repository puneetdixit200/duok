import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import type { LocalRuntimeConfig, LocalRuntimeSummary } from './localRuntime'

const require = createRequire(import.meta.url)
const { inspectLocalRuntimeInMain, runLocalRuntimeSmokeInMain } = require('../../electron/local-runtime.cjs') as {
  inspectLocalRuntimeInMain: (
    config: LocalRuntimeConfig,
    pathExists: (modelPath: string) => boolean,
  ) => LocalRuntimeSummary
  runLocalRuntimeSmokeInMain: (
    config: LocalRuntimeConfig,
    commandRunner: (binaryPath: string, args: string[]) => Promise<{ ok: boolean; output: string }>,
    pathExists: (runtimePath: string) => boolean,
  ) => Promise<{
    passedCount: number
    totalCount: number
    statusText: string
    components: Array<{ id: string; ok: boolean; status: string }>
  }>
}

describe('electron local runtime inspection', () => {
  it('checks filesystem-backed native model paths without renderer filesystem access', () => {
    const summary = inspectLocalRuntimeInMain(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/missing.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '',
        piperBinaryPath: '/bin/piper',
      },
      (modelPath) => !modelPath.includes('missing'),
    )

    expect(summary.statusText).toBe('1 of 3 runtime components ready')
    expect(summary.components).toEqual([
      expect.objectContaining({ id: 'llm', ready: true, status: 'Ready', binaryPath: '/bin/llama-cli' }),
      expect.objectContaining({ id: 'stt', ready: false, status: 'Executable not set' }),
      expect.objectContaining({ id: 'tts', ready: false, status: 'Voice file missing' }),
    ])
  })

  it('runs native executable smoke commands only after runtime paths are ready', async () => {
    const calls: Array<{ binaryPath: string; args: string[] }> = []
    const summary = await runLocalRuntimeSmokeInMain(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/kn_IN-piper-medium.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      async (binaryPath, args) => {
        calls.push({ binaryPath, args })
        return { ok: !binaryPath.includes('piper'), output: 'usage' }
      },
      () => true,
    )

    expect(calls).toEqual([
      { binaryPath: '/bin/llama-cli', args: ['--help'] },
      { binaryPath: '/bin/whisper-cli', args: ['--help'] },
      { binaryPath: '/bin/piper', args: ['--help'] },
    ])
    expect(summary.statusText).toBe('2 of 3 native commands responded')
    expect(summary.components).toEqual([
      expect.objectContaining({ id: 'llm', ok: true, status: 'Command responded' }),
      expect.objectContaining({ id: 'stt', ok: true, status: 'Command responded' }),
      expect.objectContaining({ id: 'tts', ok: false, status: 'Smoke failed' }),
    ])
  })
})
