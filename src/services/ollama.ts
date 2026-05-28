import { getAllLessonExercises, getPhraseByVocabularyId, lessonExercises } from '../domain/curriculum'
import type { ExerciseType, GeneratedExercise, Phrase } from '../types'

export interface ExercisePromptContext {
  difficultyLevel?: string
  weakAreas?: Record<string, number> | string[] | string
  targetSkillTag?: string
  vocabularyList?: Array<string | Phrase>
}

interface GenerateOptions {
  fetchImpl?: typeof fetch
  model?: string
  baseUrl?: string
  weakArea: string
  promptContext?: ExercisePromptContext
}

interface GenerateTutorOptions {
  fetchImpl?: typeof fetch
  model?: string
  baseUrl?: string
  learnerText: string
  scenarioTitle: string
  scenarioSituation: string
  personaName: string
  personaStyle: string
  correctionStyle: string
  usefulPhrases: string[]
}

export interface ExerciseGenerationResult {
  source: 'native' | 'ollama' | 'openrouter' | 'nvidia' | 'fallback'
  exercise: GeneratedExercise
  error?: string
}

export interface TutorReplyGenerationResult {
  source: 'ollama' | 'fallback'
  text: string
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
  promptContext,
}: GenerateOptions): Promise<ExerciseGenerationResult> {
  const fallback = fallbackExercise(weakArea)

  try {
    const response = await fetchImpl(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        prompt: buildExercisePrompt(weakArea, promptContext),
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

export async function generateTutorReplyWithOllama({
  fetchImpl = fetch,
  model = 'llama3.2',
  baseUrl = 'http://localhost:11434',
  learnerText,
  scenarioTitle,
  scenarioSituation,
  personaName,
  personaStyle,
  correctionStyle,
  usefulPhrases,
}: GenerateTutorOptions): Promise<TutorReplyGenerationResult> {
  try {
    const response = await fetchImpl(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        prompt: buildTutorReplyPrompt({
          learnerText,
          scenarioTitle,
          scenarioSituation,
          personaName,
          personaStyle,
          correctionStyle,
          usefulPhrases,
        }),
      }),
    })

    if (!response.ok) {
      return { source: 'fallback', text: '', error: `Ollama HTTP ${response.status}` }
    }

    const payload = (await response.json()) as { response?: string }
    const text = (payload.response ?? '').trim()

    if (!text) {
      return { source: 'fallback', text: '', error: 'Ollama returned an empty tutor reply.' }
    }

    return { source: 'ollama', text }
  } catch (error) {
    return {
      source: 'fallback',
      text: '',
      error: error instanceof Error ? error.message : 'Unknown Ollama tutor failure',
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

export function buildExercisePrompt(weakArea: string, context: ExercisePromptContext = {}): string {
  const targetSkillTag = context.targetSkillTag?.trim() || weakArea
  const difficultyLevel = context.difficultyLevel?.trim() || 'beginner survival Kannada'
  const weakAreas = formatWeakAreasForPrompt(context.weakAreas ?? { [weakArea]: 1 })
  const vocabularyList = formatVocabularyListForPrompt(
    context.vocabularyList?.length ? context.vocabularyList : getDefaultVocabularyList(targetSkillTag),
  )

  return [
    'Generate one Kannada learning exercise in JSON format.',
    'No markdown except a single JSON object if absolutely necessary.',
    `The learner is at ${difficultyLevel} level. Their weak areas are: ${weakAreas}.`,
    `Focus on the skill tag: ${targetSkillTag}.`,
    `Use vocabulary from this list: ${vocabularyList}`,
    `Target weak area: ${weakArea}.`,
    'Return JSON with this schema: {"type":"translate|fillBlank|arrange","prompt":"English instruction","kannada":"Kannada text","transliteration":"romanized","english":"English meaning","answer":"correct answer string","options":["option1","option2","option3","option4"],"explanation":"Why this is correct","skillTag":"greetings","xp":2,"vocabularyIds":["phrase-id"]}',
    'Every Kannada string must have a readable English meaning and Latin transliteration.',
    'Use practical Bangalore Kannada and keep options short.',
  ].join('\n')
}

export function buildTutorReplyPrompt({
  learnerText,
  scenarioTitle,
  scenarioSituation,
  personaName,
  personaStyle,
  correctionStyle,
  usefulPhrases,
}: Omit<GenerateTutorOptions, 'fetchImpl' | 'model' | 'baseUrl'>): string {
  return [
    `You are ${personaName}, a Kannada tutor for KannadaOS.`,
    `Persona style: ${personaStyle}`,
    `Correction style: ${correctionStyle}`,
    `Scenario: ${scenarioTitle}. ${scenarioSituation}`,
    `Learner said: "${learnerText}"`,
    `Useful phrases: ${usefulPhrases.join(' / ')}`,
    'Reply in English first, with Kannada phrases when useful.',
    'Always include a Kannada phrase, romanized "Say:" text, and English meaning.',
    `If the learner made a mistake, correct it ${correctionStyle}.`,
    'Suggest what to say next with a Kannada phrase.',
    'Keep the reply under 3 sentences and stay in the scenario.',
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

  const exercise: GeneratedExercise = {
    type: parsed.type,
    prompt: parsed.prompt,
    kannada: parsed.kannada,
    answer: parsed.answer,
    options: parsed.options,
    explanation: parsed.explanation ?? 'Practice this phrase in a real Bangalore context.',
  }

  if (typeof parsed.transliteration === 'string') {
    exercise.transliteration = parsed.transliteration
  }

  if (typeof parsed.english === 'string') {
    exercise.english = parsed.english
  }

  if (typeof parsed.skillTag === 'string') {
    exercise.skillTag = parsed.skillTag
  }

  if (typeof parsed.xp === 'number' && Number.isFinite(parsed.xp)) {
    exercise.xp = parsed.xp
  }

  if (Array.isArray(parsed.vocabularyIds)) {
    exercise.vocabularyIds = parsed.vocabularyIds.filter((vocabularyId): vocabularyId is string => typeof vocabularyId === 'string')
  }

  return exercise
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
  const exercise: GeneratedExercise = {
    type: local.type,
    prompt: local.prompt,
    kannada: local.kannada,
    answer: local.answer,
    options: local.options,
    explanation: local.explanation,
    skillTag: local.skillTag,
    xp: local.xp,
    vocabularyIds: local.vocabularyIds,
  }

  if (local.transliteration) {
    exercise.transliteration = local.transliteration
  }

  if (local.english) {
    exercise.english = local.english
  }

  return exercise
}

function formatWeakAreasForPrompt(weakAreas: ExercisePromptContext['weakAreas']): string {
  if (typeof weakAreas === 'string') {
    return weakAreas
  }

  if (Array.isArray(weakAreas)) {
    return weakAreas.length ? weakAreas.join(', ') : 'none yet'
  }

  const entries = Object.entries(weakAreas ?? {})
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([skillTag, count]) => `${skillTag} (${count})`)

  return entries.length ? entries.join(', ') : 'none yet'
}

function formatVocabularyListForPrompt(vocabularyList: Array<string | Phrase>): string {
  const formatted = vocabularyList
    .map((item) => typeof item === 'string' ? item : formatPromptPhrase(item))
    .filter((item) => item.trim().length > 0)

  return formatted.length ? formatted.join(' / ') : 'use authored survival Kannada vocabulary'
}

function getDefaultVocabularyList(targetSkillTag: string): Phrase[] {
  const allExercises = getAllLessonExercises()
  const matchingVocabularyIds = collectVocabularyIds(allExercises.filter((exercise) => exercise.skillTag === targetSkillTag))
  const fallbackVocabularyIds = collectVocabularyIds(allExercises)
  const vocabularyIds = matchingVocabularyIds.length ? matchingVocabularyIds : fallbackVocabularyIds

  return vocabularyIds
    .map((vocabularyId) => getPhraseByVocabularyId(vocabularyId))
    .filter((phrase): phrase is Phrase => phrase !== null)
    .slice(0, 12)
}

function collectVocabularyIds(exercises: typeof lessonExercises): string[] {
  const vocabularyIds = new Set<string>()

  for (const exercise of exercises) {
    for (const vocabularyId of exercise.vocabularyIds) {
      vocabularyIds.add(vocabularyId)
    }
  }

  return Array.from(vocabularyIds)
}

function formatPromptPhrase(phrase: Phrase): string {
  return `${phrase.id}: ${phrase.kannada} (${phrase.transliteration}) = ${phrase.english}`
}
