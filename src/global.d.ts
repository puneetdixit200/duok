import type { LocalRuntimeConfig, LocalRuntimeSmokeSummary, LocalRuntimeSummary } from './services/localRuntime'
import type { LearnerDataPayload, LearnerStorageValues } from './services/learnerStore'
import type { NativeExerciseRequest, NativeExerciseResponse } from './services/nativeExercise'

interface NativeTranscriptionRequest {
  runtimeConfig: LocalRuntimeConfig
  audioPath: string
}

interface NativeTranscriptionResponse {
  ok: boolean
  text: string
  error?: string
}

interface NativeSpeechRequest {
  runtimeConfig: LocalRuntimeConfig
  text: string
}

interface NativeSpeechResponse {
  ok: boolean
  audioPath: string
  error?: string
}

declare global {
  interface Window {
    kannadaOS?: {
      platform: string
      inspectLocalRuntime?: (config: LocalRuntimeConfig) => Promise<LocalRuntimeSummary>
      smokeLocalRuntime?: (config: LocalRuntimeConfig) => Promise<LocalRuntimeSmokeSummary>
      generateNativeExercise?: (request: NativeExerciseRequest) => Promise<NativeExerciseResponse>
      transcribeNativeAudio?: (request: NativeTranscriptionRequest) => Promise<NativeTranscriptionResponse>
      synthesizeNativeSpeech?: (request: NativeSpeechRequest) => Promise<NativeSpeechResponse>
      loadLearnerData?: () => Promise<LearnerDataPayload | null>
      saveLearnerData?: (values: LearnerStorageValues) => Promise<LearnerDataPayload>
    }
  }
}

export {}
