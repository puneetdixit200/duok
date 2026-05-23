import { describe, expect, it } from 'vitest'
import {
  bangaloreScenarios,
  getExerciseCoverage,
  getLevelOneCurriculum,
} from './curriculum'

describe('KannadaOS level 1 curriculum', () => {
  it('ships at least 20 survival phrases with Kannada, transliteration, English, and Bangalore context', () => {
    const curriculum = getLevelOneCurriculum()

    expect(curriculum.level).toBe(1)
    expect(curriculum.title).toMatch(/survival/i)
    expect(curriculum.phrases).toHaveLength(20)
    expect(
      curriculum.phrases.every(
        (phrase) =>
          phrase.kannada.length > 0 &&
          phrase.transliteration.length > 0 &&
          phrase.english.length > 0 &&
          phrase.context.length > 0,
      ),
    ).toBe(true)
    expect(curriculum.phrases.some((phrase) => phrase.kannada === 'ನಮಸ್ಕಾರ ಸಾರ್')).toBe(true)
    expect(curriculum.phrases.some((phrase) => /Majestic|BMTC|auto/i.test(phrase.context))).toBe(
      true,
    )
  })

  it('covers every MVP exercise type from the architecture spec', () => {
    expect(getExerciseCoverage()).toEqual([
      'translate',
      'arrange',
      'fillBlank',
      'listening',
      'speaking',
      'matchPairs',
    ])
  })

  it('includes real-world Bangalore scenarios for conversation practice', () => {
    expect(bangaloreScenarios.map((scenario) => scenario.id)).toEqual([
      'bmtc-bus',
      'auto-ride',
      'darshini',
      'kirana',
      'office',
      'pg-owner',
    ])
    expect(bangaloreScenarios[0].checklist).toContain('Ask the fare')
    expect(bangaloreScenarios[1].openingLine.kannada).toContain('ಎಲ್ಲಿಗೆ')
  })
})
