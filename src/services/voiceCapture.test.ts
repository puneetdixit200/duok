import { describe, expect, it } from 'vitest'
import { encodePcmWav, validateRecordedAudio, type RecordedAudio } from './voiceCapture'

describe('voice capture audio encoding', () => {
  it('encodes mono float samples as a 16-bit PCM WAV file', () => {
    const wav = encodePcmWav(new Float32Array([0, -1, 1, 0.5]), 16000)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)

    expect(readAscii(wav, 0, 4)).toBe('RIFF')
    expect(readAscii(wav, 8, 4)).toBe('WAVE')
    expect(readAscii(wav, 12, 4)).toBe('fmt ')
    expect(readAscii(wav, 36, 4)).toBe('data')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(8)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(-32768)
    expect(view.getInt16(48, true)).toBe(32767)
    expect(view.getInt16(50, true)).toBe(16384)
  })

  it('rejects empty and too-short recordings before Whisper is invoked', () => {
    const emptyRecording: RecordedAudio = {
      audioBytes: new Uint8Array(),
      durationMs: 0,
      sampleRate: 16000,
    }
    const emptyWavRecording: RecordedAudio = {
      audioBytes: encodePcmWav(new Float32Array(), 16000),
      durationMs: 500,
      sampleRate: 16000,
    }
    const shortRecording: RecordedAudio = {
      audioBytes: encodePcmWav(new Float32Array(800), 16000),
      durationMs: 50,
      sampleRate: 16000,
    }

    expect(() => validateRecordedAudio(emptyRecording)).toThrow(/empty/i)
    expect(() => validateRecordedAudio(emptyWavRecording)).toThrow(/empty/i)
    expect(() => validateRecordedAudio(shortRecording, 300)).toThrow(/at least 300ms/i)
  })
})

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}
