export const learnerStorageKeys = [
  'kannadaos:onboarded',
  'kannadaos:learner-profile',
  'kannadaos:sound-prefs',
  'kannadaos:progress',
  'kannadaos:reminder',
  'kannadaos:local-runtime',
  'kannadaos:ai-provider',
  'kannadaos:pronunciation-history',
  'kannadaos:conversation-log',
  'kannadaos:ai-expansion',
] as const

export type LearnerStorageKey = (typeof learnerStorageKeys)[number]
export type LearnerStorageValues = Partial<Record<LearnerStorageKey, string>>

export interface LearnerDataPayload {
  schemaVersion: 1
  appName: 'KannadaOS'
  savedAt: string
  values: Record<string, string>
}

const learnerStorageKeySet = new Set<string>(learnerStorageKeys)

export function collectLearnerStorage(storage: Pick<Storage, 'getItem'>): LearnerStorageValues {
  return learnerStorageKeys.reduce<LearnerStorageValues>((values, key) => {
    const value = storage.getItem(key)
    if (value !== null) {
      values[key] = value
    }
    return values
  }, {})
}

export function applyLearnerStorage(payload: unknown, storage: Pick<Storage, 'setItem'>): boolean {
  const data = hydrateLearnerData(payload)
  if (!data) {
    return false
  }

  Object.entries(data.values).forEach(([key, value]) => {
    if (learnerStorageKeySet.has(key)) {
      storage.setItem(key, value)
    }
  })

  return true
}

export function hydrateLearnerData(payload: unknown): LearnerDataPayload | null {
  if (!isRecord(payload)) {
    return null
  }

  if (payload.schemaVersion !== 1 || payload.appName !== 'KannadaOS' || typeof payload.savedAt !== 'string') {
    return null
  }

  if (!isRecord(payload.values)) {
    return null
  }

  return {
    schemaVersion: 1,
    appName: 'KannadaOS',
    savedAt: payload.savedAt,
    values: Object.entries(payload.values).reduce<Record<string, string>>((values, [key, value]) => {
      if (learnerStorageKeySet.has(key) && typeof value === 'string') {
        values[key] = value
      }
      return values
    }, {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
