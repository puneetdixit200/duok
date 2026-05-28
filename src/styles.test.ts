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
      'starBurst',
      'crownFill',
      'streakFire',
      'flameParticle',
      'pulseGlow',
      'heartBreak',
      'recordingPulse',
    ].forEach((keyframe) => {
      expect(styles).toContain(`@keyframes ${keyframe}`)
    })

    expect(styles).toMatch(/\.feedback\.correct\s*{[^}]*animation:\s*correctPulse/s)
    expect(styles).toMatch(/\.feedback\.wrong\s*{[^}]*animation:\s*wrongShake/s)
    expect(styles).toMatch(/\.feedback strong\s*{[^}]*animation:\s*floatUp/s)
    expect(styles).toMatch(/\.heart-loss-indicator\s*{[^}]*animation:\s*heartBreak/s)
    expect(styles).toMatch(/\.confetti-burst span\s*{[^}]*animation:\s*confettiFall/s)
    expect(styles).toMatch(/\.lesson-complete \.star-row span\s*{[^}]*animation:\s*starBurst/s)
    expect(styles).toMatch(/\.crown-fill-row span\.filled\s*{[^}]*animation:\s*crownFill/s)
    expect(styles).toMatch(/\.nav-flame\s*{[^}]*animation:\s*streakFire/s)
    expect(styles).toMatch(/\.nav-flame::before,\s*\.nav-flame::after\s*{[^}]*animation:\s*flameParticle/s)
    expect(styles).toMatch(/\.quest-claim-action\s*{[^}]*animation:\s*pulseGlow/s)
    expect(styles).toMatch(/\.gem-counter\.rolling\s*{[^}]*animation:[^}]*gemBounce[^}]*numberRoll/s)
    expect(styles).toMatch(/\.flashcard\s*{[^}]*transition:[^}]*transform/s)
    expect(styles).toMatch(/\.flashcard:hover\s*{[^}]*transform:\s*rotateY/s)
    expect(styles).toMatch(/\.speaker-button\s*{[^}]*animation:\s*pulseGlow/s)
    expect(styles).toMatch(/\.speaker-button\.recording\s*{[^}]*animation:\s*recordingPulse/s)
    expect(styles).toMatch(/\.voice-action\.recording\s*{[^}]*animation:\s*recordingPulse/s)
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('keeps visible focus indicators on interactive controls', () => {
    expect(styles).toMatch(/:focus-visible\s*{[^}]*outline:\s*3px solid var\(--color-accent-gold\)/s)
    expect(styles).toMatch(/:focus-visible\s*{[^}]*outline-offset:\s*3px/s)
  })

  it('styles dashboard progress and empty-heart states from the frontend spec', () => {
    expect(styles).toMatch(/\.daily-progress-ring\s*{[^}]*background:\s*conic-gradient\(var\(--color-primary\)/s)
    expect(styles).toMatch(/\.daily-progress-track span\s*{[^}]*background:\s*linear-gradient\(90deg,\s*var\(--color-primary\)/s)
    expect(styles).toMatch(/\.top-counters \.heart-counter\s*{[^}]*color:\s*var\(--color-error\)/s)
    expect(styles).toMatch(/\.top-counters \.heart-counter\.empty\s*{[^}]*opacity:\s*0\.56/s)
  })

  it('styles the Learn tab lesson list as readable lesson rows', () => {
    expect(styles).toMatch(/\.lesson-dot-row\s*{[^}]*display:\s*grid/s)
    expect(styles).toMatch(/\.lesson-dot\s*{[^}]*grid-template-columns:\s*34px minmax\(0,\s*1fr\) auto/s)
    expect(styles).toContain('.lesson-row-copy')
    expect(styles).toContain('.lesson-crown-rating')
  })

  it('uses scalable text sizing without viewport-based font scaling', () => {
    expect(styles).not.toMatch(/font-size:\s*[^;]*(?:px|vw)/)
    expect(styles).toMatch(/\.phrase-card strong\s*{[^}]*font-size:\s*2\.5rem/s)
    expect(styles).toMatch(/\.story-sentence-english\s*{[^}]*font-size:\s*1\.875rem/s)
  })
})
