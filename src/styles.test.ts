import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')

describe('KannadaOS frontend motion and accessibility styles', () => {
  it('implements the frontend spec animation keyframes and reduced-motion fallback', () => {
    [
      'correctPulse',
      'wrongShake',
      'floatUp',
      'confettiFall',
      'pulseGlow',
      'heartBreak',
      'recordingPulse',
    ].forEach((keyframe) => {
      expect(styles).toContain(`@keyframes ${keyframe}`)
    })

    expect(styles).toMatch(/\.feedback\.correct\s*{[^}]*animation:\s*correctPulse/s)
    expect(styles).toMatch(/\.feedback\.wrong\s*{[^}]*animation:\s*wrongShake/s)
    expect(styles).toMatch(/\.feedback strong\s*{[^}]*animation:\s*floatUp/s)
    expect(styles).toMatch(/\.confetti-burst span\s*{[^}]*animation:\s*confettiFall/s)
    expect(styles).toMatch(/\.flashcard\s*{[^}]*transition:[^}]*transform/s)
    expect(styles).toMatch(/\.flashcard:hover\s*{[^}]*transform:\s*rotateY/s)
    expect(styles).toMatch(/\.speaker-button\s*{[^}]*animation:\s*pulseGlow/s)
    expect(styles).toMatch(/\.speaker-button\.recording\s*{[^}]*animation:\s*recordingPulse/s)
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('keeps visible focus indicators on interactive controls', () => {
    expect(styles).toMatch(/:focus-visible\s*{[^}]*outline:\s*3px solid #ffbc8a/s)
    expect(styles).toMatch(/:focus-visible\s*{[^}]*outline-offset:\s*3px/s)
  })
})
