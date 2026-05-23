import type { LocalRuntimeConfig, LocalRuntimeSummary } from './services/localRuntime'

declare global {
  interface Window {
    kannadaOS?: {
      platform: string
      inspectLocalRuntime?: (config: LocalRuntimeConfig) => Promise<LocalRuntimeSummary>
    }
  }
}

export {}
