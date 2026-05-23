const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { execFile } = require('node:child_process')

const runtimeComponentDefinitions = [
  {
    id: 'llm',
    label: 'Llama.cpp LLM',
    pathKey: 'llmModelPath',
    binaryPathKey: 'llamaBinaryPath',
    missingPathAction: 'Choose an Aya GGUF model path.',
    missingFileStatus: 'Model file missing',
    missingFileAction: 'Point to a downloaded GGUF model before switching off Ollama.',
    missingBinaryPathAction: 'Choose a llama.cpp executable path.',
    missingBinaryFileAction: 'Point to the local llama.cpp llama-cli executable.',
  },
  {
    id: 'stt',
    label: 'Whisper.cpp STT',
    pathKey: 'whisperModelPath',
    binaryPathKey: 'whisperBinaryPath',
    missingPathAction: 'Choose a Whisper model path.',
    missingFileStatus: 'Model file missing',
    missingFileAction: 'Point to whisper-small.bin or another offline Whisper model.',
    missingBinaryPathAction: 'Choose a whisper.cpp executable path.',
    missingBinaryFileAction: 'Point to the local whisper.cpp executable.',
  },
  {
    id: 'tts',
    label: 'Piper TTS',
    pathKey: 'piperVoicePath',
    binaryPathKey: 'piperBinaryPath',
    missingPathAction: 'Choose a Piper voice path.',
    missingFileStatus: 'Voice file missing',
    missingFileAction: 'Point to a Kannada Piper ONNX voice file.',
    missingBinaryPathAction: 'Choose a Piper executable path.',
    missingBinaryFileAction: 'Point to the local Piper executable.',
  },
]

function inspectLocalRuntimeInMain(config = {}, pathExists = fs.existsSync) {
  const components = runtimeComponentDefinitions.map((definition) => {
    const modelPath = normalizePath(config[definition.pathKey])
    const binaryPath = normalizePath(config[definition.binaryPathKey])

    if (!modelPath) {
      return {
        id: definition.id,
        label: definition.label,
        modelPath,
        binaryPath,
        ready: false,
        status: 'Path not set',
        nextAction: definition.missingPathAction,
      }
    }

    if (!pathExistsSafely(modelPath, pathExists)) {
      return {
        id: definition.id,
        label: definition.label,
        modelPath,
        binaryPath,
        ready: false,
        status: definition.missingFileStatus,
        nextAction: definition.missingFileAction,
      }
    }

    if (!binaryPath) {
      return {
        id: definition.id,
        label: definition.label,
        modelPath,
        binaryPath,
        ready: false,
        status: 'Executable not set',
        nextAction: definition.missingBinaryPathAction,
      }
    }

    if (!pathExistsSafely(binaryPath, pathExists)) {
      return {
        id: definition.id,
        label: definition.label,
        modelPath,
        binaryPath,
        ready: false,
        status: 'Executable missing',
        nextAction: definition.missingBinaryFileAction,
      }
    }

    return {
      id: definition.id,
      label: definition.label,
      modelPath,
      binaryPath,
      ready: true,
      status: 'Ready',
      nextAction: 'Ready for offline native runtime.',
    }
  })

  const readyCount = components.filter((component) => component.ready).length
  const totalCount = components.length

  return {
    readyCount,
    totalCount,
    statusText: `${readyCount} of ${totalCount} runtime components ready`,
    components,
  }
}

async function runLocalRuntimeSmokeInMain(
  config = {},
  commandRunner = runExecutableSmoke,
  pathExists = fs.existsSync,
) {
  const readiness = inspectLocalRuntimeInMain(config, pathExists)
  const components = await Promise.all(
    readiness.components.map(async (component) => {
      if (!component.ready) {
        return {
          id: component.id,
          label: component.label,
          ok: false,
          status: component.status,
          nextAction: component.nextAction,
          output: '',
        }
      }

      try {
        const result = await commandRunner(component.binaryPath, ['--help'])
        if (result.ok) {
          return {
            id: component.id,
            label: component.label,
            ok: true,
            status: 'Command responded',
            nextAction: 'Native command smoke passed.',
            output: result.output || '',
          }
        }

        return {
          id: component.id,
          label: component.label,
          ok: false,
          status: 'Smoke failed',
          nextAction: result.output || 'Check that this executable can run with --help.',
          output: result.output || '',
        }
      } catch (error) {
        return {
          id: component.id,
          label: component.label,
          ok: false,
          status: 'Smoke failed',
          nextAction: error instanceof Error ? error.message : 'Native command failed.',
          output: '',
        }
      }
    }),
  )
  const passedCount = components.filter((component) => component.ok).length
  const totalCount = components.length

  return {
    passedCount,
    totalCount,
    statusText: `${passedCount} of ${totalCount} native commands responded`,
    components,
  }
}

