import type { LocalRuntimeConfig } from './localRuntime'
import type { ConversationStore } from './conversationLog'
import type { SanitizedAiProviderSettings } from './hostedProvider'

export interface ExportSnapshotInput {
  exportedAt: string
  progress: unknown
  reminder: unknown
  runtimeConfig: LocalRuntimeConfig
  aiProviderSettings: SanitizedAiProviderSettings
  conversationStore: ConversationStore
  pronunciationHistory: unknown[]
}

export interface ExportSnapshot {
  schemaVersion: 1
  appName: 'KannadaOS'
  exportedAt: string
  summary: {
    completedActivities: number
    practicedWords: number
    runtimePathsConfigured: number
    conversationMessages: number
    pronunciationAttempts: number
  }
  progress: unknown
  settings: {
    reminder: unknown
    runtimeConfig: LocalRuntimeConfig
    aiProviderSettings: SanitizedAiProviderSettings
  }
  conversationStore: ConversationStore
  pronunciationHistory: unknown[]
}

export function buildExportSnapshot(input: ExportSnapshotInput): ExportSnapshot {
  const progress = isRecord(input.progress) ? input.progress : {}
  const completedActivities = Array.isArray(progress.completedExerciseIds)
    ? progress.completedExerciseIds.length
    : 0
  const practicedWords = isRecord(progress.reviewQueue) ? Object.keys(progress.reviewQueue).length : 0
  const runtimePathsConfigured = Object.values(input.runtimeConfig).filter((value) => value.trim()).length
  const conversationMessages = Object.values(input.conversationStore).reduce(
    (total, messages) => total + messages.length,
    0,
  )

  return {
    schemaVersion: 1,
    appName: 'KannadaOS',
    exportedAt: input.exportedAt,
    summary: {
      completedActivities,
      practicedWords,
      runtimePathsConfigured,
      conversationMessages,
      pronunciationAttempts: input.pronunciationHistory.length,
    },
    progress: input.progress,
    settings: {
      reminder: input.reminder,
      runtimeConfig: input.runtimeConfig,
      aiProviderSettings: input.aiProviderSettings,
    },
    conversationStore: input.conversationStore,
    pronunciationHistory: input.pronunciationHistory,
  }
}

export function serializeExportSnapshot(snapshot: ExportSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
