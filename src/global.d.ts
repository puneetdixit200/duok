import type { LocalRuntimeConfig, LocalRuntimeSmokeSummary, LocalRuntimeSummary } from './services/localRuntime'
import type { LearnerDataPayload, LearnerStorageValues } from './services/learnerStore'
import type { NativeExerciseRequest, NativeExerciseResponse } from './services/nativeExercise'

declare global {
  interface Window {
    kannadaOS?: {
      platform: string
      inspectLocalRuntime?: (config: LocalRuntimeConfig) => Promise<LocalRuntimeSummary>
      smokeLocalRuntime?: (config: LocalRuntimeConfig) => Promise<LocalRuntimeSmokeSummary>
      generateNativeExercise?: (request: NativeExerciseRequest) => Promise<NativeExerciseResponse>
      loadLearnerData?: () => Promise<LearnerDataPayload | null>
      saveLearnerData?: (values: LearnerStorageValues) => Promise<LearnerDataPayload>
    }
  }
}

export {}
