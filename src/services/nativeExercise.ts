import type { LocalRuntimeConfig } from './localRuntime'
import {
  buildExercisePrompt,
  fallbackExercise,
  parseGeneratedExerciseResponse,
  type ExerciseGenerationResult,
} from './ollama'

export interface NativeExerciseRequest {
  runtimeConfig: LocalRuntimeConfig
  prompt: string
}

export interface NativeExerciseResponse {
  ok: boolean
  response: string
  error?: string
}

interface GenerateNativeExerciseOptions {
  runtimeConfig: LocalRuntimeConfig
  weakArea: string
  generateNativeExercise: (request: NativeExerciseRequest) => Promise<NativeExerciseResponse>
}

export async function generateExerciseWithNativeRuntime({
  runtimeConfig,
  weakArea,
  generateNativeExercise,
}: GenerateNativeExerciseOptions): Promise<ExerciseGenerationResult> {
  const fallback = fallbackExercise(weakArea)

  try {
    const prompt = buildExercisePrompt(weakArea)
    const result = await generateNativeExercise({ runtimeConfig, prompt })

    if (!result.ok) {
      return { source: 'fallback', exercise: fallback, error: result.error ?? 'Native runtime failed' }
    }

    return {
      source: 'native',
      exercise: parseGeneratedExerciseResponse(result.response),
    }
  } catch (error) {
    return {
      source: 'fallback',
      exercise: fallback,
      error: error instanceof Error ? error.message : 'Unknown native runtime failure',
    }
  }
}
