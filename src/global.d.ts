import type { LocalRuntimeConfig, LocalRuntimeSmokeSummary, LocalRuntimeSummary } from './services/localRuntime'
import type { LearnerDataPayload, LearnerStorageValues } from './services/learnerStore'

declare global {
  interface Window {
    kannadaOS?: {
      platform: string
      inspectLocalRuntime?: (config: LocalRuntimeConfig) => Promise<LocalRuntimeSummary>
      smokeLocalRuntime?: (config: LocalRuntimeConfig) => Promise<LocalRuntimeSmokeSummary>
      loadLearnerData?: () => Promise<LearnerDataPayload | null>
      saveLearnerData?: (values: LearnerStorageValues) => Promise<LearnerDataPayload>
    }
  }
}

export {}
