import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { playSoundEffect, soundEffectSources } from './soundEffects'

describe('sound effects', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ships a bundled audio file for every frontend spec sound effect', () => {
    expect(soundEffectSources).toEqual({
      correct: './sounds/correct.wav',
      wrong: './sounds/wrong.wav',
      lessonComplete: './sounds/lesson-complete.wav',
      streak: './sounds/streak.wav',
      gemEarn: './sounds/gem-earn.wav',
      tap: './sounds/tap.wav',
      flip: './sounds/flip.wav',
    })

    for (const source of Object.values(soundEffectSources)) {
      expect(fs.existsSync(path.join(process.cwd(), 'public', source))).toBe(true)
    }
  })

  it('plays a sound through the browser Audio API only when enabled', () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const AudioMock = vi.fn(function mockAudio(this: { play: typeof play }) {
      this.play = play
    })
    vi.stubGlobal('Audio', AudioMock)

    expect(playSoundEffect('correct', true)).toBe(true)
    expect(AudioMock).toHaveBeenCalledWith('./sounds/correct.wav')
    expect(play).toHaveBeenCalledTimes(1)

    expect(playSoundEffect('wrong', false)).toBe(false)
    expect(AudioMock).toHaveBeenCalledTimes(1)
  })
})
