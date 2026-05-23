import { describe, expect, it } from 'vitest'
import { scorePronunciation } from './pronunciation'

describe('pronunciation scoring', () => {
  it('scores clear speech highly with no problem syllables', () => {
    const result = scorePronunciation({
      expectedText: 'ನಮಸ್ಕಾರ ಸಾರ್',
      expectedTransliteration: 'namaskara saar',
      transcript: 'ನಮಸ್ಕಾರ ಸಾರ್',
      targetParts: ['ನಮಸ್ಕಾರ', 'ಸಾರ್'],
    })

    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.level).toBe('clear')
    expect(result.problemParts).toEqual([])
    expect(result.feedback).toMatch(/clear/i)
    expect(result.tip).toMatch(/keep/i)
  })

  it('flags missing phrase parts and returns a specific practice tip', () => {
    const result = scorePronunciation({
      expectedText: 'ನಮಸ್ಕಾರ ಸಾರ್',
      expectedTransliteration: 'namaskara saar',
      transcript: 'ನಮಸ್ಕಾರ',
      targetParts: ['ನಮಸ್ಕಾರ', 'ಸಾರ್'],
    })

    expect(result.score).toBeLessThan(90)
    expect(result.level).toBe('steady')
    expect(result.problemParts).toEqual(['ಸಾರ್'])
    expect(result.feedback).toMatch(/almost/i)
    expect(result.tip).toBe('Hold the ending: ಸಾರ್.')
  })

  it('normalizes punctuation and whitespace before scoring', () => {
    const result = scorePronunciation({
      expectedText: 'ಟಿಕೆಟ್ ಎಷ್ಟು?',
      expectedTransliteration: 'ticket eshtu?',
      transcript: 'ಟಿಕೆಟ್   ಎಷ್ಟು',
      targetParts: ['ಟಿಕೆಟ್', 'ಎಷ್ಟು'],
    })

    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.level).toBe('clear')
  })
})
