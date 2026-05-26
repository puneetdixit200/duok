import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import type { LocalRuntimeConfig, LocalRuntimeSummary } from './localRuntime'

const require = createRequire(import.meta.url)
const {
  generateNativeExerciseInMain,
  inspectLocalRuntimeInMain,
  runLocalRuntimeSmokeInMain,
  synthesizeNativeSpeechInMain,
  transcribeNativeAudioInMain,
  transcribeRecordedAudioInMain,
} = require('../../electron/local-runtime.cjs') as {
  generateNativeExerciseInMain: (
    config: LocalRuntimeConfig,
    prompt: string,
    commandRunner: (binaryPath: string, args: string[]) => Promise<{ ok: boolean; output: string }>,
    pathExists: (runtimePath: string) => boolean,
  ) => Promise<{ ok: boolean; response: string; error?: string }>
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
  synthesizeNativeSpeechInMain: (
    config: LocalRuntimeConfig,
    text: string,
    outputDirectory: string,
    commandRunner: (binaryPath: string, args: string[], input: string) => Promise<{ ok: boolean; output: string }>,
    pathExists: (runtimePath: string) => boolean,
  ) => Promise<{ ok: boolean; audioPath: string; error?: string }>
  transcribeNativeAudioInMain: (
    config: LocalRuntimeConfig,
    audioPath: string,
    commandRunner: (binaryPath: string, args: string[]) => Promise<{ ok: boolean; output: string }>,
    pathExists: (runtimePath: string) => boolean,
  ) => Promise<{ ok: boolean; text: string; error?: string }>
  transcribeRecordedAudioInMain: (
    config: LocalRuntimeConfig,
    audioBytes: number[] | Uint8Array,
    source: string,
    outputDirectory: string,
    transcriber: (config: LocalRuntimeConfig, audioPath: string) => Promise<{ ok: boolean; text: string; error?: string }>,
  ) => Promise<{ ok: boolean; text: string; error?: string }>
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

  it('runs llama.cpp generation with the configured model and prompt', async () => {
    const calls: Array<{ binaryPath: string; args: string[] }> = []
    const result = await generateNativeExerciseInMain(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/kn_IN-piper-medium.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      'Return JSON for verbs.',
      async (binaryPath, args) => {
        calls.push({ binaryPath, args })
        return { ok: true, output: '{"type":"translate","prompt":"Translate","kannada":"ಹೋಗಬೇಕು","answer":"need to go","options":["need to go"]}' }
      },
      () => true,
    )

    expect(calls).toEqual([
      {
        binaryPath: '/bin/llama-cli',
        args: ['-m', '/models/aya-8b-q4_K_M.gguf', '-p', 'Return JSON for verbs.', '-n', '512', '--temp', '0.7'],
      },
    ])
    expect(result).toEqual({
      ok: true,
      response: '{"type":"translate","prompt":"Translate","kannada":"ಹೋಗಬೇಕು","answer":"need to go","options":["need to go"]}',
    })
  })

  it('transcribes audio through whisper.cpp and normalizes timestamped output', async () => {
    const calls: Array<{ binaryPath: string; args: string[] }> = []
    const result = await transcribeNativeAudioInMain(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/kn_IN-piper-medium.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      '/tmp/namaskara.wav',
      async (binaryPath, args) => {
        calls.push({ binaryPath, args })
        return { ok: true, output: '[00:00:00.000 --> 00:00:01.100]  ನಮಸ್ಕಾರ ಸಾರ್' }
      },
      () => true,
    )

    expect(calls).toEqual([
      {
        binaryPath: '/bin/whisper-cli',
        args: ['-m', '/models/whisper-small.bin', '-f', '/tmp/namaskara.wav', '-l', 'kn'],
      },
    ])
    expect(result).toEqual({ ok: true, text: 'ನಮಸ್ಕಾರ ಸಾರ್' })
  })

  it('saves recorded WAV bytes for Whisper and removes the temp file afterward', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const path = await import('node:path')
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-recording-test-'))
    const seenAudioPaths: string[] = []

    try {
      const result = await transcribeRecordedAudioInMain(
        {
          llmModelPath: '/models/aya-8b-q4_K_M.gguf',
          whisperModelPath: '/models/whisper-small.bin',
          piperVoicePath: '/models/kn_IN-piper-medium.onnx',
          llamaBinaryPath: '/bin/llama-cli',
          whisperBinaryPath: '/bin/whisper-cli',
          piperBinaryPath: '/bin/piper',
        },
        new Uint8Array([82, 73, 70, 70]),
        'chat',
        tempDir,
        async (_config, audioPath) => {
          seenAudioPaths.push(audioPath)
          expect(fs.existsSync(audioPath)).toBe(true)
          expect(fs.readFileSync(audioPath)).toEqual(Buffer.from([82, 73, 70, 70]))
          return { ok: true, text: 'ನಮಸ್ಕಾರ ಸಾರ್' }
        },
      )

      expect(result).toEqual({ ok: true, text: 'ನಮಸ್ಕಾರ ಸಾರ್' })
      expect(seenAudioPaths).toHaveLength(1)
      expect(path.basename(seenAudioPaths[0])).toMatch(/^chat-\d+\.wav$/)
      expect(fs.readdirSync(tempDir)).toEqual([])
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects empty recorded audio before creating temp files', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const path = await import('node:path')
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-empty-recording-test-'))

    try {
      const result = await transcribeRecordedAudioInMain(
        {
          llmModelPath: '/models/aya-8b-q4_K_M.gguf',
          whisperModelPath: '/models/whisper-small.bin',
          piperVoicePath: '/models/kn_IN-piper-medium.onnx',
          llamaBinaryPath: '/bin/llama-cli',
          whisperBinaryPath: '/bin/whisper-cli',
          piperBinaryPath: '/bin/piper',
        },
        [],
        'chat',
        tempDir,
        async () => {
          throw new Error('transcriber should not run')
        },
      )

      expect(result).toEqual({ ok: false, text: '', error: 'Recorded audio is empty.' })
      expect(fs.readdirSync(tempDir)).toEqual([])
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('removes recorded audio temp files when Whisper returns a failure', async () => {
    const fs = await import('node:fs')
    const os = await import('node:os')
    const path = await import('node:path')
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-recording-failure-test-'))
    const seenAudioPaths: string[] = []

    try {
      const result = await transcribeRecordedAudioInMain(
        {
          llmModelPath: '/models/aya-8b-q4_K_M.gguf',
          whisperModelPath: '/models/whisper-small.bin',
          piperVoicePath: '/models/kn_IN-piper-medium.onnx',
          llamaBinaryPath: '/bin/llama-cli',
          whisperBinaryPath: '/bin/whisper-cli',
          piperBinaryPath: '/bin/piper',
        },
        new Uint8Array([82, 73, 70, 70]),
        '../Chat Input',
        tempDir,
        async (_config, audioPath) => {
          seenAudioPaths.push(audioPath)
          expect(path.dirname(audioPath)).toBe(tempDir)
          expect(path.basename(audioPath)).toMatch(/^chat-input-\d+\.wav$/)
          return { ok: false, text: '', error: 'Whisper runtime is not ready.' }
        },
      )

      expect(result).toEqual({ ok: false, text: '', error: 'Whisper runtime is not ready.' })
      expect(seenAudioPaths).toHaveLength(1)
      expect(fs.readdirSync(tempDir)).toEqual([])
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('rejects recorded audio requests without a writable output directory', async () => {
    const result = await transcribeRecordedAudioInMain(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/kn_IN-piper-medium.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      new Uint8Array([82, 73, 70, 70]),
      'chat',
      '',
      async () => {
        throw new Error('transcriber should not run')
      },
    )

    expect(result).toEqual({
      ok: false,
      text: '',
      error: 'Recording output directory is not configured.',
    })
  })

  it('synthesizes speech through Piper with the configured voice model', async () => {
    const calls: Array<{ binaryPath: string; args: string[]; input: string }> = []
    const result = await synthesizeNativeSpeechInMain(
      {
        llmModelPath: '/models/aya-8b-q4_K_M.gguf',
        whisperModelPath: '/models/whisper-small.bin',
        piperVoicePath: '/models/kn_IN-piper-medium.onnx',
        llamaBinaryPath: '/bin/llama-cli',
        whisperBinaryPath: '/bin/whisper-cli',
        piperBinaryPath: '/bin/piper',
      },
      'ನಮಸ್ಕಾರ ಸಾರ್',
      '/tmp/kannadaos-audio',
      async (binaryPath, args, input) => {
        calls.push({ binaryPath, args, input })
        return { ok: true, output: 'wrote wav' }
      },
      () => true,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      binaryPath: '/bin/piper',
      args: ['--model', '/models/kn_IN-piper-medium.onnx', '--output_file', result.audioPath],
      input: 'ನಮಸ್ಕಾರ ಸಾರ್',
    })
    expect(result).toEqual({
      ok: true,
      audioPath: expect.stringMatching(/^\/tmp\/kannadaos-audio\/piper-/),
      audioUrl: expect.stringMatching(/^file:\/\/\/tmp\/kannadaos-audio\/piper-/),
    })
  })
})
