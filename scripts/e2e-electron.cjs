const { _electron: electron } = require('playwright')
const path = require('node:path')

async function main() {
  const rootDir = path.join(__dirname, '..')
  const app = await electron.launch({ args: [rootDir], env: { ...process.env, E2E: '1' } })
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
    await page.getByRole('button', { name: 'Hello sir' }).click()
    await page.getByRole('button', { name: /check/i }).click()
    await page.getByText('+2 XP').waitFor()
    await page.getByLabel('Close lesson').click()

    await page.getByRole('button', { name: /chat/i }).click()
    await page.getByPlaceholder(/type in kannada/i).fill('Majestic hogbeku')
    await page.getByRole('button', { name: /send/i }).click()
    await page.getByText(/Majestic-ge hogbeku/i).waitFor()

    await page.getByRole('button', { name: /practice/i }).click()
    await page.getByRole('button', { name: /ಹೋಗಬೇಕು/i }).click()
    await page.getByText(/need to go/i).waitFor()

    await page.getByRole('button', { name: /blr/i }).click()
    await page.getByText(/Auto Ride/i).waitFor()
    await page.getByRole('button', { name: /^me$/i }).click()
    await page.getByText(/Level 4 Learner/i).waitFor()

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
    await closeElectron(app)
  }
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
    child.kill('SIGTERM')
  }

  if (child.exitCode === null) {
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

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
