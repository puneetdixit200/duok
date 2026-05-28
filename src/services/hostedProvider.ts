import {
  buildExercisePrompt,
  fallbackExercise,
  parseGeneratedExerciseResponse,
  type ExerciseGenerationResult,
  type ExercisePromptContext,
} from './ollama'

export type AiProviderId = 'local' | 'ollama' | 'openrouter' | 'nvidia'
export type HostedProviderId = Extract<AiProviderId, 'openrouter' | 'nvidia'>

export interface AiProviderSettings {
  activeProvider: AiProviderId
  openRouterApiKey: string
  openRouterModel: string
  openRouterBaseUrl: string
  nvidiaApiKey: string
  nvidiaModel: string
  nvidiaBaseUrl: string
}

export interface SanitizedAiProviderSettings {
  activeProvider: AiProviderId
  openRouterModel: string
  openRouterBaseUrl: string
  openRouterApiKeyConfigured: boolean
  nvidiaModel: string
  nvidiaBaseUrl: string
  nvidiaApiKeyConfigured: boolean
}

interface GenerateHostedExerciseOptions {
  fetchImpl?: typeof fetch
  hostedChatCompletion?: HostedChatCompletion
  providerSettings: AiProviderSettings
  weakArea: string
  promptContext?: ExercisePromptContext
}

interface GenerateHostedTutorOptions {
  fetchImpl?: typeof fetch
  hostedChatCompletion?: HostedChatCompletion
  providerSettings: AiProviderSettings
  learnerText: string
  scenarioTitle: string
  scenarioSituation: string
  personaName: string
  personaStyle: string
  correctionStyle: string
  usefulPhrases: string[]
}

interface HostedChatResult {
  source: HostedProviderId | 'fallback'
  text: string
  error?: string
}

export interface HostedChatRequest {
  provider: HostedProviderId
  apiKey: string
  model: string
  baseUrl: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
}

export interface HostedChatResponse {
  ok: boolean
  text: string
  error?: string
}

export type HostedChatCompletion = (request: HostedChatRequest) => Promise<HostedChatResponse>

interface ProviderConnection {
  id: HostedProviderId
  label: string
  apiKey: string
  model: string
  baseUrl: string
}

export const defaultAiProviderSettings: AiProviderSettings = {
  activeProvider: 'local',
  openRouterApiKey: '',
  openRouterModel: 'openai/gpt-4o-mini',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  nvidiaApiKey: '',
  nvidiaModel: 'sarvamai/sarvam-m',
  nvidiaBaseUrl: 'https://integrate.api.nvidia.com/v1',
}

export async function generateExerciseWithHostedProvider({
  fetchImpl = fetch,
  hostedChatCompletion,
  providerSettings,
  weakArea,
  promptContext,
}: GenerateHostedExerciseOptions): Promise<ExerciseGenerationResult> {
  const fallback = fallbackExercise(weakArea)
  const connection = getHostedProviderConnection(providerSettings)

  if (!connection) {
    return { source: 'fallback', exercise: fallback, error: 'Select OpenRouter or NVIDIA hosted AI first.' }
  }

  const validationError = validateConnection(connection)
  if (validationError) {
    return { source: 'fallback', exercise: fallback, error: validationError }
  }

  try {
    const content = await requestHostedChat(
      fetchImpl,
      connection,
      [
        {
          role: 'system',
          content: 'You create short Kannada learning exercises and return only one JSON object.',
        },
        { role: 'user', content: buildExercisePrompt(weakArea, promptContext) },
      ],
      hostedChatCompletion,
    )

    return {
      source: connection.id,
      exercise: parseGeneratedExerciseResponse(content),
    }
  } catch (error) {
    return {
      source: 'fallback',
      exercise: fallback,
      error: error instanceof Error ? error.message : `${connection.label} request failed.`,
    }
  }
}

export async function generateTutorReplyWithHostedProvider({
  fetchImpl = fetch,
  hostedChatCompletion,
  providerSettings,
  learnerText,
  scenarioTitle,
  scenarioSituation,
  personaName,
  personaStyle,
  correctionStyle,
  usefulPhrases,
}: GenerateHostedTutorOptions): Promise<HostedChatResult> {
  const connection = getHostedProviderConnection(providerSettings)

  if (!connection) {
    return { source: 'fallback', text: '', error: 'Select OpenRouter or NVIDIA hosted AI first.' }
  }

  const validationError = validateConnection(connection)
  if (validationError) {
    return { source: 'fallback', text: '', error: validationError }
  }

  try {
    const content = await requestHostedChat(
      fetchImpl,
      connection,
      [
        {
          role: 'system',
          content: buildHostedTutorPrompt({
            scenarioTitle,
            scenarioSituation,
            personaName,
            personaStyle,
            correctionStyle,
            usefulPhrases,
          }),
        },
        { role: 'user', content: learnerText },
      ],
      hostedChatCompletion,
    )

    return { source: connection.id, text: content }
  } catch (error) {
    return {
      source: 'fallback',
      text: '',
      error: error instanceof Error ? error.message : `${connection.label} request failed.`,
    }
  }
}