async function generateNativeExerciseInMain(
  config = {},
  prompt = '',
  commandRunner = runExecutableCompletion,
  pathExists = fs.existsSync,
) {
  const readiness = inspectLocalRuntimeInMain(config, pathExists)
  const llm = readiness.components.find((component) => component.id === 'llm')

  if (!llm?.ready) {
    return {
      ok: false,
      response: '',
      error: llm?.nextAction ?? 'Llama.cpp runtime is not ready.',
    }
  }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return {
      ok: false,
      response: '',
      error: 'Prompt is empty.',
    }
  }

  const args = ['-m', llm.modelPath, '-p', prompt, '-n', '512', '--temp', '0.7']
  const result = await commandRunner(llm.binaryPath, args)

  if (!result.ok) {
    return {
      ok: false,
      response: result.output || '',
      error: result.output || 'Native llama.cpp generation failed.',
    }
  }

  return {
    ok: true,
    response: result.output,
  }
}

async function transcribeNativeAudioInMain(
  config = {},
  audioPath = '',
  commandRunner = runExecutableCompletion,
  pathExists = fs.existsSync,
) {
  const normalizedAudioPath = normalizePath(audioPath)
  const readiness = inspectLocalRuntimeInMain(config, pathExists)
  const stt = readiness.components.find((component) => component.id === 'stt')

  if (!stt?.ready) {
    return {
      ok: false,
      text: '',
      error: stt?.nextAction ?? 'Whisper.cpp runtime is not ready.',
    }
  }

  if (!normalizedAudioPath) {
    return {
      ok: false,
      text: '',
      error: 'Audio file path is empty.',
    }
  }

  if (!pathExistsSafely(normalizedAudioPath, pathExists)) {
    return {
      ok: false,
      text: '',
      error: 'Audio file missing.',
    }
  }

  const result = await commandRunner(stt.binaryPath, ['-m', stt.modelPath, '-f', normalizedAudioPath, '-l', 'kn'])

  if (!result.ok) {
    return {
      ok: false,
      text: '',
      error: result.output || 'Native Whisper transcription failed.',
    }
  }

  const text = normalizeWhisperTranscript(result.output)
  return text
    ? { ok: true, text }
    : { ok: false, text: '', error: 'Whisper produced no transcript.' }
}

async function synthesizeNativeSpeechInMain(
  config = {},
  text = '',
  outputDirectory = '',
  commandRunner = runExecutableWithInput,
  pathExists = fs.existsSync,
) {
  const speechText = typeof text === 'string' ? text.trim() : ''
  const normalizedOutputDirectory = normalizePath(outputDirectory)
  const readiness = inspectLocalRuntimeInMain(config, pathExists)
  const tts = readiness.components.find((component) => component.id === 'tts')

  if (!tts?.ready) {
    return {
      ok: false,
      audioPath: '',
      error: tts?.nextAction ?? 'Piper runtime is not ready.',
    }
  }

  if (!speechText) {
    return {
      ok: false,
      audioPath: '',
      error: 'Speech text is empty.',
    }
  }

  if (!normalizedOutputDirectory) {
    return {
      ok: false,
      audioPath: '',
      error: 'Audio output directory is not configured.',
    }
  }

  fs.mkdirSync(normalizedOutputDirectory, { recursive: true })
  const audioPath = path.join(normalizedOutputDirectory, `piper-${Date.now()}.wav`)
  const result = await commandRunner(
    tts.binaryPath,
    ['--model', tts.modelPath, '--output_file', audioPath],
    speechText,
  )

  if (!result.ok) {
    return {
      ok: false,
      audioPath: '',
      error: result.output || 'Native Piper synthesis failed.',
    }
  }

  if (!pathExistsSafely(audioPath, pathExists)) {
    return {
      ok: false,
      audioPath: '',
      error: 'Piper did not create an audio file.',
    }
  }

  return {
    ok: true,
    audioPath,
    audioUrl: pathToFileURL(audioPath).href,
  }
}

function runExecutableSmoke(binaryPath, args) {
  return new Promise((resolve) => {
    execFile(binaryPath, args, { timeout: 3000 }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n').trim()

      if (!error || output) {
        resolve({ ok: true, output })
        return
      }

      resolve({ ok: false, output: error.message })
    })
  })
}

function runExecutableCompletion(binaryPath, args) {
  return new Promise((resolve) => {
    execFile(binaryPath, args, { timeout: 45000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n').trim()

      if (!error && output) {
        resolve({ ok: true, output })
        return
      }

      resolve({ ok: false, output: output || error?.message || 'Native command produced no output.' })
    })
  })
}

function runExecutableWithInput(binaryPath, args, input) {
  return new Promise((resolve) => {
    const child = execFile(binaryPath, args, { timeout: 45000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const output = [stdout, stderr].filter(Boolean).join('\n').trim()

      if (!error) {
        resolve({ ok: true, output })
        return
      }

      resolve({ ok: false, output: output || error.message })
    })

    child.stdin?.end(`${input}\n`)
  })
}

function normalizePath(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function pathExistsSafely(modelPath, pathExists) {
  try {
    return Boolean(pathExists(modelPath))
  } catch {
    return false
  }
}

function normalizeWhisperTranscript(output) {
  return String(output)
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join(' ')
}

module.exports = {
  generateNativeExerciseInMain,
  inspectLocalRuntimeInMain,
  runLocalRuntimeSmokeInMain,
  synthesizeNativeSpeechInMain,
  transcribeNativeAudioInMain,
}
