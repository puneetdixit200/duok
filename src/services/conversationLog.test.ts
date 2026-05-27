import { describe, expect, it } from 'vitest'
import {
  appendScenarioMessages,
  getScenarioMessages,
  hydrateConversationStore,
  serializeConversationStore,
} from './conversationLog'

describe('conversation log persistence', () => {
  it('hydrates empty or invalid conversation storage safely', () => {
    expect(hydrateConversationStore(null)).toEqual({})
    expect(hydrateConversationStore('{ broken json')).toEqual({})
    expect(hydrateConversationStore('[]')).toEqual({})
  })

  it('stores and restores messages by scenario with fallback openings', () => {
    const store = appendScenarioMessages(
      {},
      'auto-ride',
      [
        { id: 'opening', speaker: 'tutor', text: 'ಸಾರ್, ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು?' },
        { id: 'user-1', speaker: 'learner', text: 'Majestic hogbeku' },
      ],
    )

    expect(getScenarioMessages(store, 'auto-ride', [])).toEqual([
      { id: 'opening', speaker: 'tutor', text: 'ಸಾರ್, ಎಲ್ಲಿಗೆ ಹೋಗಬೇಕು?' },
      { id: 'user-1', speaker: 'learner', text: 'Majestic hogbeku' },
    ])
    expect(getScenarioMessages(store, 'bmtc-bus', [{ id: 'bmtc', speaker: 'tutor', text: 'ಟಿಕೆಟ್!' }])).toEqual([
      { id: 'bmtc', speaker: 'tutor', text: 'ಟಿಕೆಟ್!' },
    ])
  })

  it('serializes only the latest bounded scenario messages', () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({
      id: `message-${index}`,
      speaker: index % 2 === 0 ? 'tutor' : 'learner',
      text: `message ${index}`,
    }))

    const store = appendScenarioMessages({}, 'auto-ride', messages, 50)
    const restored = hydrateConversationStore(serializeConversationStore(store))

    expect(restored['auto-ride']).toHaveLength(50)
    expect(restored['auto-ride'][0].id).toBe('message-10')
    expect(restored['auto-ride'][49].id).toBe('message-59')
  })

  it('trims legacy oversized hydrated scenario logs to the spec limit', () => {
    const serialized = JSON.stringify({
      'auto-ride': Array.from({ length: 55 }, (_, index) => ({
        id: `legacy-${index}`,
        speaker: index % 2 === 0 ? 'tutor' : 'learner',
        text: `legacy message ${index}`,
      })),
    })

    const restored = hydrateConversationStore(serialized)

    expect(restored['auto-ride']).toHaveLength(50)
    expect(restored['auto-ride'][0].id).toBe('legacy-5')
    expect(restored['auto-ride'][49].id).toBe('legacy-54')
  })
})
