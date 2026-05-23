import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import type { LocalRuntimeConfig, LocalRuntimeSummary } from './localRuntime'

const require = createRequire(import.meta.url)
const { inspectLocalRuntimeInMain } = require('../../electron/local-runtime.cjs') as {
  inspectLocalRuntimeInMain: (
    config: LocalRuntimeConfig,
    pathExists: (modelPath: string) => boolean,
  ) => LocalRuntimeSummary
}

describe('electron local runtime inspection', () => {
  it('checks filesystem-backed native model paths without renderer filesystem access', () => {
    const summary = inspectLocalRuntimeInMain(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/missing.onnx',
      },
      (modelPath) => !modelPath.includes('missing'),
    )

    expect(summary.statusText).toBe('2 of 3 runtime components ready')
    expect(summary.components).toEqual([
      expect.objectContaining({ id: 'llm', ready: true, status: 'Ready' }),
      expect.objectContaining({ id: 'stt', ready: true, status: 'Ready' }),
      expect.objectContaining({ id: 'tts', ready: false, status: 'Voice file missing' }),
    ])
  })
})
