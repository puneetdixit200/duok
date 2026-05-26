export interface RecordedAudio {
  audioBytes: Uint8Array
  durationMs: number
  sampleRate: number
}

export interface VoiceCaptureSession {
  stop: () => Promise<RecordedAudio>
}

const defaultMinDurationMs = 300

export async function startVoiceCapture(): Promise<VoiceCaptureSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone recording is not available in this environment.')
  }

  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor) {
    throw new Error('Web Audio recording is not available in this environment.')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })
  const audioContext = new AudioContextCtor()
  const source = audioContext.createMediaStreamSource(stream)
  const processor = audioContext.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  const startedAt = performance.now()
  let stopped = false

  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
  }

  source.connect(processor)
  processor.connect(audioContext.destination)

  return {
    async stop() {
      if (stopped) {
        throw new Error('Recording has already stopped.')
      }

      stopped = true
      processor.disconnect()
      source.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      await audioContext.close()

      const recording: RecordedAudio = {
        audioBytes: encodePcmWav(concatFloat32(chunks), audioContext.sampleRate),
        durationMs: Math.round(performance.now() - startedAt),
        sampleRate: audioContext.sampleRate,
      }
      validateRecordedAudio(recording)
      return recording
    },
  }
}

export function validateRecordedAudio(
  recording: RecordedAudio,
  minDurationMs = defaultMinDurationMs,
): RecordedAudio {
  if (recording.audioBytes.length <= 44) {
    throw new Error('Recorded audio is empty.')
  }

  if (recording.durationMs < minDurationMs) {
    throw new Error(`Record at least ${minDurationMs}ms before transcribing.`)
  }

  return recording
}

export function encodePcmWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2
  const headerLength = 44
  const dataLength = samples.length * bytesPerSample
  const wav = new Uint8Array(headerLength + dataLength)
  const view = new DataView(wav.buffer)

  writeAscii(wav, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(wav, 8, 'WAVE')
  writeAscii(wav, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(wav, 36, 'data')
  view.setUint32(40, dataLength, true)

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample))
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    view.setInt16(headerLength + index * bytesPerSample, Math.round(pcm), true)
  })

  return wav
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const samples = new Float32Array(length)
  let offset = 0

  chunks.forEach((chunk) => {
    samples.set(chunk, offset)
    offset += chunk.length
  })

  return samples
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  Array.from(value).forEach((letter, index) => {
    bytes[offset + index] = letter.charCodeAt(0)
  })
}
