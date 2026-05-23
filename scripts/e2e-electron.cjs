const { _electron: electron } = require('playwright')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function main() {
  const rootDir = path.join(__dirname, '..')
  const runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-runtime-'))
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kannadaos-user-data-'))
  const runtimePaths = createRuntimePlaceholders(runtimeDir)
  const app = await electron.launch({
    args: [rootDir],
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

    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('button', { name: /zero/i }).click()
    await page.getByRole('button', { name: /start learning/i }).click()
    await page.getByRole('button', { name: /continue: greetings/i }).click()
    await completeLesson(page)
    await page.getByRole('button', { name: /^continue$/i }).click()

    await page.getByRole('button', { name: /chat/i }).click()
    await page.getByPlaceholder(/type in kannada/i).fill('Majestic hogbeku')
    await page.getByRole('button', { name: /send/i }).click()
    await page.getByText(/Majestic-ge hogbeku/i).waitFor()
    await page.reload()
    await page.getByRole('button', { name: /chat/i }).click()
    await page.getByText('Majestic hogbeku').waitFor()
    await page.getByText(/Majestic-ge hogbeku/i).waitFor()
    await page.getByRole('button', { name: /BMTC Bus/i }).click()
    await page.getByRole('heading', { name: /BMTC Bus/i }).waitFor()
    await page.getByRole('button', { name: /Grammar Teacher/i }).click()
    await page.getByRole('button', { name: /record voice/i }).click()
    await page.getByText(/Voice input transcribed: koramangala-ge ticket beku/i).waitFor()

    await page.getByRole('button', { name: /practice/i }).click()
    await page.getByRole('button', { name: /ಹೋಗಬೇಕು/i }).click()
    await page.getByText(/need to go/i).waitFor()
    await page.getByText(/Adaptive difficulty: Steady/i).waitFor()
    await page.getByRole('heading', { name: /Pronunciation Lab/i }).waitFor()
    await page.getByRole('button', { name: /play reference/i }).click()
    await page.getByText(/Reference audio: namaskara saar/i).waitFor()
    await page.getByLabel(/Transcribed speech/i).fill('ನಮಸ್ಕಾರ ಸಾರ್')
    await page.getByRole('button', { name: /score pronunciation/i }).click()
    await page.locator('[aria-label="Pronunciation result"]').getByText(/Score 98/i).waitFor()
    await page.getByText(/No problem syllables/i).waitFor()
    await page.getByText(/Latest attempt: ನಮಸ್ಕಾರ ಸಾರ್/i).waitFor()

    await page.getByRole('button', { name: /stories/i }).click()
    await page.getByRole('heading', { name: /Stories/i }).waitFor()
    await page.getByRole('button', { name: /read first day in bangalore/i }).click()
    await page.getByText(/ರಾಹುಲ್ ಬೆಂಗಳೂರಿಗೆ ಬಂದ/i).waitFor()
    await page.getByRole('button', { name: 'ಬಂದ' }).click()
    await page.getByRole('dialog', { name: /ಬಂದ/i }).waitFor()
    await page.getByRole('button', { name: /take quiz/i }).click()
    await page.getByRole('button', { name: /He does not know Kannada yet/i }).click()
    await page.getByRole('button', { name: /check story answer/i }).click()
    await page.getByRole('heading', { name: /Story Complete/i }).waitFor()
    await page.waitForFunction(() => {
      const progress = JSON.parse(localStorage.getItem('kannadaos:progress') || '{}')
      return progress.xp === 38
    })

    await page.getByRole('button', { name: /blr/i }).click()
    await page.getByText(/Auto Ride/i).waitFor()
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
    await page.getByRole('heading', { name: /On-device Runtime/i }).waitFor()
    await page.getByText(/0 of 3 runtime components ready/i).waitFor()
    await page.getByLabel(/Aya GGUF model path/i).fill(runtimePaths.llmModelPath)
    await page.getByLabel(/Whisper model path/i).fill(runtimePaths.whisperModelPath)
    await page.getByLabel(/Piper voice path/i).fill(runtimePaths.piperVoicePath)
    await page.getByRole('button', { name: /check local runtime/i }).click()
    await page.getByText(/3 of 3 runtime components ready/i).waitFor()
    await page.getByText(/Llama.cpp LLM/i).waitFor()
    await page.getByText(/Whisper.cpp STT/i).waitFor()
    await page.getByText(/Piper TTS/i).waitFor()
    await page.getByRole('button', { name: /start model setup/i }).click()
    await page.getByRole('button', { name: /setup in progress/i }).waitFor()
    await page.getByText(/78%/i).waitFor()
    await page.getByText(/Downloaded/i).waitFor()
    await page.getByText(/Waiting/i).waitFor()
    await page.getByLabel(/Back to app/i).click()

    const ollama = await probeOllama()
    if (ollama.online) {
      await page.getByText(/Ollama online/i).waitFor({ timeout: 3000 })
      console.log(`Ollama live smoke: online (${ollama.models.join(', ') || 'no models listed'})`)
    } else {
      await page.getByText(/Offline fallback|Checking/i).waitFor({ timeout: 3000 })
      console.log('Ollama live smoke: unavailable, offline fallback visible')
    }

    if (pageErrors.length || consoleErrors.length) {
      throw new Error(
        [
          ...pageErrors.map((error) => `pageerror: ${error}`),
          ...consoleErrors.map((error) => `console.error: ${error}`),
        ].join('\n'),
      )
    }
  } finally {
    fs.rmSync(runtimeDir, { recursive: true, force: true })
    fs.rmSync(userDataDir, { recursive: true, force: true })
    await closeElectron(app)
  }
}

function createRuntimePlaceholders(runtimeDir) {
  const runtimePaths = {
    llmModelPath: path.join(runtimeDir, 'aya-8b-q4_K_M.gguf'),
    whisperModelPath: path.join(runtimeDir, 'whisper-small.bin'),
    piperVoicePath: path.join(runtimeDir, 'kn_IN-piper-medium.onnx'),
  }

  Object.values(runtimePaths).forEach((modelPath) => {
    fs.writeFileSync(modelPath, 'placeholder model file')
  })

  return runtimePaths
}

async function completeLesson(page) {
  await page.getByText('translate', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Hello sir' }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('arrange', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'ನಮಸ್ಕಾರ' }).click()
  await page.getByRole('button', { name: 'ಸಾರ್' }).click()
  await page.getByRole('button', { name: 'ಹೇಗಿದ್ದೀರಾ' }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('fillBlank', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'ಹೋಗಬೇಕು' }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('listening', { exact: true }).waitFor()
  await page.getByRole('button', { name: /play reference audio/i }).click()
  await page.getByText(/Playing reference audio/i).waitFor()
  await page.getByRole('button', { name: 'ಟಿಕೆಟ್ ಎಷ್ಟು?' }).click()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('speaking', { exact: true }).waitFor()
  await page.getByRole('button', { name: /record phrase/i }).click()
  await page.getByText(/Score: 87%/i).waitFor()
  await page.getByRole('button', { name: /check/i }).click()
  await page.getByRole('button', { name: /next exercise/i }).click()

  await page.getByText('matchPairs', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'ನಮಸ್ಕಾರ' }).click()
  await page.getByRole('button', { name: 'Hello' }).click()
  await page.getByRole('button', { name: 'ಧನ್ಯವಾದ' }).click()
  await page.getByRole('button', { name: 'Thank you' }).click()
  await page.getByRole('button', { name: 'ಹೋಗು' }).click()
  await page.getByRole('button', { name: 'Go' }).click()
  await page.getByRole('button', { name: 'ಬಾ' }).click()
  await page.getByRole('button', { name: 'Come' }).click()
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

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
