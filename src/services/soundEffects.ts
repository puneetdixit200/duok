export const soundEffectSources = {
  correct: './sounds/correct.wav',
  wrong: './sounds/wrong.wav',
  lessonComplete: './sounds/lesson-complete.wav',
  streak: './sounds/streak.wav',
  gemEarn: './sounds/gem-earn.wav',
  tap: './sounds/tap.wav',
  flip: './sounds/flip.wav',
} as const

export type SoundEffectName = keyof typeof soundEffectSources

export function playSoundEffect(name: SoundEffectName, enabled: boolean): boolean {
  if (!enabled || typeof Audio === 'undefined') {
    return false
  }

  if (isUnmockedJsdomAudio()) {
    return false
  }

  const audio = new Audio(soundEffectSources[name])
  const playResult = audio.play()

  if (playResult && typeof playResult.catch === 'function') {
    void playResult.catch(() => undefined)
  }

  return true
}

function isUnmockedJsdomAudio(): boolean {
  const audioCtor = Audio as typeof Audio & { _isMockFunction?: boolean }

  return (
    typeof navigator !== 'undefined' &&
    /jsdom/i.test(navigator.userAgent) &&
    !audioCtor._isMockFunction
  )
}
