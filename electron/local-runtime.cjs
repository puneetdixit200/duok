const fs = require('node:fs')

const runtimeComponentDefinitions = [
  {
    id: 'llm',
    label: 'Llama.cpp LLM',
    pathKey: 'llmModelPath',
    missingPathAction: 'Choose an Aya GGUF model path.',
    missingFileStatus: 'Model file missing',
    missingFileAction: 'Point to a downloaded GGUF model before switching off Ollama.',
  },
  {
    id: 'stt',
    label: 'Whisper.cpp STT',
    pathKey: 'whisperModelPath',
    missingPathAction: 'Choose a Whisper model path.',
    missingFileStatus: 'Model file missing',
    missingFileAction: 'Point to whisper-small.bin or another offline Whisper model.',
  },
  {
    id: 'tts',
    label: 'Piper TTS',
    pathKey: 'piperVoicePath',
    missingPathAction: 'Choose a Piper voice path.',
    missingFileStatus: 'Voice file missing',
    missingFileAction: 'Point to a Kannada Piper ONNX voice file.',
  },
]

function inspectLocalRuntimeInMain(config = {}, pathExists = fs.existsSync) {
  const components = runtimeComponentDefinitions.map((definition) => {
    const modelPath = normalizePath(config[definition.pathKey])

    if (!modelPath) {
      return {
        id: definition.id,
        label: definition.label,
        modelPath,
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
        ready: false,
        status: definition.missingFileStatus,
        nextAction: definition.missingFileAction,
      }
    }

    return {
      id: definition.id,
      label: definition.label,
      modelPath,
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
