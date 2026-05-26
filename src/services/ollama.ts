import { lessonExercises } from '../domain/curriculum'
import type { ExerciseType, GeneratedExercise } from '../types'

interface GenerateOptions {
  fetchImpl?: typeof fetch
  model?: string
  baseUrl?: string
  weakArea: string
}

export interface ExerciseGenerationResult {
  source: 'native' | 'ollama' | 'openrouter' | 'nvidia' | 'fallback'
  exercise: GeneratedExercise
  error?: string
}

const allowedTypes: ExerciseType[] = [
  'translate',
  'arrange',
  'fillBlank',
  'listening',
  'speaking',
  'matchPairs',
]

export async function generateExerciseWithOllama({
  fetchImpl = fetch,
  model = 'llama3.2',
  baseUrl = 'http://localhost:11434',
  weakArea,
}: GenerateOptions): Promise<ExerciseGenerationResult> {
  const fallback = fallbackExercise(weakArea)

  try {
    const response = await fetchImpl(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        prompt: buildExercisePrompt(weakArea),
      }),
    })

    if (!response.ok) {
      return { source: 'fallback', exercise: fallback, error: `Ollama HTTP ${response.status}` }
    }

    const payload = (await response.json()) as { response?: string }
    const exercise = parseGeneratedExerciseResponse(payload.response ?? '')
    return { source: 'ollama', exercise }
  } catch (error) {
    return {
      source: 'fallback',
      exercise: fallback,
      error: error instanceof Error ? error.message : 'Unknown Ollama failure',
    }
  }
}

export async function checkOllamaStatus(fetchImpl: typeof fetch = fetch): Promise<'online' | 'offline'> {
  try {
    const response = await fetchImpl('http://localhost:11434/api/tags', { method: 'GET' })
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

export function buildExercisePrompt(weakArea: string): string {
  return [
    'Return only valid JSON for a Kannada learning exercise.',
    'No markdown except a single JSON object if absolutely necessary.',
    `Target weak area: ${weakArea}.`,
    'Schema: {"type":"translate|arrange|fillBlank|listening|speaking|matchPairs","prompt":"string","kannada":"string","answer":"string","options":["string"],"explanation":"string"}',
    'Use practical Bangalore Kannada and keep options short.',
  ].join('\n')
}

export function parseGeneratedExerciseResponse(raw: string): GeneratedExercise {
  const parsed = JSON.parse(repairJson(extractJson(raw))) as Partial<GeneratedExercise>

  if (
    !parsed.type ||
    !allowedTypes.includes(parsed.type) ||
    !parsed.prompt ||
    !parsed.kannada ||
    !parsed.answer ||
    !Array.isArray(parsed.options)
  ) {
    throw new Error('Ollama returned an invalid exercise shape')
  }

  return {
    type: parsed.type,
    prompt: parsed.prompt,
    kannada: parsed.kannada,
    answer: parsed.answer,
    options: parsed.options,
    explanation: parsed.explanation ?? 'Practice this phrase in a real Bangalore context.',
  }
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced?.[1] ?? raw).trim()
}

function repairJson(raw: string): string {
  return raw.replace(/,\s*([}\]])/g, '$1')
}

export function fallbackExercise(weakArea: string): GeneratedExercise {
  const local = lessonExercises.find((exercise) => exercise.skillTag === weakArea) ?? lessonExercises[0]
  return {
    type: local.type,
    prompt: local.prompt,
    kannada: local.kannada,
    answer: local.answer,
    options: local.options,
    explanation: local.explanation,
  }
}