export function buildHostedTutorPrompt({
  scenarioTitle,
  scenarioSituation,
  personaName,
  personaStyle,
  correctionStyle,
  usefulPhrases,
}: Omit<GenerateHostedTutorOptions, 'fetchImpl' | 'hostedChatCompletion' | 'providerSettings' | 'learnerText'>): string {
  return [
    `You are ${personaName}, a Kannada language tutor for someone learning Bangalore Kannada.`,
    `Style: ${personaStyle}`,
    `Correction approach: ${correctionStyle}`,
    `Scenario: ${scenarioTitle}. ${scenarioSituation}`,
    `Useful phrases: ${usefulPhrases.join(' / ')}`,
    'Rules:',
    '1. Reply in English first, with Kannada phrases when useful.',
    '2. Always include transliteration for Kannada text.',
    '3. Keep replies under 3 sentences.',
    `4. If the learner made a mistake, correct it ${correctionStyle}.`,
    '5. Suggest what to say next with a Kannada phrase.',
    '6. Stay in the scenario context.',
  ].join('\n')
}

export function hydrateAiProviderSettings(serialized: string | null): AiProviderSettings {
  if (!serialized) {
    return defaultAiProviderSettings
  }

  try {
    const parsed = JSON.parse(serialized) as Partial<AiProviderSettings>
    return {
      activeProvider: isAiProviderId(parsed.activeProvider) ? parsed.activeProvider : defaultAiProviderSettings.activeProvider,
      openRouterApiKey: typeof parsed.openRouterApiKey === 'string' ? parsed.openRouterApiKey : '',
      openRouterModel: getStringOrDefault(parsed.openRouterModel, defaultAiProviderSettings.openRouterModel),
      openRouterBaseUrl: getStringOrDefault(parsed.openRouterBaseUrl, defaultAiProviderSettings.openRouterBaseUrl),
      nvidiaApiKey: typeof parsed.nvidiaApiKey === 'string' ? parsed.nvidiaApiKey : '',
      nvidiaModel: getStringOrDefault(parsed.nvidiaModel, defaultAiProviderSettings.nvidiaModel),
      nvidiaBaseUrl: getStringOrDefault(parsed.nvidiaBaseUrl, defaultAiProviderSettings.nvidiaBaseUrl),
    }
  } catch {
    return defaultAiProviderSettings
  }
}

export function sanitizeAiProviderSettingsForExport(settings: AiProviderSettings): SanitizedAiProviderSettings {
  return {
    activeProvider: settings.activeProvider,
    openRouterModel: settings.openRouterModel,
    openRouterBaseUrl: settings.openRouterBaseUrl,
    openRouterApiKeyConfigured: Boolean(settings.openRouterApiKey.trim()),
    nvidiaModel: settings.nvidiaModel,
    nvidiaBaseUrl: settings.nvidiaBaseUrl,
    nvidiaApiKeyConfigured: Boolean(settings.nvidiaApiKey.trim()),
  }
}

export function getAiProviderLabel(provider: AiProviderId): string {
  if (provider === 'openrouter') {
    return 'OpenRouter'
  }

  if (provider === 'nvidia') {
    return 'NVIDIA hosted'
  }

  if (provider === 'ollama') {
    return 'Ollama'
  }

  return 'Local first'
}

export function isHostedProviderConfigured(settings: AiProviderSettings): boolean {
  const connection = getHostedProviderConnection(settings)
  return Boolean(connection && !validateConnection(connection))
}

function getHostedProviderConnection(settings: AiProviderSettings): ProviderConnection | null {
  if (settings.activeProvider === 'openrouter') {
    return {
      id: 'openrouter',
      label: 'OpenRouter',
      apiKey: settings.openRouterApiKey,
      model: settings.openRouterModel,
      baseUrl: settings.openRouterBaseUrl,
    }
  }

  if (settings.activeProvider === 'nvidia') {
    return {
      id: 'nvidia',
      label: 'NVIDIA hosted',
      apiKey: settings.nvidiaApiKey,
      model: settings.nvidiaModel,
      baseUrl: settings.nvidiaBaseUrl,
    }
  }

  return null
}

function validateConnection(connection: ProviderConnection): string | null {
  if (!connection.apiKey.trim()) {
    return `${connection.label} API key is required.`
  }

  if (!connection.model.trim()) {
    return `${connection.label} model is required.`
  }

  if (!connection.baseUrl.trim()) {
    return `${connection.label} base URL is required.`
  }

  return null
}

async function requestHostedChat(
  fetchImpl: typeof fetch,
  connection: ProviderConnection,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  hostedChatCompletion?: HostedChatCompletion,
): Promise<string> {
  if (hostedChatCompletion) {
    const response = await hostedChatCompletion({
      provider: connection.id,
      apiKey: connection.apiKey,
      model: connection.model,
      baseUrl: connection.baseUrl,
      messages,
    })

    if (!response.ok) {
      throw new Error(response.error ?? `${connection.label} request failed.`)
    }

    return response.text
  }

  const response = await fetchImpl(`${connection.baseUrl.replace(/\/+$/g, '')}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(connection),
    body: JSON.stringify({
      model: connection.model,
      messages,
      temperature: 0.7,
      max_tokens: 700,
    }),
  })

  if (!response.ok) {
    throw new Error(`${connection.label} HTTP ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message?: string }
  }
  const content = payload.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error(payload.error?.message ?? `${connection.label} returned no text.`)
  }

  return content
}

function buildHeaders(connection: ProviderConnection): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${connection.apiKey}`,
    'Content-Type': 'application/json',
  }

  if (connection.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/puneetdixit200/duok'
    headers['X-Title'] = 'KannadaOS'
  }

  return headers
}

function isAiProviderId(value: unknown): value is AiProviderId {
  return value === 'local' || value === 'ollama' || value === 'openrouter' || value === 'nvidia'
}

function getStringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}
