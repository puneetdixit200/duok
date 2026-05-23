export type LocalRuntimeComponentId = 'llm' | 'stt' | 'tts'

export interface LocalRuntimeConfig {
  llmModelPath: string
  whisperModelPath: string
  piperVoicePath: string
  llamaBinaryPath: string
  whisperBinaryPath: string
  piperBinaryPath: string
}

export interface LocalRuntimeComponent {
  id: LocalRuntimeComponentId
  label: string
  modelPath: string
  binaryPath: string
  ready: boolean
  status: string
  nextAction: string
}

export interface LocalRuntimeSummary {
  readyCount: number
  totalCount: number
  statusText: string
  components: LocalRuntimeComponent[]
}

export interface LocalRuntimeSmokeComponent {
  id: LocalRuntimeComponentId
  label: string
  ok: boolean
  status: string
  nextAction: string
  output?: string
}

export interface LocalRuntimeSmokeSummary {
  passedCount: number
  totalCount: number
  statusText: string
  components: LocalRuntimeSmokeComponent[]
}

export const emptyLocalRuntimeConfig: LocalRuntimeConfig = {
  llmModelPath: '',
  whisperModelPath: '',
  piperVoicePath: '',
  llamaBinaryPath: '',
  whisperBinaryPath: '',
  piperBinaryPath: '',
}

interface RuntimeComponentDefinition {
  id: LocalRuntimeComponentId
  label: string
  pathKey: keyof LocalRuntimeConfig
  binaryPathKey: keyof LocalRuntimeConfig
  missingPathAction: string
  missingFileStatus: string
  missingFileAction: string
  missingBinaryPathAction: string
  missingBinaryFileAction: string
}

const runtimeComponentDefinitions: RuntimeComponentDefinition[] = [
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

export async function inspectLocalRuntime(
  config: LocalRuntimeConfig,
  pathExists: (modelPath: string) => Promise<boolean>,
): Promise<LocalRuntimeSummary> {
  const components = await Promise.all(
    runtimeComponentDefinitions.map(async (definition) => {
      const modelPath = config[definition.pathKey].trim()
      const binaryPath = config[definition.binaryPathKey].trim()

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

      const exists = await pathExists(modelPath)

      if (!exists) {
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

      const binaryExists = await pathExists(binaryPath)

      if (!binaryExists) {
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
    }),
  )

  const readyCount = components.filter((component) => component.ready).length
  const totalCount = components.length

  return {
    readyCount,
    totalCount,
    statusText: `${readyCount} of ${totalCount} runtime components ready`,
    components,
  }
}

export function createMissingLocalRuntimeSummary(
  config: LocalRuntimeConfig = emptyLocalRuntimeConfig,
): LocalRuntimeSummary {
  const components = runtimeComponentDefinitions.map((definition) => {
    const modelPath = config[definition.pathKey].trim()
    const binaryPath = config[definition.binaryPathKey].trim()

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

    return {
      id: definition.id,
      label: definition.label,
      modelPath,
      binaryPath,
      ready: false,
      status: definition.missingFileStatus,
      nextAction: definition.missingFileAction,
    }
  })

  return {
    readyCount: 0,
    totalCount: components.length,
    statusText: `0 of ${components.length} runtime components ready`,
    components,
  }
}
