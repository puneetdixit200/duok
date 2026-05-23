export type LocalRuntimeComponentId = 'llm' | 'stt' | 'tts'

export interface LocalRuntimeConfig {
  llmModelPath: string
  whisperModelPath: string
  piperVoicePath: string
}

export interface LocalRuntimeComponent {
  id: LocalRuntimeComponentId
  label: string
  modelPath: string
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

export const emptyLocalRuntimeConfig: LocalRuntimeConfig = {
  llmModelPath: '',
  whisperModelPath: '',
  piperVoicePath: '',
}

interface RuntimeComponentDefinition {
  id: LocalRuntimeComponentId
  label: string
  pathKey: keyof LocalRuntimeConfig
  missingPathAction: string
  missingFileStatus: string
  missingFileAction: string
}

const runtimeComponentDefinitions: RuntimeComponentDefinition[] = [
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

export async function inspectLocalRuntime(
  config: LocalRuntimeConfig,
  pathExists: (modelPath: string) => Promise<boolean>,
): Promise<LocalRuntimeSummary> {
  const components = await Promise.all(
    runtimeComponentDefinitions.map(async (definition) => {
      const modelPath = config[definition.pathKey].trim()

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

      const exists = await pathExists(modelPath)

      if (!exists) {
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
  const components = runtimeComponentDefinitions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    modelPath: config[definition.pathKey].trim(),
    ready: false,
    status: config[definition.pathKey].trim() ? definition.missingFileStatus : 'Path not set',
    nextAction: config[definition.pathKey].trim() ? definition.missingFileAction : definition.missingPathAction,
  }))

  return {
    readyCount: 0,
    totalCount: components.length,
    statusText: `0 of ${components.length} runtime components ready`,
    components,
  }
}
