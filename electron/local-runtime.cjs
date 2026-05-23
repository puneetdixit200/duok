const fs = require('node:fs')

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

module.exports = {
  inspectLocalRuntimeInMain,
}
