const { _electron: electron } = require('playwright')
const childProcess = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function main() {
  const rootDir = path.join(__dirname, '..')
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-runtime-'))
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-user-data-'))
  const runtimePaths = createRuntimePlaceholders(runtimeDir)
  seedLearnerStore(userDataDir, runtimePaths)
  const app = await electron.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${runtimePaths.fakeMicAudioPath}`,
      rootDir,
    ],
    env: { ...process.env, E2E: '1', KANNADAOS_USER_DATA_DIR: userDataDir },
  })
  const pageErrors = []
  const consoleErrors = []

  try {
    const page = await app.firstWindow()

    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    await page.getByRole('button', { name: /continue onboarding/i }).waitFor()
    await page.waitForFunction(() =>
      localStorage.getItem('kannadaos:local-runtime')?.includes('whisper-small.bin'),
    )
    await page.getByRole('button', { name: /continue onboarding/i }).click()
    await page.getByRole('button', { name: /moved to bangalore/i }).click()
    await page.getByRole('button', { name: /next: choose level/i }).click()
    await page.getByRole('button', { name: /zero/i }).click()
    await page.getByRole('button', { name: /next: set goal/i }).click()
    await page.getByRole('button', { name: /10 XP/i }).click()
    await page.getByRole('button', { name: /start learning/i }).click()
    await page.getByRole('button', { name: /continue: greetings/i }).click()
    await completeLesson(page)
    await page.getByRole('button', { name: /back to home/i }).click()

    await page.getByRole('button', { name: /chat/i }).click()
    await page.getByPlaceholder(/type in kannada/i).fill('Majestic hogbeku')
    await page.getByRole('button', { name: /send/i }).click()
    await page.getByText('Majestic-ge hogbeku is better.').waitFor()
    await page.reload()
    await page.getByRole('button', { name: /chat/i }).click()
    await page.getByText('Majestic hogbeku').waitFor()
    await page.getByText('Majestic-ge hogbeku is better.').waitFor()
    await page.getByRole('button', { name: /BMTC Bus/i }).click()
    await page.getByRole('heading', { name: /BMTC Bus/i }).waitFor()
    await page.getByRole('button', { name: /Grammar Teacher/i }).click()
    await page.getByRole('button', { name: /record voice/i }).click()
    await page.getByText(/Recording... click Stop Recording when done/i).waitFor()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: /stop recording/i }).click()
    await page.getByText(/Voice transcript ready: ನಮಸ್ಕಾರ ಸಾರ್/i).waitFor()
    await page.locator('.chat-stream').getByText('ನಮಸ್ಕಾರ ಸಾರ್', { exact: true }).waitFor()

    await page.getByRole('button', { name: /practice/i }).click()
    await page.getByRole('button', { name: /^English: need to go\s+ಹೋಗಬೇಕು\s+Say: hogbeku/i }).click()
    await page.getByText('need to go', { exact: true }).waitFor()
    await page.getByText(/Adaptive difficulty: Steady/i).waitFor()
    await page.getByRole('heading', { name: /Pronunciation Lab/i }).waitFor()
    await page.getByRole('button', { name: /play reference/i }).click()
    await page.getByText(/Piper audio ready:/i).waitFor()
    await page.getByLabel(/Transcribed speech/i).fill('ನಮಸ್ಕಾರ ಸಾರ್')
    await page.getByRole('button', { name: /score pronunciation/i }).click()
    await page.locator('[aria-label="Pronunciation result"]').getByText(/Score 100/i).waitFor()
    await page.getByText(/No problem syllables/i).waitFor()
    await page.getByText(/Latest attempt: ನಮಸ್ಕಾರ ಸಾರ್/i).waitFor()

    await page.getByRole('button', { name: /stories/i }).click()
    await page.getByRole('heading', { name: /Stories/i }).waitFor()
    await page.getByRole('button', { name: /read first day in bangalore/i }).click()
    await page.getByText(/ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ/i).waitFor()
    await page.getByRole('button', { name: /play sentence audio/i }).first().click()
    await page.getByText(/Story Piper audio ready:|Playing story audio:/i).waitFor()
    await page.getByRole('button', { name: /^English: came\s+ಬಂದ\s+Say: banda/i }).click()
    await page.getByRole('dialog', { name: /ಬಂದ/i }).waitFor()
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByText('2/3', { exact: true }).waitFor()
    await page.getByRole('button', { name: /next/i }).click()
    await page.getByText('3/3', { exact: true }).waitFor()
    await page.getByRole('button', { name: /take quiz/i }).click()
    await page.getByRole('button', { name: /He does not know Kannada yet/i }).click()
    await page.getByRole('button', { name: /check story answer/i }).click()
    await page.getByRole('heading', { name: /Story Complete/i }).waitFor()
    await page.waitForFunction(() => {
      const progress = JSON.parse(localStorage.getItem('kannadaos:progress') || '{}')
      return progress.xp === 38
    })

    await page.getByRole('button', { name: /blr/i }).click()
    await page.getByText('Auto Ride', { exact: true }).waitFor()
    await page.getByRole('button', { name: /^me$/i }).click()
    await page.getByText(/Level 4 Learner/i).waitFor()
    await page.getByLabel('38 XP').waitFor()
    await page.getByText(/Story Starter/i).waitFor()
    await page.getByText(/6\/6 lesson exercises/i).waitFor()
    await page.getByRole('button', { name: /enable daily reminder/i }).click()
    await page.getByRole('button', { name: /8:30 PM/i }).click()
    await page.getByRole('button', { name: /allow reminder alerts/i }).click()
    await page.getByText(/Reminder On - 8:30 PM/i).waitFor()
    await page.getByText(/Alerts allowed/i).waitFor()
    await page.getByRole('button', { name: /export data/i }).click()
    await page.getByText(/Export ready:/i).waitFor()
    await page.getByTestId('export-preview').getByText(/"schemaVersion": 1/i).waitFor()
    await page.getByTestId('export-preview').getByText(/"appName": "KannadaOS"/i).waitFor()
    await page.getByTestId('export-preview').getByText(/"conversationMessages": 6/i).waitFor()
    await page.getByText(/Desktop data synced/i).waitFor()
    await page.waitForFunction(async () => {
      const data = await window.kannadaOS?.loadLearnerData?.()
      const progress = data?.values?.['kannadaos:progress'] ?? ''
      const conversations = data?.values?.['kannadaos:conversation-log'] ?? ''
      const pronunciation = data?.values?.['kannadaos:pronunciation-history'] ?? ''

      return (
        progress.includes('"xp":38') &&
        conversations.includes('Majestic hogbeku') &&
        pronunciation.includes('namaskara-saar')
      )
    })
    await page.getByRole('button', { name: /manage ai models/i }).click()
    await page.getByRole('heading', { name: /Setting up your AI Teacher/i }).waitFor()
    await page.getByText(/Aya 8B Q4/i).waitFor()
    await page.getByText(/Whisper Small/i).waitFor()
    await page.getByText(/Piper Kannada Voice/i).waitFor()
    await page.getByRole('heading', { name: /Choose Generation Provider/i }).waitFor()
    await page.getByLabel(/Active AI provider/i).selectOption('openrouter')
    await page.getByLabel(/OpenRouter API key/i).fill('sk-or-e2e-placeholder')
    await page.getByLabel(/OpenRouter model/i).fill('openai/gpt-4o-mini')
    await page.getByText('OpenRouter ready', { exact: true }).waitFor()
    await page.getByLabel(/Active AI provider/i).selectOption('local')
    await page.getByText('Local first selected', { exact: true }).waitFor()
    await page.getByRole('heading', { name: /On-device Runtime/i }).waitFor()
    await page.getByText(/0 of 3 runtime components ready/i).waitFor()
    await page.getByLabel(/Aya GGUF model path/i).fill(runtimePaths.llmModelPath)
    await page.getByLabel(/Llama.cpp executable path/i).fill(runtimePaths.llamaBinaryPath)
    await page.getByLabel(/Whisper model path/i).fill(runtimePaths.whisperModelPath)
    await page.getByLabel(/Whisper.cpp executable path/i).fill(runtimePaths.whisperBinaryPath)
    await page.getByLabel(/Piper voice path/i).fill(runtimePaths.piperVoicePath)
    await page.getByLabel(/Piper executable path/i).fill(runtimePaths.piperBinaryPath)
    await page.getByRole('button', { name: /check local runtime/i }).click()
    await page.getByText(/3 of 3 runtime components ready/i).waitFor()
    await page.getByText(/Llama.cpp LLM/i).waitFor()
    await page.getByText(/Whisper.cpp STT/i).waitFor()
    await page.getByText(/Piper TTS/i).waitFor()
    await page.getByRole('button', { name: /run runtime smoke/i }).click()
    await page.getByText(/3 of 3 native commands responded/i).waitFor()
    await page.getByRole('button', { name: /start model setup/i }).click()
    await page.getByRole('button', { name: /setup in progress/i }).waitFor()
    await page.getByText(/78%/i).waitFor()
    await page.getByText(/Downloaded/i).waitFor()
    await page.getByText(/Waiting/i).waitFor()
    await page.getByLabel(/Back to app/i).click()
    await page.getByRole('button', { name: /generate ai exercise/i }).click()
    await page.getByText(/Native: Native commute drill ಹೋಗಬೇಕು/i).waitFor()
    await page.getByRole('button', { name: /practice/i }).click()
    await page.getByLabel(/Audio file path/i).fill(runtimePaths.sampleAudioPath)
    await page.getByRole('button', { name: /transcribe with whisper/i }).click()
    await page.getByText(/Whisper transcript ready/i).waitFor()
    await page.waitForFunction(() => {
      const input = [...document.querySelectorAll('input')].find((element) =>
        element.labels?.[0]?.textContent?.includes('Transcribed speech'),
      )
      return input?.value === 'ನಮಸ್ಕಾರ ಸಾರ್'
    })
    await page.getByRole('button', { name: /record pronunciation/i }).click()
    await page.getByText(/Recording... click Stop Recording when done/i).waitFor()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: /stop recording/i }).click()
    await page.getByText(/Voice transcript ready: ನಮಸ್ಕಾರ ಸಾರ್/i).waitFor()
    await page.getByRole('button', { name: /play reference/i }).click()
    await page.getByText(/Piper audio ready:/i).waitFor()

    const ollama = await probeOllama()
    if (ollama.online) {
      await page.getByText(/Local \+ Ollama/i).waitFor({ timeout: 3000 })
      console.log(`Ollama live smoke: online (${ollama.models.join(', ') || 'no models listed'})`)
    } else {
      await page.getByText(/Local fallback|Checking/i).waitFor({ timeout: 3000 })
      console.log('Ollama live smoke: unavailable, offline fallback visible')
    }

    await page.getByRole('button', { name: /^me$/i }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /reset all progress/i }).click()
    await page.getByText(/Progress reset. Your AI model paths and hosted AI keys were kept./i).waitFor()
    await page.getByLabel('0 XP').waitFor()
    await page.waitForFunction(async () => {
      const data = await window.kannadaOS?.loadLearnerData?.()
      const progress = data?.values?.['kannadaos:progress'] ?? ''
      const conversations = data?.values?.['kannadaos:conversation-log'] ?? ''
      const pronunciation = data?.values?.['kannadaos:pronunciation-history'] ?? ''
      const provider = data?.values?.['kannadaos:ai-provider'] ?? ''

      return (
        progress.includes('"xp":0') &&
        conversations === '{}' &&
        pronunciation === '[]' &&
        provider.includes('sk-or-e2e-placeholder')
      )
    })

    if (pageErrors.length || consoleErrors.length) {
      throw new Error(
        [
          ...pageErrors.map((error) => `pageerror: ${error}`),
          ...consoleErrors.map((error) => `console.error: ${error}`),
        ].join('\n'),
      )
    }
  } finally {
    try {
      await closeElectron(app)
      killLeftoverElectronHelpers(userDataDir)
    } finally {
      fs.rmSync(runtimeDir, { recursive: true, force: true })
      fs.rmSync(userDataDir, { recursive: true, force: true })
    }
  }
}

function createRuntimePlaceholders(runtimeDir) {
  const runtimePaths = {
    llmModelPath: path.join(runtimeDir, 'aya-8b-q4_K_M.gguf'),
    whisperModelPath: path.join(runtimeDir, 'whisper-small.bin'),
    piperVoicePath: path.join(runtimeDir, 'kn_IN-piper-medium.onnx'),
    llamaBinaryPath: path.join(runtimeDir, 'llama-cli'),
    whisperBinaryPath: path.join(runtimeDir, 'whisper-cli'),
    piperBinaryPath: path.join(runtimeDir, 'piper'),
    sampleAudioPath: path.join(runtimeDir, 'namaskara.wav'),
    fakeMicAudioPath: path.join(runtimeDir, 'fake-mic.wav'),
  }

  Object.entries(runtimePaths).forEach(([key, runtimePath]) => {
    if (key.endsWith('BinaryPath')) {
      const script =
        key === 'llamaBinaryPath'
          ? [
              '#!/bin/sh',
              'if [ "$1" = "--help" ]; then',
              '  echo KannadaOS runtime smoke',
              'else',
              '  echo \'{"type":"translate","prompt":"Native commute drill","kannada":"ಹೋಗಬೇಕು","answer":"need to go","options":["need to go"],"explanation":"Generated through the native llama.cpp bridge."}\'',
              'fi',
              '',
            ].join('\n')
          : key === 'whisperBinaryPath'
            ? [
                '#!/bin/sh',
                'if [ "$1" = "--help" ]; then',
                '  echo KannadaOS runtime smoke',
                'else',
                '  echo "[00:00:00.000 --> 00:00:01.100]  ನಮಸ್ಕಾರ ಸಾರ್"',
                'fi',
                '',
              ].join('\n')
            : [
                '#!/bin/sh',
                'if [ "$1" = "--help" ]; then',
                '  echo KannadaOS runtime smoke',
                '  exit 0',
                'fi',
                'out=""',
                'while [ "$#" -gt 0 ]; do',
                '  if [ "$1" = "--output_file" ]; then',
                '    shift',
                '    out="$1"',
                '  fi',
                '  shift',
                'done',
                'printf "fake wav" > "$out"',
                'echo "wrote $out"',
                '',
              ].join('\n')
      fs.writeFileSync(runtimePath, script)
      fs.chmodSync(runtimePath, 0o755)
      return
    }

    if (key === 'fakeMicAudioPath') {
      fs.writeFileSync(runtimePath, createFakeMicWav())
      return
    }

    fs.writeFileSync(runtimePath, 'placeholder model file')
  })

  return runtimePaths
}

function pickRuntimeConfig(runtimePaths) {
  return {
    llmModelPath: runtimePaths.llmModelPath,
    whisperModelPath: runtimePaths.whisperModelPath,
    piperVoicePath: runtimePaths.piperVoicePath,
    llamaBinaryPath: runtimePaths.llamaBinaryPath,
    whisperBinaryPath: runtimePaths.whisperBinaryPath,
    piperBinaryPath: runtimePaths.piperBinaryPath,
  }
}

function seedLearnerStore(userDataDir, runtimePaths) {
  fs.writeFileSync(
    path.join(userDataDir, 'learner-data.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        appName: 'KannadaOS',
        savedAt: new Date().toISOString(),
        values: {
          'kannadaos:local-runtime': JSON.stringify(pickRuntimeConfig(runtimePaths)),
        },
      },
      null,
      2,
    ),
  )
}

function createFakeMicWav() {
  const sampleRate = 16000
  const seconds = 2
  const sampleCount = sampleRate * seconds
  const dataLength = sampleCount * 2
  const buffer = Buffer.alloc(44 + dataLength)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((index / sampleRate) * Math.PI * 2 * 440)
    buffer.writeInt16LE(Math.round(sample * 0x3fff), 44 + index * 2)
  }

  return buffer
}

async function completeLesson(page) {
  await page.getByText('translate', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Hello sir' }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('arrange', { exact: true }).waitFor()
  await page.getByRole('button', { name: /ನಮಸ್ಕಾರ/ }).click()
  await page.getByRole('button', { name: /ಸಾರ್/ }).click()
  await page.getByRole('button', { name: /ಹೇಗಿದ್ದೀರಾ/ }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('fillBlank', { exact: true }).waitFor()
  await page.getByRole('button', { name: /ಹೋಗಬೇಕು/ }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('listening', { exact: true }).waitFor()
  await page.getByRole('button', { name: /play again/i }).click()
  await page.getByText(/Piper audio ready|Playing reference audio|Auto reference audio|Auto Piper audio ready/i).waitFor()
  await page.getByRole('button', { name: /ticket eshtu/i }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('speaking', { exact: true }).waitFor()
  await page.getByRole('button', { name: /record phrase/i }).click()
  try {
    await page.getByRole('button', { name: /stop recording/i }).waitFor({ timeout: 5000 })
  } catch (error) {
    throw new Error(`Speaking recording did not start. Visible text:\n${await page.locator('body').innerText()}`)
  }
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /stop recording/i }).click()
  await page.getByText(/Score: 100 \/ 100/i).waitFor()
  await page.getByRole('button', { name: /^Continue/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('matchPairs', { exact: true }).waitFor()
  await page.getByRole('button', { name: /ನಮಸ್ಕಾರ/ }).click()
  await page.getByRole('button', { name: 'Hello', exact: true }).click()
  await page.getByRole('button', { name: /ಧನ್ಯವಾದ/ }).click()
  await page.getByRole('button', { name: 'Thank you', exact: true }).click()
  await page.getByRole('button', { name: /ಹೋಗು/ }).click()
  await page.getByRole('button', { name: 'Go', exact: true }).click()
  await page.getByRole('button', { name: /ಬಾ/ }).click()
  await page.getByRole('button', { name: 'Come', exact: true }).click()
  await page.getByRole('button', { name: /check/i }).click()

  await page.getByRole('heading', { name: /Lesson Complete/i }).waitFor()
  await page.getByText('+18 XP').waitFor()
  await page.getByLabel('6 Correct').waitFor()
}

async function probeOllama() {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) {
      return { online: false, models: [] }
    }
    const payload = await response.json()
    const models = Array.isArray(payload.models)
      ? payload.models.map((model) => model.name).filter(Boolean)
      : []
    return { online: true, models }
  } catch {
    return { online: false, models: [] }
  }
}

async function closeElectron(app) {
  const child = app.process()

  if (child.exitCode === null && !child.killed) {
    await Promise.race([
      app.close().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
  }

  if (child.exitCode === null && !child.killed) {
    child.kill('SIGTERM')
    await waitForExit(child, 3000)
  }

  if (child.exitCode === null) {
    child.kill('SIGKILL')
    await waitForExit(child, 1000)
  }
}

function waitForExit(child, timeoutMs) {
  return Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}

function killLeftoverElectronHelpers(userDataDir) {
  const processes = childProcess.execFileSync('ps', ['-ax', '-o', 'pid=,command='], {
    encoding: 'utf8',
  })

  processes
    .split('\n')
    .filter((line) => line.includes(userDataDir))
    .map((line) => Number(line.trim().split(/\s+/, 1)[0]))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
    .forEach((pid) => {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // The helper may already be gone by the time we reach it.
      }
    })
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
