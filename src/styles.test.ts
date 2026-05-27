import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8')

describe('KannadaOS frontend motion and accessibility styles', () => {
  it('defines the frontend spec design-system palette and Kannada font stack', () => {
    [
      '--color-primary: #58CC02',
      '--color-primary-dark: #46A302',
      '--color-accent: #FF9600',
      '--color-accent-gold: #FFC800',
      '--color-error: #FF4B4B',
      '--color-background: #131F24',
      '--color-surface: #1B2B33',
      '--color-surface-light: #233A44',
      '--text-primary: #FFFFFF',
      '--text-secondary: #A0B4BD',
      '--text-muted: #5C7A87',
      '--color-border: #2D4A55',
    ].forEach((token) => {
      expect(styles).toContain(token)
    })

    expect(styles).toMatch(/font-family:\s*"Noto Sans Kannada",\s*"Noto Sans",\s*Inter/s)
    expect(styles).not.toContain('#7c3aed')
  })

  it('implements the frontend spec animation keyframes and reduced-motion fallback', () => {
    [
      'correctPulse',
      'wrongShake',
      'floatUp',
      'confettiFall',
      'gemBounce',
      'numberRoll',
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
    expect(styles).toMatch(/\.quest-claim-action\s*{[^}]*animation:\s*pulseGlow/s)
    expect(styles).toMatch(/\.gem-counter\.rolling\s*{[^}]*animation:[^}]*gemBounce[^}]*numberRoll/s)
    expect(styles).toMatch(/\.flashcard\s*{[^}]*transition:[^}]*transform/s)
    expect(styles).toMatch(/\.flashcard:hover\s*{[^}]*transform:\s*rotateY/s)
    expect(styles).toMatch(/\.speaker-button\s*{[^}]*animation:\s*pulseGlow/s)
    expect(styles).toMatch(/\.speaker-button\.recording\s*{[^}]*animation:\s*recordingPulse/s)
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('keeps visible focus indicators on interactive controls', () => {
    expect(styles).toMatch(/:focus-visible\s*{[^}]*outline:\s*3px solid var\(--color-accent-gold\)/s)
    expect(styles).toMatch(/:focus-visible\s*{[^}]*outline-offset:\s*3px/s)
  })

  it('uses scalable text sizing without viewport-based font scaling', () => {
    expect(styles).not.toMatch(/font-size:\s*[^;]*(?:px|vw)/)
    expect(styles).toMatch(/\.phrase-card strong\s*{[^}]*font-size:\s*2\.5rem/s)
    expect(styles).toMatch(/\.story-sentence-english\s*{[^}]*font-size:\s*1\.875rem/s)
  })
})
