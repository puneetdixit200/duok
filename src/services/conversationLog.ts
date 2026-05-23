export type ConversationSpeaker = 'tutor' | 'learner'

export interface PersistedConversationMessage {
  id: string
  speaker: ConversationSpeaker
  text: string
  subtext?: string
}

export type ConversationStore = Record<string, PersistedConversationMessage[]>

export function hydrateConversationStore(serialized: string | null): ConversationStore {
  if (!serialized) {
    return {}
  }

  try {
    const parsed = JSON.parse(serialized) as unknown
    if (!isRecord(parsed)) {
      return {}
    }

    return Object.entries(parsed).reduce<ConversationStore>((store, [scenarioId, messages]) => {
      if (!Array.isArray(messages)) {
        return store
      }

      const validMessages = messages.filter(isPersistedMessage)
      if (validMessages.length) {
        store[scenarioId] = validMessages
      }

      return store
    }, {})
  } catch {
    return {}
  }
}

export function getScenarioMessages(
  store: ConversationStore,
  scenarioId: string,
  fallbackMessages: PersistedConversationMessage[],
): PersistedConversationMessage[] {
  const messages = store[scenarioId]
  return messages?.length ? messages : fallbackMessages
}

export function appendScenarioMessages(
  store: ConversationStore,
  scenarioId: string,
  messages: PersistedConversationMessage[],
  limit = 50,
): ConversationStore {
  return {
    ...store,
    [scenarioId]: messages.slice(-limit),
  }
}

export function serializeConversationStore(store: ConversationStore): string {
  return JSON.stringify(store)
}

function isPersistedMessage(value: unknown): value is PersistedConversationMessage {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    (value.speaker === 'tutor' || value.speaker === 'learner') &&
    typeof value.text === 'string' &&
    (typeof value.subtext === 'undefined' || typeof value.subtext === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
