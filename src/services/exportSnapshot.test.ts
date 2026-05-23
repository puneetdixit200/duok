import { describe, expect, it } from 'vitest'
import { buildExportSnapshot, serializeExportSnapshot } from './exportSnapshot'

describe('export snapshot', () => {
  it('packages learner progress, settings, and pronunciation history with a summary', () => {
    const snapshot = buildExportSnapshot({
      exportedAt: '2026-05-23T15:45:00.000Z',
      progress: {
        xp: 42,
        completedExerciseIds: ['survival-translate-1', 'story-first-day-bangalore'],
        reviewQueue: {
          hogbeku: { vocabularyId: 'hogbeku', strength: 0.7, attempts: 3, dueAt: '2026-05-25T00:00:00.000Z' },
        },
      },
      reminder: { enabled: true, time: '8:30 PM', permission: 'granted' },
      runtimeConfig: {
        llmModelPath: '/models/aya.gguf',
        whisperModelPath: '',
        piperVoicePath: '/models/voice.onnx',
      },
      pronunciationHistory: [
        {
          phraseId: 'namaskara-saar',
          transcript: 'ನಮಸ್ಕಾರ ಸಾರ್',
          score: 98,
        },
      ],
    })

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      appName: 'KannadaOS',
      exportedAt: '2026-05-23T15:45:00.000Z',
      summary: {
        completedActivities: 2,
        practicedWords: 1,
        runtimePathsConfigured: 2,
        pronunciationAttempts: 1,
      },
    })
    expect(snapshot.settings.reminder).toEqual({ enabled: true, time: '8:30 PM', permission: 'granted' })
    expect(snapshot.settings.runtimeConfig.llmModelPath).toBe('/models/aya.gguf')
  })

  it('serializes export snapshots as pretty JSON for file or clipboard use', () => {
    const snapshot = buildExportSnapshot({
      exportedAt: '2026-05-23T15:45:00.000Z',
      progress: { completedExerciseIds: [], reviewQueue: {} },
      reminder: { enabled: false, time: '7:30 PM', permission: 'default' },
      runtimeConfig: { llmModelPath: '', whisperModelPath: '', piperVoicePath: '' },
      pronunciationHistory: [],
    })

    const serialized = serializeExportSnapshot(snapshot)

    expect(serialized).toContain('\n  "schemaVersion": 1')
    expect(JSON.parse(serialized)).toEqual(snapshot)
  })
})
